/**
 * Assessment Review Page
 *
 * Supervisor review interface for approving/rejecting assessments
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAssessment, useReviewAssessment } from '@hooks/index';
import { Button, Spinner, Alert, Badge, Modal } from '@components/common';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';
import { getErrorMessage } from '@services/index';

export default function AssessmentReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assessment, isLoading, error } = useAssessment(id);
  const reviewMutation = useReviewAssessment(id!);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading assessment..." />
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error" title="Error loading assessment">
          {error?.message || 'Assessment not found'}
        </Alert>
        <Link to="/assessments" className="mt-4 inline-block">
          <Button variant="secondary">Back to Assessments</Button>
        </Link>
      </div>
    );
  }

  if (assessment.status !== 'PENDING_REVIEW') {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="warning" title="Cannot review">
          This assessment is not pending review. Current status:{' '}
          {STATUS_CONFIG[assessment.status].label}
        </Alert>
        <Link to={`/assessments/${id}`} className="mt-4 inline-block">
          <Button variant="secondary">View Assessment</Button>
        </Link>
      </div>
    );
  }

  const handleApprove = async () => {
    setSubmitError(null);
    try {
      await reviewMutation.mutateAsync({
        approved: true,
        notes: reviewNotes || undefined,
      });
      setShowApproveModal(false);
      navigate(`/assessments/${id}`);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setSubmitError('Please provide a reason for rejection');
      return;
    }

    setSubmitError(null);
    try {
      await reviewMutation.mutateAsync({
        approved: false,
        correctionReason: rejectionReason,
      });
      setShowRejectModal(false);
      navigate(`/assessments/${id}`);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Review Assessment</h1>
            <Badge variant="status" status={assessment.status}>
              {STATUS_CONFIG[assessment.status].label}
            </Badge>
          </div>
          <p className="text-gray-500">
            {assessment.patient?.firstName} {assessment.patient?.lastName} -{' '}
            {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
          </p>
        </div>
        <Link to="/assessments">
          <Button variant="secondary">Back to List</Button>
        </Link>
      </div>

      {/* Review Actions */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold mb-4">Review Actions</h2>

        <div className="flex gap-4">
          <Button
            variant="primary"
            onClick={() => setShowApproveModal(true)}
            disabled={reviewMutation.isLoading}
          >
            Approve Assessment
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowRejectModal(true)}
            disabled={reviewMutation.isLoading}
          >
            Request Corrections
          </Button>
        </div>

        {/* Validation summary */}
        {assessment.validationErrors && assessment.validationErrors.length > 0 && (
          <Alert variant="warning" className="mt-4">
            This assessment has {assessment.validationErrors.length} validation
            error(s). Review before approving.
          </Alert>
        )}
      </div>

      {/* Assessment Summary */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold mb-4">Assessment Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Patient</dt>
            <dd className="font-medium">
              {assessment.patient?.firstName} {assessment.patient?.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">MRN</dt>
            <dd className="font-medium">{assessment.patient?.mrn}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Completion</dt>
            <dd className="font-medium">{assessment.completionPercentage}%</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Submitted By</dt>
            <dd className="font-medium">
              {assessment.clinician?.firstName} {assessment.clinician?.lastName}
            </dd>
          </div>
        </dl>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Assessment"
      >
        <div className="space-y-4">
          {submitError && <Alert variant="error">{submitError}</Alert>}

          <p className="text-gray-600">
            Are you sure you want to approve this assessment?
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="form-input"
              placeholder="Add any notes about this approval..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowApproveModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              isLoading={reviewMutation.isLoading}
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Request Corrections"
      >
        <div className="space-y-4">
          {submitError && <Alert variant="error">{submitError}</Alert>}

          <p className="text-gray-600">
            Please provide a reason for requesting corrections.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Corrections *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="form-input"
              placeholder="Describe what needs to be corrected..."
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={reviewMutation.isLoading}
            >
              Request Corrections
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
