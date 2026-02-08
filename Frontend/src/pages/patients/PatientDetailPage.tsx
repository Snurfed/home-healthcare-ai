/**
 * Patient Detail Page
 *
 * Displays detailed patient information, episodes, and assessments
 */

import { Link, useParams } from 'react-router-dom';
import { usePatient, usePatientEpisodes, useAssessments } from '@hooks/index';
import { Button, Badge, Spinner, Alert } from '@components/common';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';
import AssessmentTimeline from '@components/patients/AssessmentTimeline';

// Patient status configuration
const PATIENT_STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'success' as const },
  INACTIVE: { label: 'Inactive', color: 'default' as const },
  DISCHARGED: { label: 'Discharged', color: 'info' as const },
  PENDING: { label: 'Pending', color: 'warning' as const },
  DECEASED: { label: 'Deceased', color: 'error' as const },
};

// Gender display labels
const GENDER_LABELS = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Not Specified',
};

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Format phone number
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Format date
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading, error } = usePatient(id);
  const { data: episodes } = usePatientEpisodes(id);
  const { data: assessments } = useAssessments({ patientId: id, limit: 5 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">Patient not found or failed to load.</Alert>
        <div className="mt-4">
          <Link to="/patients">
            <Button variant="secondary">Back to Patients</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/patients"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-bold text-xl">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {patient.lastName}, {patient.firstName}
                  {patient.middleName ? ` ${patient.middleName}` : ''}
                </h1>
                <Badge variant={PATIENT_STATUS_CONFIG[patient.status].color}>
                  {PATIENT_STATUS_CONFIG[patient.status].label}
                </Badge>
              </div>
              <p className="text-gray-500">
                MRN: {patient.mrn} | {GENDER_LABELS[patient.gender]} |{' '}
                {calculateAge(patient.dateOfBirth)} years old
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/patients/${id}/edit`}>
            <Button variant="secondary">Edit Patient</Button>
          </Link>
          <Link to={`/assessments/new?patientId=${id}`}>
            <Button variant="primary">New Assessment</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Information
            </h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="text-gray-900">{formatPhone(patient.phoneMobile)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                <dd className="text-gray-900">{formatDate(patient.dateOfBirth)}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="text-gray-900">
                  {patient.addressCity}, {patient.addressState}
                </dd>
              </div>
              {patient.primaryPhysicianName && (
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    Primary Physician
                  </dt>
                  <dd className="text-gray-900">Dr. {patient.primaryPhysicianName}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Episodes */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Episodes</h2>
              <Link to={`/assessments/new?patientId=${id}`}>
                <Button variant="secondary" size="sm">
                  New Episode
                </Button>
              </Link>
            </div>
            {episodes?.data && episodes.data.length > 0 ? (
              <div className="space-y-3">
                {episodes.data.map((episode) => (
                  <div
                    key={episode.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        Episode #{episode.episodeNumber || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(episode.startDate)} -{' '}
                        {episode.endDate ? formatDate(episode.endDate) : 'Present'}
                      </p>
                    </div>
                    <Badge
                      variant={episode.status === 'ACTIVE' ? 'success' : 'default'}
                    >
                      {episode.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No episodes found</p>
            )}
          </div>

          {/* Recent Assessments */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Assessments
              </h2>
              <Link to={`/assessments?patientId=${id}`}>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {assessments?.data && assessments.data.length > 0 ? (
              <div className="space-y-3">
                {assessments.data.map((assessment) => (
                  <Link
                    key={assessment.id}
                    to={
                      assessment.status === 'LOCKED'
                        ? `/assessments/${assessment.id}`
                        : `/assessments/${assessment.id}/edit`
                    }
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
                      </p>
                      <p className="text-sm text-gray-500">
                        Updated {formatDate(assessment.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${assessment.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {assessment.completionPercentage}%
                        </span>
                      </div>
                      <Badge variant="status" status={assessment.status}>
                        {STATUS_CONFIG[assessment.status].label}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No assessments yet</p>
                <Link to={`/assessments/new?patientId=${id}`}>
                  <Button variant="primary" size="sm" className="mt-2">
                    Start Assessment
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Assessment Timeline */}
          <AssessmentTimeline patientId={id!} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Stats
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Assessments</span>
                <span className="font-semibold text-gray-900">
                  {patient._count?.assessments || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Visits</span>
                <span className="font-semibold text-gray-900">
                  {patient._count?.visits || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Episodes</span>
                <span className="font-semibold text-gray-900">
                  {episodes?.data?.length || 0}
                </span>
              </div>
              {patient.admissionDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Admitted</span>
                  <span className="font-semibold text-gray-900">
                    {formatDate(patient.admissionDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link to={`/assessments/new?patientId=${id}`} className="block">
                <Button variant="primary" className="w-full justify-start">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  New Assessment
                </Button>
              </Link>
              <Link to={`/patients/${id}/edit`} className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Patient Info
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Discharge Patient
              </Button>
            </div>
          </div>

          {/* Record Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">
              Created: {formatDate(patient.createdAt)}
            </p>
            <p className="text-xs text-gray-500">
              Last Updated: {formatDate(patient.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
