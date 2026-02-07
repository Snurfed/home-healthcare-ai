/**
 * Skip Logic Hook
 *
 * React hook for filtering questions based on skip logic conditions
 */

import { useMemo } from 'react';
import { filterVisibleQuestions, getHiddenQuestions } from '@utils/skipLogic';
import type { OASISQuestion, OASISResponse } from '@typedefs/index';

interface UseSkipLogicOptions {
  questions: OASISQuestion[];
  savedResponses: Record<string, OASISResponse> | undefined;
  draftResponses: Record<string, Partial<OASISResponse>>;
}

interface UseSkipLogicReturn {
  visibleQuestions: OASISQuestion[];
  hiddenQuestionCodes: Set<string>;
  totalQuestions: number;
  visibleCount: number;
  hiddenCount: number;
  isQuestionVisible: (itemCode: string) => boolean;
}

/**
 * Hook to filter questions based on skip logic and current responses
 *
 * @example
 * ```tsx
 * const { visibleQuestions, hiddenCount } = useSkipLogic({
 *   questions: sectionQuestions,
 *   savedResponses: assessment.responses,
 *   draftResponses: draftResponses,
 * });
 * ```
 */
export function useSkipLogic({
  questions,
  savedResponses,
  draftResponses,
}: UseSkipLogicOptions): UseSkipLogicReturn {
  // Merge saved and draft responses (draft takes precedence)
  const mergedResponses = useMemo(() => {
    const merged: Record<string, Partial<OASISResponse>> = {};

    // Add saved responses
    if (savedResponses) {
      Object.entries(savedResponses).forEach(([code, response]) => {
        merged[code] = response;
      });
    }

    // Override with draft responses
    Object.entries(draftResponses).forEach(([code, response]) => {
      merged[code] = { ...merged[code], ...response };
    });

    return merged;
  }, [savedResponses, draftResponses]);

  // Calculate hidden questions
  const hiddenQuestionCodes = useMemo(
    () => getHiddenQuestions(questions, mergedResponses),
    [questions, mergedResponses]
  );

  // Filter to visible questions
  const visibleQuestions = useMemo(
    () => filterVisibleQuestions(questions, mergedResponses),
    [questions, mergedResponses]
  );

  // Helper to check if a specific question is visible
  const isQuestionVisible = useMemo(
    () => (itemCode: string) => !hiddenQuestionCodes.has(itemCode),
    [hiddenQuestionCodes]
  );

  return {
    visibleQuestions,
    hiddenQuestionCodes,
    totalQuestions: questions.length,
    visibleCount: visibleQuestions.length,
    hiddenCount: hiddenQuestionCodes.size,
    isQuestionVisible,
  };
}

export default useSkipLogic;
