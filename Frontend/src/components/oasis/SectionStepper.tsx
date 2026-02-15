/**
 * Section Stepper Component
 *
 * Smart progress navigator showing:
 * - Section completion status
 * - Required missing count
 * - Optional remaining count
 * - Visual indicators for each state
 */

import { useMemo } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import type { OASISSection, OASISAssessment, OASISQuestion, OASISResponse } from '@typedefs/index';

interface SectionStepperProps {
  sections: OASISSection[];
  currentIndex: number;
  assessment: OASISAssessment;
  questions?: OASISQuestion[];
  onSectionClick?: (index: number) => void;
}

interface SectionStats {
  total: number;
  requiredTotal: number;
  requiredComplete: number;
  requiredMissing: number;
  optionalTotal: number;
  optionalComplete: number;
  optionalRemaining: number;
  autoFilled: number;
  percentComplete: number;
}

function hasValue(response: Partial<OASISResponse> | undefined): boolean {
  if (!response) return false;
  return !!(
    response.responseValue ||
    response.responseCode ||
    response.responseText ||
    (response.responseNumeric !== undefined && response.responseNumeric !== null) ||
    response.responseDate
  );
}

export default function SectionStepper({
  sections,
  currentIndex,
  assessment,
  questions = [],
  onSectionClick,
}: SectionStepperProps) {
  const { navigateToSection } = useAssessmentStore();
  const draftResponses = useAssessmentStore((state) => state.draftResponses);

  const handleSectionClick = (index: number) => {
    navigateToSection(index);
    onSectionClick?.(index);
  };

  // Merge saved and draft responses
  const mergedResponses = useMemo(
    () => ({ ...assessment.responses, ...draftResponses }),
    [assessment.responses, draftResponses]
  );

  // Calculate detailed stats per section
  const sectionStats = useMemo(() => {
    const stats: Record<string, SectionStats> = {};

    sections.forEach((section) => {
      const sectionQuestions = questions.filter((q) => q.section === section.id);

      let requiredTotal = 0;
      let requiredComplete = 0;
      let optionalTotal = 0;
      let optionalComplete = 0;
      let autoFilled = 0;

      sectionQuestions.forEach((q) => {
        const response = mergedResponses[q.itemCode];
        const isComplete = hasValue(response);
        const isRequired = q.validationRules?.some((r) => r.ruleType === 'required');

        if (isRequired) {
          requiredTotal++;
          if (isComplete) requiredComplete++;
        } else {
          optionalTotal++;
          if (isComplete) optionalComplete++;
        }

        if (isComplete && response?.sourceType === 'system') {
          autoFilled++;
        }
      });

      const total = sectionQuestions.length;
      const totalComplete = requiredComplete + optionalComplete;
      const percentComplete = total > 0 ? Math.round((totalComplete / total) * 100) : 100;

      stats[section.id] = {
        total,
        requiredTotal,
        requiredComplete,
        requiredMissing: requiredTotal - requiredComplete,
        optionalTotal,
        optionalComplete,
        optionalRemaining: optionalTotal - optionalComplete,
        autoFilled,
        percentComplete,
      };
    });

    return stats;
  }, [sections, questions, mergedResponses]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    let totalRequired = 0;
    let completedRequired = 0;
    let completedSections = 0;

    sections.forEach((section) => {
      const stats = sectionStats[section.id];
      if (stats) {
        totalRequired += stats.requiredTotal;
        completedRequired += stats.requiredComplete;
        if (stats.requiredMissing === 0 && stats.requiredTotal > 0) {
          completedSections++;
        } else if (stats.total === 0) {
          completedSections++;
        }
      }
    });

    return {
      totalRequired,
      completedRequired,
      missingRequired: totalRequired - completedRequired,
      completedSections,
      percentComplete: totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 100,
    };
  }, [sections, sectionStats]);

  // Get section status
  const getSectionStatus = (section: OASISSection, index: number) => {
    const stats = sectionStats[section.id];
    if (!stats || stats.total === 0) {
      if (index === currentIndex) return 'current';
      return 'completed';
    }

    if (stats.requiredMissing === 0 && stats.requiredTotal > 0) {
      return 'completed';
    }
    if (index === currentIndex) return 'current';
    if (stats.requiredComplete > 0 || stats.optionalComplete > 0) {
      return 'in_progress';
    }
    if (stats.requiredMissing > 0) return 'needs_attention';
    return 'upcoming';
  };

  return (
    <div className="bg-white rounded-lg shadow-card overflow-hidden">
      {/* Header with overall progress */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Progress</h2>
          <span className="text-sm font-medium text-primary-600">
            {overallStats.percentComplete}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              overallStats.percentComplete === 100 ? 'bg-green-500' : 'bg-primary-600'
            }`}
            style={{ width: `${overallStats.percentComplete}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {overallStats.completedRequired} / {overallStats.totalRequired} required
          </span>
          {overallStats.missingRequired > 0 && (
            <span className="text-red-600 font-medium">
              {overallStats.missingRequired} missing
            </span>
          )}
        </div>
      </div>

      {/* Section list */}
      <nav aria-label="Assessment sections" className="p-2">
        <ol className="space-y-0.5">
          {sections.map((section, index) => {
            const status = getSectionStatus(section, index);
            const stats = sectionStats[section.id] || {
              total: 0,
              requiredTotal: 0,
              requiredComplete: 0,
              requiredMissing: 0,
              optionalTotal: 0,
              optionalComplete: 0,
              optionalRemaining: 0,
              autoFilled: 0,
              percentComplete: 100,
            };

            return (
              <li key={section.id}>
                <button
                  onClick={() => handleSectionClick(index)}
                  className={`
                    w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left
                    transition-all duration-200 text-sm group
                    ${
                      status === 'current'
                        ? 'bg-primary-50 ring-1 ring-primary-200'
                        : status === 'completed'
                          ? 'hover:bg-green-50'
                          : status === 'in_progress'
                            ? 'hover:bg-blue-50'
                            : status === 'needs_attention'
                              ? 'hover:bg-red-50'
                              : 'hover:bg-gray-50'
                    }
                  `}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {/* Status indicator */}
                  <span
                    className={`
                      flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                      text-xs font-semibold transition-colors
                      ${
                        status === 'current'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : status === 'needs_attention'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : status === 'needs_attention' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>

                  {/* Section info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <span
                      className={`block truncate font-medium ${
                        status === 'current'
                          ? 'text-primary-900'
                          : status === 'completed'
                            ? 'text-gray-700'
                            : status === 'needs_attention'
                              ? 'text-red-900'
                              : 'text-gray-600'
                      }`}
                    >
                      {section.name}
                    </span>

                    {/* Progress indicators */}
                    {stats.total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        {/* Required indicator */}
                        {stats.requiredTotal > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${
                              stats.requiredMissing > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                stats.requiredMissing > 0 ? 'bg-red-500' : 'bg-green-500'
                              }`}
                            />
                            {stats.requiredMissing > 0
                              ? `${stats.requiredMissing} required`
                              : `${stats.requiredComplete} required`}
                          </span>
                        )}

                        {/* Optional indicator */}
                        {stats.optionalTotal > 0 && stats.optionalRemaining > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                            {stats.optionalRemaining} optional
                          </span>
                        )}

                        {/* Auto-filled indicator */}
                        {stats.autoFilled > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {stats.autoFilled}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  {stats.total > 0 && (
                    <div className="flex-shrink-0 w-8 pt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            stats.requiredMissing === 0 ? 'bg-green-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${stats.percentComplete}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Required
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            Optional
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-filled
          </span>
        </div>
      </div>
    </div>
  );
}
