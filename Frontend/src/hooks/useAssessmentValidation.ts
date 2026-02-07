/**
 * Assessment Validation Hook
 *
 * Validates the entire assessment for submission readiness
 */

import { useMemo, useState, useCallback } from 'react';
import {
  validateAssessment,
  getSubmissionReadiness,
  validateCrossQuestionRules,
} from '@utils/validation';
import type { OASISQuestion, OASISResponse, AssessmentType } from '@typedefs/index';
import type {
  AssessmentValidationResult,
  QuestionValidationError,
  ValidationContext,
} from '@utils/validation';

interface UseAssessmentValidationOptions {
  questions: OASISQuestion[];
  savedResponses: Record<string, OASISResponse> | undefined;
  draftResponses: Record<string, Partial<OASISResponse>>;
  assessmentType?: AssessmentType;
  startOfCareDate?: string;
}

interface UseAssessmentValidationReturn {
  /** Full validation result */
  validationResult: AssessmentValidationResult | null;
  /** Whether the assessment is ready for submission */
  isReadyForSubmission: boolean;
  /** List of blockers preventing submission */
  submissionBlockers: string[];
  /** List of warnings to review */
  submissionWarnings: string[];
  /** Completion percentage */
  completionPercentage: number;
  /** Cross-question validation errors */
  crossValidationErrors: QuestionValidationError[];
  /** Whether validation has been triggered */
  hasValidated: boolean;
  /** Trigger full validation */
  validate: () => AssessmentValidationResult;
  /** Validate specific section */
  validateSection: (sectionId: string) => QuestionValidationError[];
  /** Get errors for a specific question */
  getQuestionErrors: (itemCode: string) => QuestionValidationError[];
  /** Check if question has errors */
  hasQuestionError: (itemCode: string) => boolean;
  /** Get section error count */
  getSectionErrorCount: (sectionId: string) => number;
  /** Check if ready to submit (triggers validation if needed) */
  checkSubmissionReadiness: () => { isReady: boolean; blockers: string[]; warnings: string[] };
  /** Clear validation state */
  clearValidation: () => void;
}

/**
 * Hook for comprehensive assessment validation
 */
export function useAssessmentValidation({
  questions,
  savedResponses,
  draftResponses,
  assessmentType,
  startOfCareDate,
}: UseAssessmentValidationOptions): UseAssessmentValidationReturn {
  const [hasValidated, setHasValidated] = useState(false);
  const [validationResult, setValidationResult] = useState<AssessmentValidationResult | null>(null);

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

  // Validation context
  const validationContext: ValidationContext = useMemo(() => ({
    assessmentType,
    startOfCareDate,
    allResponses: mergedResponses,
  }), [assessmentType, startOfCareDate, mergedResponses]);

  // Real-time cross-validation errors (computed without triggering full validation)
  const crossValidationErrors = useMemo(() => {
    return validateCrossQuestionRules(questions, mergedResponses, validationContext);
  }, [questions, mergedResponses, validationContext]);

  // Calculate completion percentage in real-time
  const completionPercentage = useMemo(() => {
    if (questions.length === 0) return 0;
    const answered = questions.filter(q => {
      const response = mergedResponses[q.itemCode];
      return response && (
        response.responseValue ||
        response.responseCode ||
        response.responseText ||
        response.responseNumeric !== undefined
      );
    }).length;
    return Math.round((answered / questions.length) * 100);
  }, [questions, mergedResponses]);

  // Trigger full validation
  const validate = useCallback(() => {
    const result = validateAssessment(questions, mergedResponses, validationContext);
    setValidationResult(result);
    setHasValidated(true);
    return result;
  }, [questions, mergedResponses, validationContext]);

  // Validate specific section
  const validateSection = useCallback((sectionId: string) => {
    const sectionQuestions = questions.filter(q => q.section === sectionId);
    const result = validateAssessment(sectionQuestions, mergedResponses, validationContext);
    return result.errors;
  }, [questions, mergedResponses, validationContext]);

  // Get errors for a specific question
  const getQuestionErrors = useCallback((itemCode: string) => {
    if (!validationResult) return [];
    return validationResult.errors.filter(e => e.itemCode === itemCode);
  }, [validationResult]);

  // Check if question has errors
  const hasQuestionError = useCallback((itemCode: string) => {
    if (!validationResult) return false;
    return validationResult.errors.some(e => e.itemCode === itemCode);
  }, [validationResult]);

  // Get section error count
  const getSectionErrorCount = useCallback((sectionId: string) => {
    if (!validationResult?.sectionResults[sectionId]) return 0;
    return validationResult.sectionResults[sectionId].errorCount;
  }, [validationResult]);

  // Check submission readiness
  const checkSubmissionReadiness = useCallback(() => {
    return getSubmissionReadiness(questions, mergedResponses, validationContext);
  }, [questions, mergedResponses, validationContext]);

  // Clear validation
  const clearValidation = useCallback(() => {
    setHasValidated(false);
    setValidationResult(null);
  }, []);

  // Derive submission readiness from validation result
  const submissionReadiness = useMemo(() => {
    if (!validationResult) {
      return { isReady: false, blockers: [], warnings: [] };
    }
    return getSubmissionReadiness(questions, mergedResponses, validationContext);
  }, [validationResult, questions, mergedResponses, validationContext]);

  return {
    validationResult,
    isReadyForSubmission: validationResult?.isReadyForSubmission ?? false,
    submissionBlockers: submissionReadiness.blockers,
    submissionWarnings: submissionReadiness.warnings,
    completionPercentage,
    crossValidationErrors,
    hasValidated,
    validate,
    validateSection,
    getQuestionErrors,
    hasQuestionError,
    getSectionErrorCount,
    checkSubmissionReadiness,
    clearValidation,
  };
}

export default useAssessmentValidation;
