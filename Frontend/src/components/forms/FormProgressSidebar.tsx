/**
 * Form Progress Sidebar
 *
 * Displays form completion progress and provides section navigation.
 */

import { useMemo } from 'react';
import type { BuiltSection, CanonicalValue, FormValidationState } from '@typedefs/index';

// =============================================================================
// ICONS
// =============================================================================

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface FormProgressSidebarProps {
  sections: BuiltSection[];
  responses: Record<string, CanonicalValue>;
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  overallProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  validationState: FormValidationState;
}

interface SectionProgress {
  sectionId: string;
  name: string;
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  hasErrors: boolean;
  isComplete: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function FormProgressSidebar({
  sections,
  responses,
  activeSection,
  onSectionClick,
  overallProgress,
  validationState,
}: FormProgressSidebarProps) {
  // Calculate progress for each section
  const sectionProgress = useMemo((): SectionProgress[] => {
    return sections
      .filter((section) => section.visible)
      .map((section) => {
        const visibleQuestions = section.questions.filter((q) => q.visible);
        const total = visibleQuestions.length;
        const completed = visibleQuestions.filter((q) => {
          const value = responses[q.conceptId];
          if (value === null || value === undefined) return false;
          if (typeof value === 'string' && value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        }).length;

        const requiredTotal = visibleQuestions.filter((q) => q.required).length;
        const requiredCompleted = visibleQuestions.filter((q) => {
          if (!q.required) return false;
          const value = responses[q.conceptId];
          if (value === null || value === undefined) return false;
          if (typeof value === 'string' && value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        }).length;

        const hasErrors = section.questions.some((q) => q.errors.length > 0);

        return {
          sectionId: section.sectionId,
          name: section.name,
          total,
          completed,
          requiredTotal,
          requiredCompleted,
          hasErrors,
          isComplete: requiredCompleted >= requiredTotal && !hasErrors,
        };
      });
  }, [sections, responses]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalErrors = validationState.errors.filter((e) => e.severity === 'error').length;
    const totalWarnings = validationState.warnings.length;
    const completedSections = sectionProgress.filter((s) => s.isComplete).length;

    return {
      totalErrors,
      totalWarnings,
      completedSections,
      totalSections: sectionProgress.length,
    };
  }, [validationState, sectionProgress]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Overall Progress */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Overall Progress</h3>

        {/* Progress circle */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke={validationState.canSubmit ? '#22c55e' : '#3b82f6'}
                strokeWidth="8"
                strokeDasharray={`${overallProgress.percentage * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">
                {overallProgress.percentage}%
              </span>
              <span className="text-xs text-gray-500">Complete</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-semibold text-gray-900">
              {overallProgress.completed}/{overallProgress.total}
            </div>
            <div className="text-xs text-gray-500">Questions</div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-semibold text-gray-900">
              {overallStats.completedSections}/{overallStats.totalSections}
            </div>
            <div className="text-xs text-gray-500">Sections</div>
          </div>
        </div>

        {/* Validation summary */}
        {(overallStats.totalErrors > 0 || overallStats.totalWarnings > 0) && (
          <div className="mt-3 space-y-1">
            {overallStats.totalErrors > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <WarningIcon className="w-4 h-4" />
                <span>{overallStats.totalErrors} error{overallStats.totalErrors !== 1 ? 's' : ''}</span>
              </div>
            )}
            {overallStats.totalWarnings > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <WarningIcon className="w-4 h-4" />
                <span>{overallStats.totalWarnings} warning{overallStats.totalWarnings !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section Navigation */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Sections</h3>
        <nav className="space-y-1">
          {sectionProgress.map((section) => {
            const isActive = activeSection === section.sectionId;
            const percentage =
              section.total > 0
                ? Math.round((section.completed / section.total) * 100)
                : 0;

            return (
              <button
                key={section.sectionId}
                type="button"
                onClick={() => onSectionClick(section.sectionId)}
                className={`
                  w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors
                  ${
                    isActive
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }
                `}
              >
                {/* Status icon */}
                <div
                  className={`
                    flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                    ${
                      section.hasErrors
                        ? 'bg-red-100 text-red-600'
                        : section.isComplete
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                    }
                  `}
                >
                  {section.hasErrors ? (
                    <WarningIcon className="w-3.5 h-3.5" />
                  ) : section.isComplete ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs font-medium">{percentage}%</span>
                  )}
                </div>

                {/* Section info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${
                      isActive ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {section.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {section.completed}/{section.total}
                    {section.requiredTotal > 0 && (
                      <span className="ml-1">
                        ({section.requiredCompleted}/{section.requiredTotal} req)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      section.hasErrors
                        ? 'bg-red-500'
                        : section.isComplete
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Submit readiness */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {validationState.canSubmit ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckIcon className="w-5 h-5" />
            <span className="font-medium">Ready to submit</span>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Complete all required fields to submit
          </div>
        )}
      </div>
    </div>
  );
}
