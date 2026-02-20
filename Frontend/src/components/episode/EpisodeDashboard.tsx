/**
 * EpisodeDashboard Component
 *
 * Overview dashboard for an episode showing:
 * - Episode header with certification dates
 * - Required assessments checklist
 * - Visit history timeline
 * - Progress summary
 * - Alerts and notifications
 */

import { useMemo } from 'react';
import { Alert, Badge, Spinner } from '@components/common';
import RequiredAssessments from './RequiredAssessments';
import VisitHistory from './VisitHistory';
import { useEpisodeDashboard } from '@hooks/useVisitNote';
import type { EpisodeDashboardData } from '@typedefs/index';

interface EpisodeDashboardProps {
  episodeId: string;
  onOpenAssessment?: (assessmentId?: string, type?: string) => void;
  onSelectVisit?: (visitId: string) => void;
  compact?: boolean;
}

// Icons
const CalendarIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const ClipboardIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const ChartBarIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const ExclamationIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(status: EpisodeDashboardData['status']) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'discharged':
      return <Badge variant="default">Discharged</Badge>;
    case 'on_hold':
      return <Badge variant="warning">On Hold</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function EpisodeDashboard({
  episodeId,
  onOpenAssessment,
  onSelectVisit,
  compact = false,
}: EpisodeDashboardProps) {
  const { data, isLoading, error } = useEpisodeDashboard(episodeId);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!data) return 0;
    const { completedVisits, totalVisits } = data.completionProgress;
    return totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title="Error loading episode">
        {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert variant="warning" title="Episode not found">
        Unable to load episode data.
      </Alert>
    );
  }

  // Compact view for embedding in other components
  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Episode {data.episodeNumber}</h3>
            <p className="text-sm text-gray-500">
              {formatDate(data.certificationPeriod.startDate)} -{' '}
              {formatDate(data.certificationPeriod.endDate)}
            </p>
          </div>
          {getStatusBadge(data.status)}
        </div>

        {/* Mini progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.slice(0, 2).map((alert: EpisodeDashboardData['alerts'][number], index: number) => (
              <div
                key={index}
                className={`flex items-center gap-2 text-xs p-2 rounded ${
                  alert.severity === 'high'
                    ? 'bg-red-50 text-red-700'
                    : alert.severity === 'medium'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-blue-50 text-blue-700'
                }`}
              >
                <ExclamationIcon className="w-4 h-4" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full dashboard view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">{data.patientName}</h2>
              {getStatusBadge(data.status)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Episode {data.episodeNumber}</p>
            {data.primaryDiagnosis && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Primary Dx:</span> {data.primaryDiagnosis}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarIcon className="w-4 h-4" />
              <span>
                {formatDate(data.certificationPeriod.startDate)} -{' '}
                {formatDate(data.certificationPeriod.endDate)}
              </span>
            </div>
            <p
              className={`text-sm mt-1 font-medium ${
                data.certificationPeriod.daysRemaining <= 7
                  ? 'text-red-600'
                  : data.certificationPeriod.daysRemaining <= 14
                    ? 'text-orange-600'
                    : 'text-gray-600'
              }`}
            >
              {data.certificationPeriod.daysRemaining} days remaining
            </p>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.alerts.map((alert: EpisodeDashboardData['alerts'][number], index: number) => (
              <Alert
                key={index}
                variant={
                  alert.severity === 'high'
                    ? 'error'
                    : alert.severity === 'medium'
                      ? 'warning'
                      : 'info'
                }
                title={alert.type.replace('_', ' ')}
              >
                {alert.message}
                {alert.actionRequired && (
                  <span className="block mt-1 font-medium">{alert.actionRequired}</span>
                )}
              </Alert>
            ))}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Total Visits</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {data.completionProgress.totalVisits}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ChartBarIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Completed</span>
          </div>
          <p className="text-2xl font-semibold text-green-600">
            {data.completionProgress.completedVisits}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ClipboardIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Scheduled</span>
          </div>
          <p className="text-2xl font-semibold text-blue-600">
            {data.completionProgress.scheduledVisits}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ClipboardIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Docs Pending</span>
          </div>
          <p className="text-2xl font-semibold text-orange-600">
            {data.completionProgress.documentsPending}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Required Assessments */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardIcon className="w-5 h-5 text-gray-400" />
            Required Assessments
          </h3>
          <RequiredAssessments
            assessments={data.requiredAssessments}
            onOpenAssessment={onOpenAssessment}
          />
        </div>

        {/* Visit History */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            Visit History
          </h3>
          <VisitHistory
            visits={data.visitHistory}
            onSelectVisit={onSelectVisit}
            maxVisible={5}
          />
        </div>
      </div>
    </div>
  );
}
