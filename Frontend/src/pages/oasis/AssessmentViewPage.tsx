/**
 * Assessment View Page
 *
 * Read-only view of a completed/locked assessment
 */

import { useParams, Link } from 'react-router-dom';
import { useAssessment } from '@hooks/index';
import { Button, Spinner, Alert, Badge } from '@components/common';
import { HIPPSCalculator } from '@components/oasis';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';

export default function AssessmentViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: assessment, isLoading, error } = useAssessment(id);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Assessment Details
            </h1>
            <Badge variant="status" status={assessment.status}>
              {STATUS_CONFIG[assessment.status].label}
            </Badge>
          </div>
          <p className="text-gray-500">
            {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/assessments">
            <Button variant="secondary">Back to List</Button>
          </Link>
          {assessment.status !== 'LOCKED' && (
            <Link to={`/assessments/${id}/edit`}>
              <Button variant="primary">Edit Assessment</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold mb-4">Patient Information</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="font-medium">
              {assessment.patient?.firstName} {assessment.patient?.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">MRN</dt>
            <dd className="font-medium">{assessment.patient?.mrn}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">DOB</dt>
            <dd className="font-medium">
              {assessment.patient?.dateOfBirth
                ? new Date(assessment.patient.dateOfBirth).toLocaleDateString()
                : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Episode</dt>
            <dd className="font-medium">#{assessment.episode?.episodeNumber}</dd>
          </div>
        </dl>
      </div>

      {/* Assessment Info */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold mb-4">Assessment Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Type</dt>
            <dd className="font-medium">
              {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <Badge variant="status" status={assessment.status}>
                {STATUS_CONFIG[assessment.status].label}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Completion</dt>
            <dd className="font-medium">{assessment.completionPercentage}%</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="font-medium">
              {new Date(assessment.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Last Updated</dt>
            <dd className="font-medium">
              {new Date(assessment.updatedAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Clinician</dt>
            <dd className="font-medium">
              {assessment.clinician?.firstName} {assessment.clinician?.lastName}
            </dd>
          </div>
          {assessment.reviewer && (
            <div>
              <dt className="text-sm text-gray-500">Reviewer</dt>
              <dd className="font-medium">
                {assessment.reviewer.firstName} {assessment.reviewer.lastName}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* HIPPS Calculator */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold mb-4">HIPPS Code & Reimbursement</h2>
        <HIPPSCalculator
          assessmentId={assessment.id}
          isLocked={assessment.status === 'LOCKED'}
        />
      </div>

      {/* Validation Errors */}
      {assessment.validationErrors && assessment.validationErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">
            Validation Errors ({assessment.validationErrors.length})
          </h2>
          <ul className="space-y-2">
            {assessment.validationErrors.slice(0, 10).map((err, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-red-500 font-medium">{err.itemCode}:</span>
                <span className="text-gray-600">{err.message}</span>
              </li>
            ))}
            {assessment.validationErrors.length > 10 && (
              <li className="text-sm text-gray-500">
                ...and {assessment.validationErrors.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
