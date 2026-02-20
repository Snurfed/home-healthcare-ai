/**
 * RequiredAssessments Component
 *
 * Displays required OASIS assessments for an episode
 * with status indicators and due dates.
 */

import { Badge } from '@components/common';
import type { RequiredAssessment } from '@typedefs/index';

interface RequiredAssessmentsProps {
  assessments: RequiredAssessment[];
  onOpenAssessment?: (assessmentId?: string, type?: string) => void;
}

// Icons
const ClipboardCheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
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

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  SOC: 'Start of Care',
  ROC: 'Resumption of Care',
  RECERT: 'Recertification',
  DISCHARGE: 'Discharge',
  TRANSFER: 'Transfer',
};

function getStatusConfig(status: RequiredAssessment['status']) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        variant: 'success' as const,
        icon: ClipboardCheckIcon,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        variant: 'info' as const,
        icon: ClockIcon,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      };
    case 'overdue':
      return {
        label: 'Overdue',
        variant: 'error' as const,
        icon: ExclamationIcon,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        variant: 'warning' as const,
        icon: ClockIcon,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function RequiredAssessments({
  assessments,
  onOpenAssessment,
}: RequiredAssessmentsProps) {
  if (assessments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <ClipboardCheckIcon className="w-8 h-8 mx-auto mb-2 text-green-500" />
        <p className="text-sm">All required assessments complete</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assessments.map((assessment, index) => {
        const config = getStatusConfig(assessment.status);
        const daysUntil = getDaysUntil(assessment.dueDate);
        const StatusIcon = config.icon;

        return (
          <button
            key={`${assessment.type}-${index}`}
            onClick={() => onOpenAssessment?.(assessment.assessmentId, assessment.type)}
            className={`
              w-full flex items-center justify-between p-3 rounded-lg border
              ${config.bgColor} ${config.borderColor}
              hover:shadow-sm transition-shadow text-left
            `}
          >
            <div className="flex items-center gap-3">
              <StatusIcon
                className={`w-5 h-5 ${
                  assessment.status === 'completed'
                    ? 'text-green-600'
                    : assessment.status === 'overdue'
                      ? 'text-red-600'
                      : assessment.status === 'in_progress'
                        ? 'text-blue-600'
                        : 'text-yellow-600'
                }`}
              />
              <div>
                <p className="font-medium text-gray-900">
                  {ASSESSMENT_TYPE_LABELS[assessment.type] || assessment.type}
                </p>
                <p className="text-xs text-gray-500">
                  {assessment.status === 'completed'
                    ? `Completed ${formatDate(assessment.completedAt!)}`
                    : `Due ${formatDate(assessment.dueDate)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {assessment.status !== 'completed' && (
                <span
                  className={`text-xs ${
                    daysUntil < 0
                      ? 'text-red-600 font-semibold'
                      : daysUntil <= 3
                        ? 'text-orange-600'
                        : 'text-gray-500'
                  }`}
                >
                  {daysUntil < 0
                    ? `${Math.abs(daysUntil)} days overdue`
                    : daysUntil === 0
                      ? 'Due today'
                      : daysUntil === 1
                        ? 'Due tomorrow'
                        : `${daysUntil} days`}
                </span>
              )}
              <Badge variant={config.variant} size="sm">
                {config.label}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
