/**
 * Section Validation Hook
 *
 * Validates questions in a section before navigation
 */

import { useMemo, useState, useCallback } from 'react';
import { validateSection, getMissingRequiredQuestions } from '@utils/validation';
import type { OASISQuestion, OASISResponse, AssessmentType } from '@typedefs/index';
import type { QuestionValidationError, ValidationResult } from '@utils/validation';

interface UseSectionValidationOptions {
  questions: OASISQuestion[];
  savedResponses: Record<string, OASISResponse> | undefined;
  draftResponses: Record<string, Partial<OASISResponse>>;
  assessmentType?: AssessmentType;
}

interface UseSectionValidationReturn {
  /** Current validation result */
  validationResult: ValidationResult;
  /** List of missing required questions */
  missingRequired: OASISQuestion[];
  /** Whether the section passes validation */
  isValid: boolean;
  /** Whether validation has been triggered */
  hasValidated: boolean;
  /** Trigger validation manually */
  validate: () => ValidationResult;
  /** Clear validation state */
  clearValidation: () => void;
  /** Get error for a specific question */
  getQuestionError: (itemCode: string) => QuestionValidationError | undefined;
  /** Check if a specific question has an error */
  hasQuestionError: (itemCode: string) => boolean;
}

/**
 * Hook for validating section questions
 */
export function useSectionValidation({
  questions,
  savedResponses,
  draftResponses,
  assessmentType,
}: UseSectionValidationOptions): UseSectionValidationReturn {
  const [hasValidated, setHasValidated] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    errorCount: 0,
    warningCount: 0,
  });

  // Merge saved and draft responses
  const mergedResponses = useMemo(() => {
    const merged: Record<string, Partial<OASISResponse>> = {};

    if (savedResponses) {
      Object.entries(savedResponses).forEach(([code, response]) => {
        merged[code] = response;
      });
    }

    Object.entries(draftResponses).forEach(([code, response]) => {
      merged[code] = { ...merged[code], ...response };
    });

    return merged;
  }, [savedResponses, draftResponses]);

  // Get missing required questions
  const missingRequired = useMemo(
    () => getMissingRequiredQuestions(questions, mergedResponses, { assessmentType }),
    [questions, mergedResponses, assessmentType]
  );

  // Validate section
  const validate = useCallback(() => {
    const result = validateSection(questions, mergedResponses, { assessmentType });
    setValidationResult(result);
    setHasValidated(true);
    return result;
  }, [questions, mergedResponses, assessmentType]);

  // Clear validation
  const clearValidation = useCallback(() => {
    setHasValidated(false);
    setValidationResult({
      isValid: true,
      errors: [],
      warnings: [],
      errorCount: 0,
      warningCount: 0,
    });
  }, []);

  // Get error for specific question
  const getQuestionError = useCallback(
    (itemCode: string) => {
      return validationResult.errors.find((e) => e.itemCode === itemCode);
    },
    [validationResult.errors]
  );

  // Check if question has error
  const hasQuestionError = useCallback(
    (itemCode: string) => {
      return validationResult.errors.some((e) => e.itemCode === itemCode);
    },
    [validationResult.errors]
  );

  return {
    validationResult,
    missingRequired,
    isValid: validationResult.isValid,
    hasValidated,
    validate,
    clearValidation,
    getQuestionError,
    hasQuestionError,
  };
}

export default useSectionValidation;
