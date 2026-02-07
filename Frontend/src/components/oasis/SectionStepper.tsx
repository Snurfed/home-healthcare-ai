/**
 * Section Stepper Component
 *
 * Navigation sidebar for OASIS assessment sections
 */

import { useMemo } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import type { OASISSection, OASISAssessment, OASISQuestion } from '@typedefs/index';

interface SectionStepperProps {
  sections: OASISSection[];
  currentIndex: number;
  assessment: OASISAssessment;
  questions?: OASISQuestion[];
  onSectionClick?: (index: number) => void;
}

export default function SectionStepper({
  sections,
  currentIndex,
  assessment,
  questions = [],
  onSectionClick,
}: SectionStepperProps) {
  const { navigateToSection } = useAssessmentStore();

  const handleSectionClick = (index: number) => {
    navigateToSection(index);
    onSectionClick?.(index);
  };

  // Calculate question counts per section
  const sectionQuestionCounts = useMemo(() => {
    const counts: Record<string, { total: number; answered: number }> = {};

    sections.forEach(section => {
      const sectionQuestions = questions.filter(q => q.section === section.id);
      const answeredCount = sectionQuestions.filter(q => {
        const response = assessment.responses?.[q.itemCode];
        return response?.responseValue || response?.responseCode || response?.responseText;
      }).length;

      counts[section.id] = {
        total: sectionQuestions.length,
        answered: answeredCount,
      };
    });

    return counts;
  }, [sections, questions, assessment.responses]);

  // Calculate section completion based on actual responses
  const getSectionStatus = (section: OASISSection, index: number) => {
    const counts = sectionQuestionCounts[section.id];
    if (!counts || counts.total === 0) {
      // No questions in this section
      if (index === currentIndex) return 'current';
      return index < currentIndex ? 'completed' : 'upcoming';
    }

    if (counts.answered === counts.total && counts.total > 0) {
      return 'completed';
    }
    if (index === currentIndex) {
      return 'current';
    }
    if (counts.answered > 0) {
      return 'in_progress';
    }
    return 'upcoming';
  };

  return (
    <div className="bg-white rounded-lg shadow-card p-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Sections
      </h2>

      <nav aria-label="Assessment sections">
        <ol className="space-y-1">
          {sections.map((section, index) => {
            const status = getSectionStatus(section, index);
            const counts = sectionQuestionCounts[section.id] || { total: 0, answered: 0 };

            return (
              <li key={section.id}>
                <button
                  onClick={() => handleSectionClick(index)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-left
                    transition-colors text-sm
                    ${
                      status === 'current'
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : status === 'completed'
                        ? 'text-gray-700 hover:bg-gray-50'
                        : status === 'in_progress'
                        ? 'text-blue-700 hover:bg-blue-50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }
                  `}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {/* Status indicator */}
                  <span
                    className={`
                      flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                      text-xs font-medium
                      ${
                        status === 'current'
                          ? 'bg-primary-600 text-white'
                          : status === 'completed'
                          ? 'bg-green-100 text-green-600'
                          : status === 'in_progress'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-200 text-gray-500'
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
                    ) : (
                      index + 1
                    )}
                  </span>

                  {/* Section name and count */}
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{section.name}</span>
                    {counts.total > 0 && (
                      <span className="text-xs text-gray-400">
                        {counts.answered}/{counts.total} answered
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Sections completed</span>
            <span>
              {currentIndex} / {sections.length}
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all"
              style={{
                width: `${(currentIndex / sections.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
