/**
 * Assessment Timeline Component
 *
 * Displays patient assessments grouped by 60-day episodes in a vertical timeline
 */

import { Link } from 'react-router-dom';
import { usePatientAssessmentTimeline } from '@hooks/index';
import { Badge, Spinner, Alert } from '@components/common';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';
import type { AssessmentStatus, AssessmentType } from '@typedefs/oasis.types';

interface AssessmentTimelineProps {
  patientId: string;
}

// Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format date range for episode header
function formatEpisodeDateRange(startDate: string, endDate: string | null): string {
  const start = formatDate(startDate);
  if (!endDate) {
    return `${start} - Present`;
  }
  return `${start} - ${formatDate(endDate)}`;
}

// Calculate days elapsed in episode
function calculateEpisodeDays(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Episode status badge variant
function getEpisodeStatusVariant(status: string): 'success' | 'warning' | 'default' | 'info' {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'COMPLETED':
      return 'info';
    default:
      return 'default';
  }
}

export default function AssessmentTimeline({ patientId }: AssessmentTimelineProps) {
  const { data, isLoading, error } = usePatientAssessmentTimeline(patientId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-500">Loading timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <Alert variant="error">Failed to load assessment timeline</Alert>
      </div>
    );
  }

  if (!data?.timeline || data.timeline.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Timeline</h2>
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-2 text-gray-500">No episodes or assessments found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Assessment Timeline</h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Episodes */}
        <div className="space-y-8">
          {data.timeline.map((episode, episodeIndex) => (
            <div key={episode.id} className="relative">
              {/* Episode marker */}
              <div className="absolute left-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center z-10">
                <span className="text-white text-xs font-bold">{episode.episodeNumber}</span>
              </div>

              {/* Episode content */}
              <div className="ml-12">
                {/* Episode header */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Episode {episode.episodeNumber}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatEpisodeDateRange(episode.startDate, episode.endDate)}
                      <span className="mx-2">·</span>
                      <span className="font-medium">
                        {calculateEpisodeDays(episode.startDate, episode.endDate)} days
                      </span>
                    </p>
                  </div>
                  <Badge variant={getEpisodeStatusVariant(episode.status)}>
                    {episode.status}
                  </Badge>
                </div>

                {/* Assessments in this episode */}
                {episode.assessments.length > 0 ? (
                  <div className="space-y-2 border-l-2 border-gray-100 pl-4 ml-2">
                    {episode.assessments.map((assessment) => (
                      <Link
                        key={assessment.id}
                        to={`/episode/${patientId}/${episode.id}`}
                        className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            {/* Status indicator dot */}
                            <div
                              className={`w-2 h-2 rounded-full ${
                                assessment.status === 'APPROVED' || assessment.status === 'LOCKED'
                                  ? 'bg-green-500'
                                  : assessment.status === 'PENDING_REVIEW'
                                  ? 'bg-yellow-500'
                                  : assessment.status === 'NEEDS_CORRECTION'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {ASSESSMENT_TYPE_LABELS[assessment.assessmentType as AssessmentType] ||
                                  assessment.assessmentType}
                              </p>
                              <p className="text-xs text-gray-500">
                                {assessment.clinician.firstName} {assessment.clinician.lastName}
                                <span className="mx-1">·</span>
                                {formatDate(assessment.createdAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* HIPPS code if available */}
                            {assessment.hippsCode && (
                              <span className="font-mono text-sm font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                {assessment.hippsCode}
                              </span>
                            )}

                            {/* Completion progress */}
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-primary-600 h-1.5 rounded-full"
                                  style={{ width: `${assessment.completionPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8">
                                {assessment.completionPercentage}%
                              </span>
                            </div>

                            {/* Status badge */}
                            <Badge
                              variant="status"
                              status={assessment.status as AssessmentStatus}
                            >
                              {STATUS_CONFIG[assessment.status as AssessmentStatus]?.label ||
                                assessment.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic ml-6">
                    No assessments in this episode
                  </p>
                )}
              </div>

              {/* Connector to next episode */}
              {episodeIndex < data.timeline.length - 1 && (
                <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
