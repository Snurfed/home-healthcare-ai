/**
 * Section Content Component
 *
 * Displays questions for the current OASIS section
 * Works with auto-save - no manual save on navigation
 * Applies skip logic to conditionally show/hide questions
 * Validates required questions before section navigation
 * Supports voice input with AI-powered field extraction
 * Provides real-time smart suggestions for documentation guidance
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { useSkipLogic, useSectionValidation, useSuggestions } from '@hooks/index';
import { Button, Alert, Modal } from '@components/common';
import QuestionRenderer from './QuestionRenderer';
import { VoiceRecorder, VoiceSuggestionReview } from '@components/voice';
import type { OASISSection, OASISAssessment, OASISQuestion, DismissalReason } from '@typedefs/index';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';
import type { VoiceProcessingResult, OasisFieldMapping } from '@services/voice.service';

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

  // Voice recording state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceResults, setVoiceResults] = useState<VoiceProcessingResult['result'] | null>(null);

  // Smart suggestions - only enabled for unlocked assessments
  const isLocked = assessment.status === 'LOCKED' || assessment.status === 'SUBMITTED';
  const {
    fetchSuggestions,
    dismissSuggestion,
    getSuggestionsForQuestion,
    isLoading: suggestionsLoading,
  } = useSuggestions({
    assessmentId: assessment.id,
    debounceMs: 500,
    enabled: !isLocked,
  });

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

  // Section validation
  const {
    validationResult,
    missingRequired,
    hasValidated,
    validate,
    clearValidation,
    getQuestionError,
  } = useSectionValidation({
    questions: visibleQuestions, // Only validate visible questions
    savedResponses: assessment.responses,
    draftResponses,
    assessmentType: assessment.assessmentType,
  });

  // Track first error element for scrolling
  const firstErrorRef = useRef<string | null>(null);

  // Clear validation when section changes
  useEffect(() => {
    clearValidation();
    firstErrorRef.current = null;
  }, [section.id, clearValidation]);

  // Get response value (merged from assessment and draft)
  const getResponseValue = (itemCode: string) => {
    const draft = draftResponses[itemCode];
    const saved = assessment.responses?.[itemCode];
    return draft || saved;
  };

  // Handle next section with validation
  const handleNextSection = useCallback(() => {
    const result = validate();

    if (!result.isValid) {
      // Scroll to first error
      const firstError = result.errors[0];
      if (firstError) {
        firstErrorRef.current = firstError.itemCode;
        const errorElement = document.getElementById(`question-${firstError.itemCode}`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    nextSection();
  }, [validate, nextSection]);

  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === OASIS_SECTIONS.length - 1;

  // Handle voice extraction complete
  const handleVoiceExtractionComplete = useCallback((results: VoiceProcessingResult['result']) => {
    setShowVoiceRecorder(false);
    setVoiceResults(results);
  }, []);

  // Handle accepting a single voice suggestion
  const handleAcceptVoiceSuggestion = useCallback((itemCode: string, field: OasisFieldMapping) => {
    updateResponse(itemCode, {
      responseCode: field.mappedResponseCode,
      responseValue: String(field.extractedValue),
      confidence: field.confidence,
      sourceType: 'voice',
      sourceTranscriptionId: voiceResults?.transcriptionId,
      sourceText: field.sourceText,
    });
  }, [updateResponse, voiceResults?.transcriptionId]);

  // Handle rejecting a voice suggestion (just close, don't update)
  const handleRejectVoiceSuggestion = useCallback((_itemCode: string) => {
    // No action needed - just don't update the field
  }, []);

  // Handle accepting all high-confidence suggestions
  const handleAcceptAllVoiceSuggestions = useCallback((fields: OasisFieldMapping[]) => {
    fields.forEach((field) => {
      updateResponse(field.itemCode, {
        responseCode: field.mappedResponseCode,
        responseValue: String(field.extractedValue),
        confidence: field.confidence,
        sourceType: 'voice',
        sourceTranscriptionId: voiceResults?.transcriptionId,
        sourceText: field.sourceText,
      });
    });
  }, [updateResponse, voiceResults?.transcriptionId]);

  // Handle value change for suggestions
  const handleValueChangeForSuggestions = useCallback(
    (questionCode: string, value: string | number | null) => {
      // Build current responses map for suggestion context
      const allResponses = { ...assessment.responses, ...draftResponses };
      fetchSuggestions(questionCode, value, allResponses);
    },
    [fetchSuggestions, assessment.responses, draftResponses]
  );

  // Handle dismissing a suggestion
  const handleDismissSuggestion = useCallback(
    (suggestionId: string, reason: DismissalReason) => {
      dismissSuggestion(suggestionId, reason);
    },
    [dismissSuggestion]
  );

  // Handle navigating to a related question
  const handleNavigateToQuestion = useCallback((questionCode: string) => {
    const element = document.getElementById(`question-${questionCode}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight the question
      element.classList.add('ring-2', 'ring-primary-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary-500');
      }, 2000);
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-card">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
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

          {/* Voice Input Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowVoiceRecorder(true)}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            Voice Input
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {hasValidated && !validationResult.isValid && (
        <div className="px-6 pt-4">
          <Alert variant="error">
            <div>
              <p className="font-medium">
                Please complete {validationResult.errorCount} required{' '}
                {validationResult.errorCount === 1 ? 'question' : 'questions'} before
                continuing:
              </p>
              <ul className="mt-2 text-sm list-disc list-inside">
                {missingRequired.slice(0, 5).map((q) => (
                  <li key={q.itemCode}>
                    <button
                      type="button"
                      className="text-red-700 underline hover:text-red-800"
                      onClick={() => {
                        const el = document.getElementById(`question-${q.itemCode}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {q.itemCode}: {q.itemName}
                    </button>
                  </li>
                ))}
                {missingRequired.length > 5 && (
                  <li className="text-red-600">
                    ...and {missingRequired.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          </Alert>
        </div>
      )}

      {/* Validation Warnings */}
      {hasValidated && validationResult.warningCount > 0 && validationResult.isValid && (
        <div className="px-6 pt-4">
          <Alert variant="warning">
            <p>
              {validationResult.warningCount}{' '}
              {validationResult.warningCount === 1 ? 'question has' : 'questions have'}{' '}
              warnings. Review before continuing.
            </p>
          </Alert>
        </div>
      )}

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
              error={getQuestionError(question.itemCode)}
              suggestions={getSuggestionsForQuestion(question.itemCode)}
              onDismissSuggestion={handleDismissSuggestion}
              onNavigateToQuestion={handleNavigateToQuestion}
              suggestionsLoading={suggestionsLoading}
              onValueChange={handleValueChangeForSuggestions}
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
          onClick={handleNextSection}
          disabled={isLastSection}
        >
          {isLastSection ? 'Last Section' : 'Next Section'}
        </Button>
      </div>

      {/* Voice Recorder Modal */}
      <Modal
        isOpen={showVoiceRecorder}
        size="lg"
        onClose={() => setShowVoiceRecorder(false)}
        title="Voice Input"
        showCloseButton={false}
      >
        <VoiceRecorder
          assessmentId={assessment.id}
          assessmentType={assessment.assessmentType}
          patientId={assessment.patientId}
          onExtractionComplete={handleVoiceExtractionComplete}
          onClose={() => setShowVoiceRecorder(false)}
        />
      </Modal>

      {/* Voice Suggestion Review Modal */}
      {voiceResults && (
        <VoiceSuggestionReview
          transcriptionText={voiceResults.transcription.fullText}
          transcriptionId={voiceResults.transcriptionId}
          extractedFields={voiceResults.oasisMapping.mappedFields}
          questions={questions}
          existingResponses={assessment.responses}
          onAccept={handleAcceptVoiceSuggestion}
          onReject={handleRejectVoiceSuggestion}
          onAcceptAll={handleAcceptAllVoiceSuggestions}
          onClose={() => setVoiceResults(null)}
        />
      )}
    </div>
  );
}
