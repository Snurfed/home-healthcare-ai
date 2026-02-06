/**
 * Section Content Component
 *
 * Displays questions for the current OASIS section
 */

import { useMemo } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { useUpdateAssessment } from '@hooks/index';
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
    isDirty,
  } = useAssessmentStore();

  const updateMutation = useUpdateAssessment(assessment.id);

  // Filter questions for this section
  const sectionQuestions = useMemo(() => {
    return questions
      .filter((q) => q.section === section.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [questions, section.id]);

  // Get response value (merged from assessment and draft)
  const getResponseValue = (itemCode: string) => {
    const draft = draftResponses[itemCode];
    const saved = assessment.responses?.[itemCode];
    return draft || saved;
  };

  // Handle save
  const handleSave = async () => {
    if (!isDirty || Object.keys(draftResponses).length === 0) return;

    await updateMutation.mutateAsync({
      section: section.id,
      items: draftResponses,
    });
  };

  // Handle next with save
  const handleNext = async () => {
    if (isDirty) {
      await handleSave();
    }
    nextSection();
  };

  // Handle previous with save
  const handlePrevious = async () => {
    if (isDirty) {
      await handleSave();
    }
    previousSection();
  };

  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === OASIS_SECTIONS.length - 1;

  return (
    <div className="bg-white rounded-lg shadow-card">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {sectionQuestions.length} questions in this section
        </p>
      </div>

      {/* Questions */}
      <div className="p-6 space-y-8">
        {sectionQuestions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">
              No questions available for this section with the current assessment type.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Section: {section.id}
            </p>
          </div>
        ) : (
          sectionQuestions.map((question) => (
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

      {/* Navigation */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={isFirstSection || updateMutation.isLoading}
        >
          Previous Section
        </Button>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={!isDirty || updateMutation.isLoading}
            isLoading={updateMutation.isLoading}
          >
            Save Progress
          </Button>

          {isLastSection ? (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={updateMutation.isLoading}
            >
              Complete Section
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={updateMutation.isLoading}
            >
              Next Section
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
