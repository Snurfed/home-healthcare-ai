/**
 * Section Content Component
 *
 * Displays questions for the current OASIS section
 * Works with auto-save - no manual save on navigation
 * Applies skip logic to conditionally show/hide questions
 */

import { useMemo } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { useSkipLogic } from '@hooks/index';
import { Button } from '@components/common';
import QuestionRenderer from './QuestionRenderer';
import type { OASISSection, OASISAssessment, OASISQuestion } from '@typedefs/index';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';

interface SectionContentProps {
  section: OASISSection;
  assessment: OASISAssessment;
  questions: OASISQuestion[];
}

export default function SectionContent({
  section,
  assessment,
  questions,
}: SectionContentProps) {
  const {
    draftResponses,
    updateResponse,
    currentSectionIndex,
    nextSection,
    previousSection,
  } = useAssessmentStore();

  // Filter questions for this section
  const sectionQuestions = useMemo(() => {
    return questions
      .filter((q) => q.section === section.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [questions, section.id]);

  // Apply skip logic to filter visible questions
  const { visibleQuestions, hiddenCount, totalQuestions } = useSkipLogic({
    questions: sectionQuestions,
    savedResponses: assessment.responses,
    draftResponses,
  });

  // Get response value (merged from assessment and draft)
  const getResponseValue = (itemCode: string) => {
    const draft = draftResponses[itemCode];
    const saved = assessment.responses?.[itemCode];
    return draft || saved;
  };

  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === OASIS_SECTIONS.length - 1;

  return (
    <div className="bg-white rounded-lg shadow-card">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-gray-500">
            {visibleQuestions.length} of {totalQuestions} questions
          </p>
          {hiddenCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              {hiddenCount} skipped
            </span>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="p-6 space-y-8">
        {visibleQuestions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              {totalQuestions > 0
                ? 'All questions in this section have been skipped based on previous answers.'
                : 'No questions available for this section with the current assessment type.'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Section: {section.id}
            </p>
          </div>
        ) : (
          visibleQuestions.map((question) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              value={getResponseValue(question.itemCode)}
              onChange={(value) =>
                updateResponse(question.itemCode, {
                  ...value,
                  itemCode: question.itemCode,
                  sourceType: 'manual',
                })
              }
            />
          ))
        )}
      </div>

      {/* Navigation - Auto-save handles saving automatically */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={previousSection}
          disabled={isFirstSection}
        >
          Previous Section
        </Button>

        <div className="text-sm text-gray-500">
          Section {currentSectionIndex + 1} of {OASIS_SECTIONS.length}
        </div>

        <Button
          variant="primary"
          onClick={nextSection}
          disabled={isLastSection}
        >
          {isLastSection ? 'Last Section' : 'Next Section'}
        </Button>
      </div>
    </div>
  );
}
