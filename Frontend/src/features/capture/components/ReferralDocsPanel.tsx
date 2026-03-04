/**
 * Referral Documents Panel
 *
 * Upload and manage referral documents (PDFs, images, faxes).
 * Extracts text from documents using the capture API.
 */

import { useCallback, useRef, useState } from 'react';
import type { ReferralDocument, DocumentExtractionStatus } from '@/types/capture.types';
import { extractDocumentText } from '@/services/capture.service';

interface ReferralDocsPanelProps {
  documents: ReferralDocument[];
  onUpload: (document: ReferralDocument) => void;
  onUpdateDocument: (documentId: string, updates: Partial<ReferralDocument>) => void;
  onRemove: (documentId: string) => void;
  disabled?: boolean;
}

const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UploadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const statusConfig: Record<DocumentExtractionStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'text-gray-500 bg-gray-100', icon: '⏳' },
  processing: { label: 'Extracting...', color: 'text-blue-600 bg-blue-100', icon: '🔄' },
  complete: { label: 'Extracted', color: 'text-green-600 bg-green-100', icon: '✓' },
  error: { label: 'Error', color: 'text-red-600 bg-red-100', icon: '✗' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReferralDocsPanel({
  documents,
  onUpload,
  onUpdateDocument,
  onRemove,
  disabled,
}: ReferralDocsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const processDocument = useCallback(async (file: File, docId: string) => {
    // Mark as processing
    setProcessingIds(prev => new Set(prev).add(docId));
    onUpdateDocument(docId, { extractionStatus: 'processing' });

    try {
      const result = await extractDocumentText(file);

      if (result.success) {
        onUpdateDocument(docId, {
          extractionStatus: 'complete',
          extractedText: result.extractedText,
          pageCount: result.pageCount,
        });
        console.log(`[ReferralDocs] Extracted ${result.textLength || 0} chars from ${file.name}`);
      } else {
        onUpdateDocument(docId, {
          extractionStatus: 'error',
        });
        console.error(`[ReferralDocs] Extraction failed for ${file.name}:`, result.error);
      }
    } catch (error) {
      console.error(`[ReferralDocs] Extraction error for ${file.name}:`, error);
      onUpdateDocument(docId, {
        extractionStatus: 'error',
      });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }, [onUpdateDocument]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const doc: ReferralDocument = {
        id: docId,
        visitId: '', // Will be set by parent
        fileName: file.name,
        fileType: file.type.includes('pdf') ? 'pdf' : 'image',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractionStatus: 'pending',
      };
      onUpload(doc);

      // Start extraction
      processDocument(file, docId);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload, processDocument]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files.length) return;

    Array.from(files).forEach((file) => {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const doc: ReferralDocument = {
        id: docId,
        visitId: '',
        fileName: file.name,
        fileType: file.type.includes('pdf') ? 'pdf' : 'image',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractionStatus: 'pending',
      };
      onUpload(doc);

      // Start extraction
      processDocument(file, docId);
    });
  }, [onUpload, processDocument]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <DocumentIcon className="w-4 h-4" />
        Referral Documents
      </h3>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
        }`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        <UploadIcon className="w-6 h-6 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          Drop files or <span className="text-blue-600">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, images</p>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="mt-3 space-y-2">
          {documents.map((doc) => {
            const status = statusConfig[doc.extractionStatus];
            const isProcessing = processingIds.has(doc.id);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {doc.fileType === 'pdf' ? (
                    <span className="text-red-500">📄</span>
                  ) : (
                    <span className="text-blue-500">🖼️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.fileSize)}
                    {doc.extractedText && ` • ${doc.extractedText.length.toLocaleString()} chars extracted`}
                    {doc.pageCount && ` • ${doc.pageCount} page${doc.pageCount > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${status.color} ${isProcessing ? 'animate-pulse' : ''}`}>
                    {status.icon} {status.label}
                  </span>
                  <button
                    onClick={() => onRemove(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    disabled={disabled || isProcessing}
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          No documents uploaded
        </p>
      )}
    </div>
  );
}

export default ReferralDocsPanel;
