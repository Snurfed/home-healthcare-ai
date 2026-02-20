/**
 * VisitHistory Component
 *
 * Chronological timeline of visits for an episode.
 */

import { Badge } from '@components/common';
import { DISCIPLINE_LABELS, VISIT_PURPOSE_LABELS } from '@constants/visitFormConfig';
import type { VisitHistoryItem, Discipline, VisitPurpose } from '@typedefs/index';

interface VisitHistoryProps {
  visits: VisitHistoryItem[];
  onSelectVisit?: (visitId: string) => void;
  maxVisible?: number;
}

// Icons
const CheckCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ClockIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

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

const XCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const PlayIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

function getStatusConfig(status: VisitHistoryItem['status']) {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircleIcon,
        color: 'text-green-500',
        bgColor: 'bg-green-500',
        label: 'Completed',
      };
    case 'in_progress':
      return {
        icon: PlayIcon,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500',
        label: 'In Progress',
      };
    case 'scheduled':
      return {
        icon: CalendarIcon,
        color: 'text-gray-400',
        bgColor: 'bg-gray-400',
        label: 'Scheduled',
      };
    case 'missed':
      return {
        icon: XCircleIcon,
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        label: 'Missed',
      };
    case 'cancelled':
      return {
        icon: XCircleIcon,
        color: 'text-gray-400',
        bgColor: 'bg-gray-400',
        label: 'Cancelled',
      };
    default:
      return {
        icon: ClockIcon,
        color: 'text-gray-400',
        bgColor: 'bg-gray-400',
        label: status,
      };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function VisitHistory({
  visits,
  onSelectVisit,
  maxVisible = 10,
}: VisitHistoryProps) {
  const visibleVisits = visits.slice(0, maxVisible);
  const hiddenCount = visits.length - maxVisible;

  if (visits.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <CalendarIcon className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No visits scheduled</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {visibleVisits.map((visit, index) => {
          const config = getStatusConfig(visit.status);
          // StatusIcon is available as config.icon for future use
          const isFirst = index === 0;

          return (
            <button
              key={visit.id}
              onClick={() => onSelectVisit?.(visit.id)}
              className={`
                relative flex items-start gap-4 w-full text-left
                pl-10 pr-3 py-2 rounded-lg
                hover:bg-gray-50 transition-colors
                ${isFirst && visit.status === 'in_progress' ? 'bg-blue-50' : ''}
              `}
            >
              {/* Timeline dot */}
              <div
                className={`
                  absolute left-2.5 top-3 w-4 h-4 rounded-full
                  ${config.bgColor}
                  ring-2 ring-white
                `}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {DISCIPLINE_LABELS[visit.discipline as Discipline] || visit.discipline}
                    </span>
                    <span className="text-gray-400">-</span>
                    <span className="text-sm text-gray-600">
                      {VISIT_PURPOSE_LABELS[visit.visitPurpose as VisitPurpose] || visit.visitPurpose}
                    </span>
                  </div>
                  <Badge
                    variant={
                      visit.status === 'completed'
                        ? 'success'
                        : visit.status === 'in_progress'
                          ? 'info'
                          : visit.status === 'missed'
                            ? 'error'
                            : 'default'
                    }
                    size="sm"
                  >
                    {config.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatDate(visit.visitDate)}</span>
                  {visit.status !== 'scheduled' && <span>{formatTime(visit.visitDate)}</span>}
                  <span>- {visit.clinicianName}</span>
                </div>

                {/* Note status indicator */}
                {visit.noteStatus && visit.status !== 'scheduled' && (
                  <div className="mt-1.5">
                    <span
                      className={`
                        inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded
                        ${
                          visit.noteStatus === 'finalized'
                            ? 'bg-green-100 text-green-700'
                            : visit.noteStatus === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                        }
                      `}
                    >
                      {visit.noteStatus === 'finalized' ? (
                        <>
                          <CheckCircleIcon className="w-3 h-3" />
                          Note finalized
                        </>
                      ) : visit.noteStatus === 'in_progress' ? (
                        <>
                          <ClockIcon className="w-3 h-3" />
                          Note in progress
                        </>
                      ) : (
                        <>
                          <ClockIcon className="w-3 h-3" />
                          Note: {visit.noteStatus}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Show {hiddenCount} more visits
          </button>
        </div>
      )}
    </div>
  );
}
