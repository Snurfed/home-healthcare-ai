/**
 * Prepare Tab (NestMed Style)
 *
 * Shows referral documents and AI-extracted patient history:
 * - Horizontal scrollable document thumbnails with upload
 * - AI-extracted Orders for Home Care
 * - AI-extracted Medications
 * - AI-extracted Recent Hospitalization
 * - AI-extracted Past Medical History
 * - AI-extracted Past Surgical History
 * - AI-extracted Review of Systems
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { useReferralDocuments } from '@hooks/index';
import { Spinner, Alert } from '@components/common';
import type {
  ReferralListItem,
  ReferralDocument,
  ReferralDocumentType,
  ExtractionStatus,
  ExtractedOrder,
  ExtractedDiagnosis,
  ExtractedMedication,
  ExtractionResult,
} from '@typedefs/index';
import { DOCUMENT_TYPE_LABELS } from '@typedefs/referral.types';

interface PrepareTabProps {
  patientId: string;
}

// Document type selection modal
function DocumentTypeModal({
  isOpen,
  onClose,
  onSelect,
  fileName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: ReferralDocumentType) => void;
  fileName: string;
}) {
  if (!isOpen) return null;

  const types: ReferralDocumentType[] = [
    'REFERRAL',
    'DISCHARGE_SUMMARY',
    'FACE_TO_FACE',
    'MEDICATION_LIST',
    'LAB_RESULTS',
    'OTHER',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Document Type</h3>
        <p className="text-sm text-gray-500 mb-4 truncate">{fileName}</p>
        <div className="space-y-2">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 border border-gray-200 text-gray-900 transition-colors"
            >
              {DOCUMENT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Extraction status indicator
function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  const config: Record<ExtractionStatus, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Analyzing...' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ready' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  };

  const { bg, text, label } = config[status] || config.PENDING;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${bg} ${text}`}>
      {status === 'PROCESSING' && (
        <svg className="animate-spin -ml-0.5 mr-1 h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {label}
    </span>
  );
}

// Get file extension icon color
function getFileTypeColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'text-red-400';
    case 'doc':
    case 'docx':
      return 'text-blue-400';
    case 'png':
    case 'jpg':
    case 'jpeg':
      return 'text-green-400';
    default:
      return 'text-gray-400';
  }
}

// Document card component - now shows filename
function DocumentCard({
  document,
  onClick,
}: {
  document: ReferralListItem;
  onClick: () => void;
}) {
  // Show first 12 chars of filename, truncated
  const displayName = document.originalFileName || document.fileName;
  const shortName = displayName.length > 14 ? displayName.slice(0, 11) + '...' : displayName;
  const typeLabel = DOCUMENT_TYPE_LABELS[document.documentType];
  const iconColor = getFileTypeColor(displayName);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-28 bg-white rounded-xl border border-gray-200 p-3 hover:border-green-300 hover:shadow-sm transition-all text-left"
    >
      {/* Document Icon */}
      <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center mb-2 relative">
        <svg
          className={`w-10 h-10 ${iconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {document.extractionStatus === 'COMPLETED' && (
          <div className="absolute top-1 right-1">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {document.extractionStatus === 'FAILED' && (
          <div className="absolute top-1 right-1">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      {/* Filename */}
      <p className="text-[10px] text-gray-700 text-center truncate font-medium mb-0.5" title={displayName}>
        {shortName}
      </p>
      {/* Document type */}
      <p className="text-[9px] text-gray-400 text-center truncate mb-1">{typeLabel}</p>
      {/* Extraction status */}
      <div className="flex justify-center">
        <ExtractionStatusBadge status={document.extractionStatus} />
      </div>
    </button>
  );
}

// Upload progress overlay
function UploadProgress({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <div className="flex-shrink-0 w-28 bg-white rounded-xl border-2 border-blue-300 p-3">
      <div className="w-full aspect-[3/4] bg-blue-50 rounded-lg flex flex-col items-center justify-center mb-2">
        <Spinner size="sm" />
        <span className="text-xs text-blue-600 mt-2">{progress}%</span>
      </div>
      <p className="text-[10px] text-gray-500 text-center truncate">{fileName}</p>
    </div>
  );
}

// Empty state component
function EmptySection({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="p-6 text-center">
      <div className="mx-auto h-8 w-8 text-gray-300">{icon}</div>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}

// Aggregated extraction data type
interface AggregatedExtractionData {
  orders: ExtractedOrder[];
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  hospitalization: {
    hospital: string;
    dates: string;
    primaryDx: string;
    primaryDxCode: string;
    admissionType?: string;
  } | null;
  surgicalHistory: string[];
  reviewOfSystems: string[];
}

export default function PrepareTab({ patientId }: PrepareTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ReferralDocument | null>(null);
  const [loadedDocuments, setLoadedDocuments] = useState<ReferralDocument[]>([]);
  const [isLoadingFullDocs, setIsLoadingFullDocs] = useState(false);

  const {
    documents,
    isLoading,
    error,
    uploadState,
    uploadFile,
    getDocument,
    hasProcessingDocuments,
  } = useReferralDocuments({ patientId });

  // Load full document data for all completed documents
  useEffect(() => {
    const loadCompletedDocuments = async () => {
      const completedDocs = documents.filter(d => d.extractionStatus === 'COMPLETED');
      if (completedDocs.length === 0) {
        setLoadedDocuments([]);
        return;
      }

      // Check if we already have all completed docs loaded
      const loadedIds = new Set(loadedDocuments.map(d => d.id));
      const needToLoad = completedDocs.filter(d => !loadedIds.has(d.id));

      if (needToLoad.length === 0) {
        return;
      }

      setIsLoadingFullDocs(true);
      try {
        const fullDocs = await Promise.all(
          needToLoad.map(doc => getDocument(doc.id))
        );
        const validDocs = fullDocs.filter((d): d is ReferralDocument => d !== null);

        // Merge with existing loaded docs, removing any that are no longer in documents list
        setLoadedDocuments(prev => {
          const currentIds = new Set(documents.map(d => d.id));
          const filtered = prev.filter(d => currentIds.has(d.id));
          return [...filtered, ...validDocs];
        });
      } finally {
        setIsLoadingFullDocs(false);
      }
    };

    loadCompletedDocuments();
  }, [documents, getDocument]);

  // Aggregate extraction data from all loaded documents
  const aggregatedData = useMemo((): AggregatedExtractionData => {
    const orders: ExtractedOrder[] = [];
    const diagnoses: ExtractedDiagnosis[] = [];
    const medications: ExtractedMedication[] = [];
    const surgicalHistory: string[] = [];
    const reviewOfSystems: string[] = [];
    let hospitalization: AggregatedExtractionData['hospitalization'] = null;

    // Track seen items to avoid duplicates
    const seenOrders = new Set<string>();
    const seenDiagnoses = new Set<string>();
    const seenMedications = new Set<string>();

    for (const doc of loadedDocuments) {
      const data = doc.extractedData as ExtractionResult | null;
      if (!data) continue;

      // Aggregate orders
      if (data.orders) {
        for (const order of data.orders) {
          const key = `${order.discipline}-${order.frequency}`;
          if (!seenOrders.has(key)) {
            seenOrders.add(key);
            orders.push(order);
          }
        }
      }

      // Aggregate diagnoses
      if (data.diagnoses) {
        for (const dx of data.diagnoses) {
          if (!seenDiagnoses.has(dx.icdCode)) {
            seenDiagnoses.add(dx.icdCode);
            diagnoses.push(dx);

            // Check for surgical history keywords
            const dxLower = dx.description.toLowerCase();
            if (dxLower.includes('surgery') || dxLower.includes('surgical') ||
                dxLower.includes('post-op') || dxLower.includes('postop') ||
                dxLower.includes('s/p') || dxLower.includes('status post') ||
                dxLower.includes('arthroplasty') || dxLower.includes('amputation') ||
                dxLower.includes('ectomy') || dxLower.includes('otomy') ||
                dxLower.includes('plasty') || dxLower.includes('replacement')) {
              surgicalHistory.push(`${dx.icdCode} - ${dx.description}`);
            }
          }
        }
      }

      // Aggregate medications
      if (data.medications) {
        for (const med of data.medications) {
          const key = med.name.toLowerCase();
          if (!seenMedications.has(key)) {
            seenMedications.add(key);
            medications.push(med);
          }
        }
      }

      // Get hospitalization from discharge summary or first available
      if (!hospitalization && data.certificationPeriod?.startDate) {
        const primaryDx = data.diagnoses?.find(d => d.isPrimary) || data.diagnoses?.[0];
        hospitalization = {
          hospital: data.demographics?.address?.city ? `${data.demographics.address.city} Hospital` : 'Recent Hospital',
          dates: data.certificationPeriod.startDate
            ? new Date(data.certificationPeriod.startDate).toLocaleDateString()
            : 'N/A',
          primaryDx: primaryDx?.description || 'N/A',
          primaryDxCode: primaryDx?.icdCode || '',
          admissionType: doc.documentType === 'DISCHARGE_SUMMARY' ? 'Inpatient' : undefined,
        };
      }
    }

    // Sort diagnoses: primary first, then by confidence
    diagnoses.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return b.confidence - a.confidence;
    });

    // Sort medications alphabetically
    medications.sort((a, b) => a.name.localeCompare(b.name));

    return {
      orders,
      diagnoses,
      medications,
      hospitalization,
      surgicalHistory,
      reviewOfSystems,
    };
  }, [loadedDocuments]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowTypeModal(true);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Handle document type selection
  const handleTypeSelect = (type: ReferralDocumentType) => {
    if (pendingFile) {
      uploadFile(pendingFile, type);
      setPendingFile(null);
    }
    setShowTypeModal(false);
  };

  // Handle document click - fetch full document with extracted data
  const handleDocumentClick = async (doc: ReferralListItem) => {
    if (doc.extractionStatus === 'COMPLETED') {
      const fullDoc = await getDocument(doc.id);
      if (fullDoc) {
        setSelectedDocument(fullDoc);
      }
    }
  };

  // Convenience accessors
  const { orders, diagnoses, medications, hospitalization, surgicalHistory } = aggregatedData;

  // For the details modal
  const selectedExtractedData = selectedDocument?.extractedData as ExtractionResult | null;
  const selectedDemographics = selectedExtractedData?.demographics;
  const selectedDiagnoses = selectedExtractedData?.diagnoses || [];
  const selectedOrders = selectedExtractedData?.orders || [];

  return (
    <div className="space-y-6 pb-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Document type selection modal */}
      <DocumentTypeModal
        isOpen={showTypeModal}
        onClose={() => {
          setShowTypeModal(false);
          setPendingFile(null);
        }}
        onSelect={handleTypeSelect}
        fileName={pendingFile?.name || ''}
      />

      {/* Error alert */}
      {(error || uploadState.error) && (
        <Alert variant="error">
          {uploadState.error || 'Failed to load documents'}
        </Alert>
      )}

      {/* Referral Documents */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Referral Documents</h2>
          <div className="flex items-center gap-3">
            {isLoadingFullDocs && (
              <span className="flex items-center text-xs text-gray-500">
                <Spinner size="sm" />
                <span className="ml-1.5">Loading data...</span>
              </span>
            )}
            {hasProcessingDocuments && (
              <span className="flex items-center text-xs text-blue-600">
                <svg className="animate-spin mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                AI analyzing...
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center w-full py-8">
              <Spinner size="md" />
              <span className="ml-2 text-gray-500">Loading documents...</span>
            </div>
          )}

          {/* Document cards */}
          {!isLoading && documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onClick={() => handleDocumentClick(doc)}
            />
          ))}

          {/* Upload progress */}
          {uploadState.isUploading && uploadState.currentFile && (
            <UploadProgress
              fileName={uploadState.currentFile}
              progress={uploadState.progress}
            />
          )}

          {/* Add Document button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.isUploading}
            className="flex-shrink-0 w-28 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-3 hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-full aspect-[3/4] flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">Add</p>
          </button>
        </div>

        {/* No documents message */}
        {!isLoading && documents.length === 0 && !uploadState.isUploading && (
          <p className="text-sm text-gray-500 text-center py-4">
            Upload referral documents to auto-populate patient data
          </p>
        )}
      </section>

      {/* Orders for Home Care */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Orders for Home Care</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {orders.length > 0 ? (
            orders.map((order: ExtractedOrder, index: number) => (
              <div key={index} className="p-4">
                <h3 className="font-medium text-gray-900">{order.discipline}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {order.frequency && `${order.frequency}`}
                  {order.duration && ` × ${order.duration}`}
                </p>
                {order.specificOrders && order.specificOrders.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                    {order.specificOrders.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <EmptySection
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              message="Upload a referral document to extract orders"
            />
          )}
        </div>
      </section>

      {/* Medications */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Medications</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {medications.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medication
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dose / Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medications.map((med: ExtractedMedication, index: number) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{med.name}</p>
                      {med.indication && (
                        <p className="text-xs text-gray-500">For: {med.indication}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {med.dose || '-'}{med.dose && med.frequency ? ', ' : ''}{med.frequency || ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {med.route || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptySection
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              }
              message="Upload a medication list to extract medications"
            />
          )}
        </div>
      </section>

      {/* Recent Hospitalization */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Hospitalization</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {hospitalization ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{hospitalization.hospital}</h3>
                  <p className="text-sm text-gray-500">{hospitalization.dates}</p>
                </div>
                {hospitalization.admissionType && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {hospitalization.admissionType}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Primary DX for Admission
                </h4>
                <p className="text-sm text-gray-700">
                  {hospitalization.primaryDxCode && (
                    <span className="font-mono text-gray-500">{hospitalization.primaryDxCode}</span>
                  )}
                  {hospitalization.primaryDxCode && ' - '}
                  {hospitalization.primaryDx}
                </p>
              </div>
            </div>
          ) : (
            <EmptySection
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              message="Upload a discharge summary to extract hospitalization info"
            />
          )}
        </div>
      </section>

      {/* Past Medical History */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Past Medical History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {diagnoses.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {diagnoses.map((dx: ExtractedDiagnosis, index: number) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{dx.description}</p>
                          <p className="text-xs text-gray-500 font-mono">{dx.icdCode}</p>
                        </div>
                        {dx.isPrimary && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                          <div
                            className={`h-1.5 rounded-full ${
                              dx.confidence >= 0.8 ? 'bg-green-500' : dx.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${dx.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(dx.confidence * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptySection
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              message="Upload documents to extract diagnoses and medical history"
            />
          )}
        </div>
      </section>

      {/* Past Surgical History */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Past Surgical History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {surgicalHistory.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {surgicalHistory.map((surgery, index) => (
                <li key={index} className="px-4 py-3 text-sm text-gray-700">
                  {surgery}
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              }
              message="No surgical history detected in uploaded documents"
            />
          )}
        </div>
      </section>

      {/* Latest Review of Systems */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Latest Review of Systems</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Show relevant system findings based on diagnoses */}
            {diagnoses.length > 0 ? (
              <>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Cardiovascular</h4>
                  <ul className="text-gray-600 space-y-1">
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('I') ||
                      dx.description.toLowerCase().includes('heart') ||
                      dx.description.toLowerCase().includes('hypertension') ||
                      dx.description.toLowerCase().includes('chf')
                    ).slice(0, 3).map((dx, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        {dx.description}
                      </li>
                    ))}
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('I') ||
                      dx.description.toLowerCase().includes('heart')
                    ).length === 0 && (
                      <li className="text-gray-400">No findings</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Respiratory</h4>
                  <ul className="text-gray-600 space-y-1">
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('J') ||
                      dx.description.toLowerCase().includes('copd') ||
                      dx.description.toLowerCase().includes('asthma') ||
                      dx.description.toLowerCase().includes('pneumonia')
                    ).slice(0, 3).map((dx, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        {dx.description}
                      </li>
                    ))}
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('J')
                    ).length === 0 && (
                      <li className="text-gray-400">No findings</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Endocrine</h4>
                  <ul className="text-gray-600 space-y-1">
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('E') ||
                      dx.description.toLowerCase().includes('diabetes') ||
                      dx.description.toLowerCase().includes('thyroid')
                    ).slice(0, 3).map((dx, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        {dx.description}
                      </li>
                    ))}
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('E')
                    ).length === 0 && (
                      <li className="text-gray-400">No findings</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Musculoskeletal</h4>
                  <ul className="text-gray-600 space-y-1">
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('M') ||
                      dx.description.toLowerCase().includes('arthritis') ||
                      dx.description.toLowerCase().includes('fracture') ||
                      dx.description.toLowerCase().includes('pain')
                    ).slice(0, 3).map((dx, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        {dx.description}
                      </li>
                    ))}
                    {diagnoses.filter(dx =>
                      dx.icdCode.startsWith('M')
                    ).length === 0 && (
                      <li className="text-gray-400">No findings</li>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <EmptySection
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  }
                  message="Upload documents to populate review of systems"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Selected document details modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedDocument.originalFileName || selectedDocument.fileName}
                </h3>
                <p className="text-sm text-gray-500">{DOCUMENT_TYPE_LABELS[selectedDocument.documentType]}</p>
              </div>
              <button
                onClick={() => setSelectedDocument(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedExtractedData?.extractionSummary && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    <span className="font-medium">AI Extraction Complete:</span>{' '}
                    {selectedExtractedData.extractionSummary.totalFieldsExtracted} fields extracted
                    ({selectedExtractedData.extractionSummary.highConfidenceCount} high confidence)
                  </p>
                </div>
              )}

              {/* Demographics */}
              {selectedDemographics && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Patient Demographics</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedDemographics.firstName && (
                      <div><span className="text-gray-500">Name:</span> {selectedDemographics.firstName} {selectedDemographics.lastName}</div>
                    )}
                    {selectedDemographics.dateOfBirth && (
                      <div><span className="text-gray-500">DOB:</span> {selectedDemographics.dateOfBirth}</div>
                    )}
                    {selectedDemographics.phone && (
                      <div><span className="text-gray-500">Phone:</span> {selectedDemographics.phone}</div>
                    )}
                    {selectedDemographics.physician?.name && (
                      <div><span className="text-gray-500">Physician:</span> {selectedDemographics.physician.name}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnoses */}
              {selectedDiagnoses.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Diagnoses</h4>
                  <ul className="space-y-1">
                    {selectedDiagnoses.map((dx: ExtractedDiagnosis, i: number) => (
                      <li key={i} className="text-sm">
                        <span className="font-mono text-gray-500">{dx.icdCode}</span> - {dx.description}
                        {dx.isPrimary && <span className="ml-2 text-xs text-green-600">(Primary)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Orders */}
              {selectedOrders.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Orders</h4>
                  <ul className="space-y-1">
                    {selectedOrders.map((order: ExtractedOrder, i: number) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{order.discipline}</span>
                        {order.frequency && ` - ${order.frequency}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedDocument(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
