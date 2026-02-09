/**
 * Referral Upload Component
 *
 * Upload referral documents with drag-drop support,
 * extraction status polling, and review transition
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Spinner, Alert, Modal, Select } from '@components/common';
import { referralService } from '@services/referral.service';
import type {
  ReferralDocumentType,
  ReferralDocument,
} from '@typedefs/index';
import { DOCUMENT_TYPE_LABELS } from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

interface ReferralUploadProps {
  patientId: string;
  assessmentId?: string;
  onUploadComplete: (document: ReferralDocument) => void;
  onExtractionComplete: (document: ReferralDocument) => void;
  onClose: () => void;
}

type UploadState =
  | 'idle'
  | 'selected'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error';

type ProcessingStage =
  | 'uploading'
  | 'extracting_text'
  | 'analyzing_ai'
  | 'complete';

const PROCESSING_STAGE_LABELS: Record<ProcessingStage, string> = {
  uploading: 'Uploading document...',
  extracting_text: 'Extracting text...',
  analyzing_ai: 'Analyzing with AI...',
  complete: 'Complete!',
};

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/tiff',
];

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif';

const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

// ===========================================
// ICONS
// ===========================================

const DocumentIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const UploadCloudIcon = ({ className = 'w-12 h-12' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const XCircleIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isValidFileType(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

// ===========================================
// COMPONENT
// ===========================================

export default function ReferralUpload({
  patientId,
  onUploadComplete,
  onExtractionComplete,
  onClose,
}: ReferralUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('uploading');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<ReferralDocumentType>('REFERRAL');
  const [error, setError] = useState<string | null>(null);
  const [, setUploadedDocument] = useState<ReferralDocument | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!isValidFileType(file)) {
      setError(`Unsupported file type: ${file.type}. Please upload PDF, DOCX, JPG, PNG, or TIFF.`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setState('selected');
  }, []);

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Poll extraction status
  const pollExtractionStatus = useCallback(
    async (documentId: string) => {
      try {
        const status = await referralService.getExtractionStatus(documentId);

        if (status.isComplete) {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Fetch full document with extracted data
          const fullDocument = await referralService.getReferral(documentId);
          setUploadedDocument(fullDocument);
          setProcessingStage('complete');
          setState('complete');

          // Trigger callback after short delay to show complete state
          setTimeout(() => {
            onExtractionComplete(fullDocument);
          }, 1000);
        } else if (status.isFailed) {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setError(status.extractionError || 'Extraction failed. Please try again.');
          setState('error');
        } else if (status.isProcessing) {
          // Update stage based on time elapsed (approximate)
          setProcessingStage('analyzing_ai');
        }
      } catch (err) {
        console.error('Error polling extraction status:', err);
      }
    },
    [onExtractionComplete]
  );

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setState('uploading');
    setProcessingStage('uploading');
    setError(null);

    try {
      // Upload the file
      const document = await referralService.uploadReferral(
        patientId,
        selectedFile,
        documentType
      );

      setUploadedDocument(document);
      onUploadComplete(document);

      // Check if extraction already started
      if (
        document.extractionStatus === 'PROCESSING' ||
        document.extractionStatus === 'PENDING'
      ) {
        setState('processing');
        setProcessingStage('extracting_text');

        // Start polling for extraction status
        pollingIntervalRef.current = setInterval(() => {
          pollExtractionStatus(document.id);
        }, 2000);
      } else if (document.extractionStatus === 'COMPLETED') {
        // Already complete
        setProcessingStage('complete');
        setState('complete');
        setTimeout(() => {
          onExtractionComplete(document);
        }, 1000);
      } else if (document.extractionStatus === 'FAILED') {
        setError('Extraction failed. Please try again.');
        setState('error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('error');
    }
  };

  // Handle retry
  const handleRetry = () => {
    setState('selected');
    setError(null);
    setProcessingStage('uploading');
    setUploadedDocument(null);
  };

  // Handle reset
  const handleReset = () => {
    setState('idle');
    setSelectedFile(null);
    setError(null);
    setProcessingStage('uploading');
    setUploadedDocument(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Render drop zone content based on state
  const renderDropZone = () => {
    if (state === 'uploading' || state === 'processing') {
      return (
        <div className="text-center py-8">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {PROCESSING_STAGE_LABELS[processingStage]}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {(['uploading', 'extracting_text', 'analyzing_ai', 'complete'] as ProcessingStage[]).map(
              (stage, index) => (
                <div
                  key={stage}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index <=
                    ['uploading', 'extracting_text', 'analyzing_ai', 'complete'].indexOf(
                      processingStage
                    )
                      ? 'bg-primary-600'
                      : 'bg-gray-200'
                  }`}
                />
              )
            )}
          </div>
        </div>
      );
    }

    if (state === 'complete') {
      return (
        <div className="text-center py-8">
          <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <p className="text-lg font-medium text-green-700">Extraction Complete!</p>
          <p className="text-sm text-gray-500 mt-2">
            Opening review panel...
          </p>
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="text-center py-8">
          <XCircleIcon className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <p className="text-lg font-medium text-red-700">Upload Failed</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={handleReset}>
              Select Different File
            </Button>
            <Button variant="primary" onClick={handleRetry}>
              Retry Upload
            </Button>
          </div>
        </div>
      );
    }

    if (state === 'selected' && selectedFile) {
      return (
        <div className="text-center py-8">
          <DocumentIcon className="w-16 h-16 mx-auto text-primary-500 mb-4" />
          <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
          <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 text-sm text-primary-600 hover:text-primary-700 underline"
          >
            Select different file
          </button>
        </div>
      );
    }

    // Idle state - show drop zone
    return (
      <div className="text-center py-8">
        <UploadCloudIcon
          className={`w-16 h-16 mx-auto mb-4 transition-colors ${
            isDragOver ? 'text-primary-500' : 'text-gray-400'
          }`}
        />
        <p className="text-lg font-medium text-gray-900">
          Drag & drop your document here
        </p>
        <p className="text-sm text-gray-500 mt-1">or</p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Files
        </Button>
        <p className="text-xs text-gray-400 mt-4">
          Supported formats: PDF, DOCX, JPG, PNG, TIFF (max 50MB)
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Error alert */}
      {error && state !== 'error' && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Select file to upload"
      />

      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg transition-colors
          ${isDragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'}
          ${state === 'idle' || state === 'selected' ? 'cursor-pointer hover:border-primary-400' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (state === 'idle') {
            fileInputRef.current?.click();
          }
        }}
      >
        {renderDropZone()}
      </div>

      {/* Document type selector */}
      {(state === 'idle' || state === 'selected') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Document Type
          </label>
          <Select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as ReferralDocumentType)}
            options={DOCUMENT_TYPE_OPTIONS}
          />
        </div>
      )}

      {/* Action buttons */}
      {state === 'selected' && selectedFile && (
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            leftIcon={<UploadCloudIcon className="w-5 h-5" />}
          >
            Upload & Extract
          </Button>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ===========================================
// UPLOAD BUTTON (for use in wizard)
// ===========================================

interface ReferralUploadButtonProps {
  patientId: string;
  assessmentId?: string;
  onExtractionComplete: (document: ReferralDocument) => void;
}

export function ReferralUploadButton({
  patientId,
  assessmentId,
  onExtractionComplete,
}: ReferralUploadButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setUploadedDocument] = useState<ReferralDocument | null>(null);

  const handleUploadComplete = (document: ReferralDocument) => {
    setUploadedDocument(document);
  };

  const handleExtractionComplete = (document: ReferralDocument) => {
    setIsModalOpen(false);
    onExtractionComplete(document);
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsModalOpen(true)}
        leftIcon={<DocumentIcon className="w-5 h-5" />}
      >
        Upload Referral
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Referral Document"
        size="lg"
        closeOnOverlayClick={false}
      >
        <ReferralUpload
          patientId={patientId}
          assessmentId={assessmentId}
          onUploadComplete={handleUploadComplete}
          onExtractionComplete={handleExtractionComplete}
          onClose={() => setIsModalOpen(false)}
        />
      </Modal>
    </>
  );
}
