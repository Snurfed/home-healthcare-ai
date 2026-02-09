/**
 * Referral Extraction Review Component
 *
 * Split-screen interface for reviewing and accepting
 * AI-extracted data from referral documents
 */

import { useState, useMemo, useCallback } from 'react';
import { Button, Alert, Badge, Modal } from '@components/common';
import { referralService } from '@services/referral.service';
import type {
  ReferralDocument,
  ExtractedDiagnosis,
  ExtractedMedication,
  FieldAcceptanceState,
} from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

interface ReferralExtractionReviewProps {
  document: ReferralDocument;
  assessmentId?: string;
  onApplyComplete: (appliedFields: number, assessmentId: string) => void;
  onClose: () => void;
  onCreateAssessment?: () => Promise<string>;
}

interface ReviewableField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  sourceText?: string;
  status: FieldAcceptanceState;
  editedValue?: string;
  itemCode?: string;
}

// ===========================================
// ICONS
// ===========================================

const ChevronDownIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PencilIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

const DocumentTextIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ZoomInIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
    />
  </svg>
);

const ZoomOutIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
    />
  </svg>
);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getConfidenceBadge(confidence: number): { color: 'success' | 'warning' | 'error'; label: string } {
  if (confidence >= 0.9) return { color: 'success', label: `${Math.round(confidence * 100)}%` };
  if (confidence >= 0.7) return { color: 'warning', label: `${Math.round(confidence * 100)}%` };
  return { color: 'error', label: `${Math.round(confidence * 100)}%` };
}

function getStatusBorderClass(status: FieldAcceptanceState): string {
  switch (status) {
    case 'accepted':
      return 'border-l-4 border-l-green-500 bg-green-50';
    case 'edited':
      return 'border-l-4 border-l-blue-500 bg-blue-50';
    case 'rejected':
      return 'border-l-4 border-l-red-500 bg-red-50 opacity-60';
    default:
      return 'border-l-4 border-l-gray-200';
  }
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

interface FieldRowProps {
  field: ReviewableField;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (newValue: string) => void;
  questionText?: string;
}

function FieldRow({ field, onAccept, onReject, onEdit, questionText }: FieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.editedValue || field.value);
  const confidenceBadge = getConfidenceBadge(field.confidence);

  const handleSaveEdit = () => {
    onEdit(editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(field.editedValue || field.value);
    setIsEditing(false);
  };

  return (
    <div className={`p-3 rounded-lg mb-2 transition-all ${getStatusBorderClass(field.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label and OASIS code */}
          <div className="flex items-center gap-2 mb-1">
            {field.itemCode && (
              <span className="text-xs font-mono text-gray-500">{field.itemCode}</span>
            )}
            <span className="text-sm font-medium text-gray-900">{field.label}</span>
            <Badge variant={confidenceBadge.color}>
              {confidenceBadge.label}
            </Badge>
            {field.status === 'accepted' && (
              <CheckIcon className="w-4 h-4 text-green-600" />
            )}
            {field.status === 'rejected' && (
              <XIcon className="w-4 h-4 text-red-600" />
            )}
          </div>

          {/* Question text if available */}
          {questionText && (
            <p className="text-xs text-gray-500 mb-1">{questionText}</p>
          )}

          {/* Value */}
          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
              <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className={`text-sm ${field.status === 'rejected' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {field.editedValue || field.value}
            </p>
          )}

          {/* Source text */}
          {field.sourceText && (
            <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-300 rounded-r">
              <p className="text-xs text-gray-500 italic">"{field.sourceText}"</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {field.status === 'pending' && !isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onAccept}
              className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
              title="Accept"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
              title="Edit"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onReject}
              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
              title="Reject"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {(field.status === 'accepted' || field.status === 'edited') && !isEditing && (
          <button
            type="button"
            onClick={onReject}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Undo"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}

        {field.status === 'rejected' && !isEditing && (
          <button
            type="button"
            onClick={onAccept}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded transition-colors"
            title="Restore"
          >
            <CheckIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  acceptedCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  onAcceptAll?: () => void;
}

function CollapsibleSection({
  title,
  icon,
  count,
  acceptedCount,
  isExpanded,
  onToggle,
  children,
  onAcceptAll,
}: CollapsibleSectionProps) {
  return (
    <div className="border rounded-lg mb-3 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-900">{title}</span>
          <Badge variant="default">
            {acceptedCount}/{count}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onAcceptAll && acceptedCount < count && (
            <Button
                            variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onAcceptAll();
              }}
            >
              Accept All
            </Button>
          )}
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>
      {isExpanded && <div className="p-3 border-t">{children}</div>}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export default function ReferralExtractionReview({
  document,
  assessmentId: initialAssessmentId,
  onApplyComplete,
  onClose,
  onCreateAssessment,
}: ReferralExtractionReviewProps) {
  const extractedData = document.extractedData;

  // State for field acceptance
  const [oasisFieldStates, setOasisFieldStates] = useState<Record<string, FieldAcceptanceState>>({});
  const [oasisEditedValues, setOasisEditedValues] = useState<Record<string, string>>({});
  const [diagnosisStates, setDiagnosisStates] = useState<Record<number, FieldAcceptanceState>>({});
  const [medicationStates, setMedicationStates] = useState<Record<number, FieldAcceptanceState>>({});

  // UI state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    demographics: true,
    diagnoses: true,
    medications: false,
    oasis: true,
    orders: false,
  });
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateAssessmentPrompt, setShowCreateAssessmentPrompt] = useState(false);
  const [documentZoom, setDocumentZoom] = useState(100);

  // Convert extracted data to reviewable fields
  const oasisFields = useMemo((): ReviewableField[] => {
    if (!extractedData?.oasisMappings) return [];

    return Object.entries(extractedData.oasisMappings).map(([itemCode, field]) => ({
      key: itemCode,
      label: field.fieldName,
      value: field.value,
      confidence: field.confidence,
      sourceText: field.sourceText,
      itemCode,
      status: oasisFieldStates[itemCode] || 'pending',
      editedValue: oasisEditedValues[itemCode],
    }));
  }, [extractedData?.oasisMappings, oasisFieldStates, oasisEditedValues]);

  const diagnoses = useMemo((): (ExtractedDiagnosis & { status: FieldAcceptanceState })[] => {
    if (!extractedData?.diagnoses) return [];
    return extractedData.diagnoses.map((dx, idx) => ({
      ...dx,
      status: diagnosisStates[idx] || 'pending',
    }));
  }, [extractedData?.diagnoses, diagnosisStates]);

  const medications = useMemo((): (ExtractedMedication & { status: FieldAcceptanceState })[] => {
    if (!extractedData?.medications) return [];
    return extractedData.medications.map((med, idx) => ({
      ...med,
      status: medicationStates[idx] || 'pending',
    }));
  }, [extractedData?.medications, medicationStates]);

  // Calculate stats
  const stats = useMemo(() => {
    const allOasis = oasisFields.length;
    const acceptedOasis = oasisFields.filter((f) => f.status === 'accepted' || f.status === 'edited').length;
    const highConfidence = oasisFields.filter((f) => f.confidence >= 0.9).length;
    const needsReview = oasisFields.filter((f) => f.confidence < 0.7).length;

    return {
      totalFields: allOasis + diagnoses.length + medications.length,
      acceptedFields: acceptedOasis + diagnoses.filter((d) => d.status === 'accepted').length,
      highConfidence,
      needsReview,
    };
  }, [oasisFields, diagnoses, medications]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Field action handlers
  const handleOasisAccept = useCallback((itemCode: string) => {
    setOasisFieldStates((prev) => ({ ...prev, [itemCode]: 'accepted' }));
  }, []);

  const handleOasisReject = useCallback((itemCode: string) => {
    setOasisFieldStates((prev) => ({ ...prev, [itemCode]: 'rejected' }));
  }, []);

  const handleOasisEdit = useCallback((itemCode: string, newValue: string) => {
    setOasisFieldStates((prev) => ({ ...prev, [itemCode]: 'edited' }));
    setOasisEditedValues((prev) => ({ ...prev, [itemCode]: newValue }));
  }, []);

  const handleDiagnosisAccept = useCallback((index: number) => {
    setDiagnosisStates((prev) => ({ ...prev, [index]: 'accepted' }));
  }, []);

  const handleDiagnosisReject = useCallback((index: number) => {
    setDiagnosisStates((prev) => ({ ...prev, [index]: 'rejected' }));
  }, []);

  const handleMedicationAccept = useCallback((index: number) => {
    setMedicationStates((prev) => ({ ...prev, [index]: 'accepted' }));
  }, []);

  const handleMedicationReject = useCallback((index: number) => {
    setMedicationStates((prev) => ({ ...prev, [index]: 'rejected' }));
  }, []);

  // Accept all high confidence
  const handleAcceptAllHighConfidence = useCallback(() => {
    const updates: Record<string, FieldAcceptanceState> = {};
    oasisFields.forEach((field) => {
      if (field.confidence >= 0.9 && field.status === 'pending') {
        updates[field.key] = 'accepted';
      }
    });
    setOasisFieldStates((prev) => ({ ...prev, ...updates }));

    // Also accept high confidence diagnoses
    const dxUpdates: Record<number, FieldAcceptanceState> = {};
    diagnoses.forEach((dx, idx) => {
      if (dx.confidence >= 0.9 && dx.status === 'pending') {
        dxUpdates[idx] = 'accepted';
      }
    });
    setDiagnosisStates((prev) => ({ ...prev, ...dxUpdates }));
  }, [oasisFields, diagnoses]);

  // Accept all in a section
  const handleAcceptAllOasis = useCallback(() => {
    const updates: Record<string, FieldAcceptanceState> = {};
    oasisFields.forEach((field) => {
      if (field.status === 'pending') {
        updates[field.key] = 'accepted';
      }
    });
    setOasisFieldStates((prev) => ({ ...prev, ...updates }));
  }, [oasisFields]);

  const handleAcceptAllDiagnoses = useCallback(() => {
    const updates: Record<number, FieldAcceptanceState> = {};
    diagnoses.forEach((_, idx) => {
      if (diagnosisStates[idx] !== 'accepted') {
        updates[idx] = 'accepted';
      }
    });
    setDiagnosisStates((prev) => ({ ...prev, ...updates }));
  }, [diagnoses, diagnosisStates]);

  const handleAcceptAllMedications = useCallback(() => {
    const updates: Record<number, FieldAcceptanceState> = {};
    medications.forEach((_, idx) => {
      if (medicationStates[idx] !== 'accepted') {
        updates[idx] = 'accepted';
      }
    });
    setMedicationStates((prev) => ({ ...prev, ...updates }));
  }, [medications, medicationStates]);

  // Apply to assessment
  const handleApplyToAssessment = async () => {
    // Check if we have an assessment ID
    if (!initialAssessmentId) {
      setShowCreateAssessmentPrompt(true);
      return;
    }

    await applyToAssessment(initialAssessmentId);
  };

  const applyToAssessment = async (assessmentId: string) => {
    setIsApplying(true);
    setError(null);

    try {
      // Collect accepted/edited OASIS fields
      const acceptedFields: Record<string, string> = {};

      oasisFields.forEach((field) => {
        if (field.status === 'accepted' || field.status === 'edited') {
          acceptedFields[field.key] = field.editedValue || field.value;
        }
      });

      if (Object.keys(acceptedFields).length === 0) {
        setError('No fields have been accepted. Please accept at least one field.');
        setIsApplying(false);
        return;
      }

      const result = await referralService.applyToAssessment(document.id, {
        assessmentId,
        acceptedFields,
      });

      onApplyComplete(result.appliedFields, assessmentId);
    } catch (err) {
      console.error('Error applying extraction:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply extraction. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCreateAndApply = async () => {
    if (!onCreateAssessment) return;

    setShowCreateAssessmentPrompt(false);
    setIsApplying(true);

    try {
      const newAssessmentId = await onCreateAssessment();
      await applyToAssessment(newAssessmentId);
    } catch (err) {
      console.error('Error creating assessment:', err);
      setError('Failed to create assessment. Please try again.');
      setIsApplying(false);
    }
  };

  // Check if any fields are accepted
  const hasAcceptedFields = useMemo(() => {
    return (
      oasisFields.some((f) => f.status === 'accepted' || f.status === 'edited') ||
      diagnoses.some((d) => d.status === 'accepted') ||
      medications.some((m) => m.status === 'accepted')
    );
  }, [oasisFields, diagnoses, medications]);

  // Render document preview
  const renderDocumentPreview = () => {
    const isImage = document.mimeType.startsWith('image/');
    const isPdf = document.mimeType === 'application/pdf';

    if (isImage) {
      return (
        <div className="relative h-full overflow-auto bg-gray-100 rounded-lg">
          <div className="sticky top-0 z-10 flex items-center justify-end gap-2 p-2 bg-white border-b">
            <button
              type="button"
              onClick={() => setDocumentZoom((z) => Math.max(50, z - 25))}
              className="p-1 hover:bg-gray-100 rounded"
              title="Zoom out"
            >
              <ZoomOutIcon className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm text-gray-600">{documentZoom}%</span>
            <button
              type="button"
              onClick={() => setDocumentZoom((z) => Math.min(200, z + 25))}
              className="p-1 hover:bg-gray-100 rounded"
              title="Zoom in"
            >
              <ZoomInIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="p-4 flex justify-center">
            <img
              src={referralService.getDownloadUrl(document.id)}
              alt={document.originalFileName}
              style={{ width: `${documentZoom}%`, maxWidth: 'none' }}
              className="shadow-lg"
            />
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="h-full">
          <iframe
            src={`${referralService.getDownloadUrl(document.id)}#toolbar=1`}
            className="w-full h-full rounded-lg border"
            title={document.originalFileName}
          />
        </div>
      );
    }

    // For DOCX and other formats, show raw text
    return (
      <div className="h-full overflow-auto bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <DocumentTextIcon className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">{document.originalFileName}</span>
        </div>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {document.rawText || 'No text content available'}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="flex-shrink-0 p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-semibold text-gray-900">{stats.totalFields}</span>
              <span className="text-gray-500"> fields extracted</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="text-sm">
              <span className="font-semibold text-green-600">{stats.highConfidence}</span>
              <span className="text-gray-500"> high confidence</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="text-sm">
              <span className="font-semibold text-yellow-600">{stats.needsReview}</span>
              <span className="text-gray-500"> need review</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {stats.highConfidence > 0 && (
              <Button
                variant="secondary"
                                onClick={handleAcceptAllHighConfidence}
              >
                Accept All High Confidence ({stats.highConfidence})
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleApplyToAssessment}
              disabled={!hasAcceptedFields || isApplying}
              isLoading={isApplying}
            >
              Apply to Assessment
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex-shrink-0 p-4 pb-0">
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Main content - split screen */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left panel - Document preview */}
        <div className="lg:w-2/5 h-64 lg:h-auto flex-shrink-0 p-4 border-b lg:border-b-0 lg:border-r overflow-hidden">
          {renderDocumentPreview()}
        </div>

        {/* Right panel - Extracted data */}
        <div className="lg:w-3/5 flex-1 overflow-y-auto p-4">
          {/* Diagnoses Section */}
          {diagnoses.length > 0 && (
            <CollapsibleSection
              title="Diagnoses"
              icon={
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              count={diagnoses.length}
              acceptedCount={diagnoses.filter((d) => d.status === 'accepted').length}
              isExpanded={expandedSections['diagnoses'] || false}
              onToggle={() => toggleSection('diagnoses')}
              onAcceptAll={handleAcceptAllDiagnoses}
            >
              {diagnoses.map((dx, idx) => (
                <FieldRow
                  key={`dx-${idx}`}
                  field={{
                    key: `dx-${idx}`,
                    label: dx.isPrimary ? 'Primary Diagnosis' : 'Secondary Diagnosis',
                    value: `${dx.icdCode} - ${dx.description}`,
                    confidence: dx.confidence,
                    sourceText: dx.sourceText,
                    status: dx.status,
                  }}
                  onAccept={() => handleDiagnosisAccept(idx)}
                  onReject={() => handleDiagnosisReject(idx)}
                  onEdit={() => {}}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Medications Section */}
          {medications.length > 0 && (
            <CollapsibleSection
              title="Medications"
              icon={
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              }
              count={medications.length}
              acceptedCount={medications.filter((m) => m.status === 'accepted').length}
              isExpanded={expandedSections['medications'] || false}
              onToggle={() => toggleSection('medications')}
              onAcceptAll={handleAcceptAllMedications}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Name</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Dose</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Frequency</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-700">Route</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med, idx) => (
                      <tr
                        key={`med-${idx}`}
                        className={`border-b last:border-0 ${
                          med.status === 'accepted' ? 'bg-green-50' :
                          med.status === 'rejected' ? 'bg-red-50 opacity-60' : ''
                        }`}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            {med.status === 'accepted' && <CheckIcon className="w-4 h-4 text-green-600" />}
                            <span className={med.status === 'rejected' ? 'line-through' : ''}>{med.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">{med.dose || '-'}</td>
                        <td className="py-2 px-2">{med.frequency || '-'}</td>
                        <td className="py-2 px-2">{med.route || '-'}</td>
                        <td className="py-2 px-2 text-right">
                          {med.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleMedicationAccept(idx)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                title="Accept"
                              >
                                <CheckIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMedicationReject(idx)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Reject"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {med.status === 'accepted' && (
                            <button
                              type="button"
                              onClick={() => handleMedicationReject(idx)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                              title="Undo"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          )}
                          {med.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleMedicationAccept(idx)}
                              className="p-1 text-gray-400 hover:text-green-600 rounded"
                              title="Restore"
                            >
                              <CheckIcon className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* OASIS Fields Section */}
          {oasisFields.length > 0 && (
            <CollapsibleSection
              title="Clinical Findings (OASIS)"
              icon={
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
              count={oasisFields.length}
              acceptedCount={oasisFields.filter((f) => f.status === 'accepted' || f.status === 'edited').length}
              isExpanded={expandedSections['oasis'] || false}
              onToggle={() => toggleSection('oasis')}
              onAcceptAll={handleAcceptAllOasis}
            >
              {oasisFields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  onAccept={() => handleOasisAccept(field.key)}
                  onReject={() => handleOasisReject(field.key)}
                  onEdit={(newValue) => handleOasisEdit(field.key, newValue)}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Orders Section */}
          {extractedData?.orders && extractedData.orders.length > 0 && (
            <CollapsibleSection
              title="Orders"
              icon={
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              count={extractedData.orders.length}
              acceptedCount={0}
              isExpanded={expandedSections['orders'] || false}
              onToggle={() => toggleSection('orders')}
            >
              {extractedData.orders.map((order, idx) => (
                <div key={`order-${idx}`} className="p-3 bg-gray-50 rounded-lg mb-2">
                  <div className="font-medium text-gray-900">{order.discipline}</div>
                  {order.frequency && (
                    <div className="text-sm text-gray-600">Frequency: {order.frequency}</div>
                  )}
                  {order.duration && (
                    <div className="text-sm text-gray-600">Duration: {order.duration}</div>
                  )}
                  {order.specificOrders && order.specificOrders.length > 0 && (
                    <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                      {order.specificOrders.map((so, soIdx) => (
                        <li key={soIdx}>{so}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Empty state */}
          {oasisFields.length === 0 && diagnoses.length === 0 && medications.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No extracted data available for this document.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create assessment prompt modal */}
      <Modal
        isOpen={showCreateAssessmentPrompt}
        onClose={() => setShowCreateAssessmentPrompt(false)}
        title="Create Assessment"
              >
        <p className="text-gray-600 mb-4">
          No assessment is currently selected. Would you like to create a new assessment with the extracted data?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowCreateAssessmentPrompt(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateAndApply}>
            Create Assessment
          </Button>
        </div>
      </Modal>
    </div>
  );
}
