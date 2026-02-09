/**
 * Referral Documents List Component
 *
 * Displays all referral documents for a patient with status and actions
 */

import { useState } from 'react';
import { Button, Spinner, Badge, Alert, Modal } from '@components/common';
import { referralService } from '@services/referral.service';
import ReferralExtractionReview from './ReferralExtractionReview';
import type {
  ReferralListItem,
  ReferralDocument,
  ExtractionStatus,
} from '@typedefs/index';
import { DOCUMENT_TYPE_LABELS, EXTRACTION_STATUS_CONFIG } from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

interface ReferralDocumentsListProps {
  patientId: string; // Used for context, passed to child components
  referrals: ReferralListItem[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onApplyComplete?: (appliedFields: number, assessmentId: string) => void;
  onCreateAssessment?: () => Promise<string>;
  currentAssessmentId?: string;
}

// Map extraction status to Badge variant
function getStatusBadgeVariant(status: ExtractionStatus): 'warning' | 'info' | 'success' | 'error' {
  const variantMap: Record<ExtractionStatus, 'warning' | 'info' | 'success' | 'error'> = {
    PENDING: 'warning',
    PROCESSING: 'info',
    COMPLETED: 'success',
    FAILED: 'error',
  };
  return variantMap[status];
}

// ===========================================
// ICONS
// ===========================================

const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const EyeIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const RefreshIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const DownloadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const TrashIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}


// ===========================================
// COMPONENT
// ===========================================

export default function ReferralDocumentsList({
  referrals,
  isLoading,
  error,
  onRefresh,
  onApplyComplete,
  onCreateAssessment,
  currentAssessmentId,
}: ReferralDocumentsListProps) {
  const [selectedReferral, setSelectedReferral] = useState<ReferralDocument | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [loadingReferralId, setLoadingReferralId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Open extraction review for a referral
  const handleViewExtraction = async (referral: ReferralListItem) => {
    setLoadingReferralId(referral.id);
    setActionError(null);

    try {
      const fullDocument = await referralService.getReferral(referral.id);
      setSelectedReferral(fullDocument);
      setIsReviewModalOpen(true);
    } catch (err) {
      console.error('Error fetching referral:', err);
      setActionError('Failed to load referral document. Please try again.');
    } finally {
      setLoadingReferralId(null);
    }
  };

  // Re-process extraction
  const handleReprocess = async (referralId: string) => {
    setLoadingReferralId(referralId);
    setActionError(null);

    try {
      await referralService.triggerExtraction(referralId);
      onRefresh();
    } catch (err) {
      console.error('Error triggering extraction:', err);
      setActionError('Failed to re-process document. Please try again.');
    } finally {
      setLoadingReferralId(null);
    }
  };

  // Download original document
  const handleDownload = (referralId: string) => {
    const url = referralService.getDownloadUrl(referralId);
    window.open(url, '_blank');
  };

  // Delete referral
  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      await referralService.deleteReferral(deleteConfirmId);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err) {
      console.error('Error deleting referral:', err);
      setActionError('Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle apply complete from review
  const handleApplyComplete = (appliedFields: number, assessmentId: string) => {
    setIsReviewModalOpen(false);
    setSelectedReferral(null);
    onApplyComplete?.(appliedFields, assessmentId);
  };

  // Render loading state
  if (isLoading && referrals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Render error state
  if (error && referrals.length === 0) {
    return (
      <Alert variant="error">
        {error}
        <Button variant="ghost" size="sm" onClick={onRefresh} className="ml-2">
          Retry
        </Button>
      </Alert>
    );
  }

  // Render empty state
  if (referrals.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
        <DocumentIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Referral Documents</h3>
        <p className="text-gray-500">
          Upload a referral document to automatically extract clinical data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action error */}
      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Documents list */}
      <div className="bg-white rounded-lg border divide-y">
        {referrals.map((referral) => (
          <div
            key={referral.id}
            className="p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Document info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
                  <DocumentIcon className="w-6 h-6 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 truncate">
                      {referral.originalFileName}
                    </h4>
                    <Badge
                      variant={getStatusBadgeVariant(referral.extractionStatus)}
                                          >
                      {referral.extractionStatus === 'PROCESSING' && (
                        <Spinner size="sm" className="mr-1" />
                      )}
                      {EXTRACTION_STATUS_CONFIG[referral.extractionStatus]?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>{DOCUMENT_TYPE_LABELS[referral.documentType]}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatFileSize(referral.fileSize)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatDate(referral.createdAt)}</span>
                    {referral.uploadedBy && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>
                          {referral.uploadedBy.firstName} {referral.uploadedBy.lastName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* View extraction - only if completed */}
                {referral.extractionStatus === 'COMPLETED' && (
                  <Button
                    variant="ghost"
                                        onClick={() => handleViewExtraction(referral)}
                    isLoading={loadingReferralId === referral.id}
                    title="View Extraction"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </Button>
                )}

                {/* Re-process - only if failed or needs re-processing */}
                {(referral.extractionStatus === 'FAILED' ||
                  referral.extractionStatus === 'PENDING') && (
                  <Button
                    variant="ghost"
                                        onClick={() => handleReprocess(referral.id)}
                    isLoading={loadingReferralId === referral.id}
                    title="Re-process"
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </Button>
                )}

                {/* Download */}
                <Button
                  variant="ghost"
                                    onClick={() => handleDownload(referral.id)}
                  title="Download Original"
                >
                  <DownloadIcon className="w-4 h-4" />
                </Button>

                {/* Delete */}
                <Button
                  variant="ghost"
                                    onClick={() => setDeleteConfirmId(referral.id)}
                  className="text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Extraction review modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedReferral(null);
        }}
        title="Review Extracted Data"
        size="xl"
        closeOnOverlayClick={false}
      >
        {selectedReferral && (
          <div className="h-[70vh]">
            <ReferralExtractionReview
              document={selectedReferral}
              assessmentId={currentAssessmentId}
              onApplyComplete={handleApplyComplete}
              onClose={() => {
                setIsReviewModalOpen(false);
                setSelectedReferral(null);
              }}
              onCreateAssessment={onCreateAssessment}
            />
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Document"
              >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete this document? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirmId(null)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
