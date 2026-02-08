/**
 * Suggestions Hook
 *
 * Provides real-time OASIS assessment suggestions with debounced fetching,
 * caching, and dismiss functionality.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { suggestionService } from '@services/suggestion.service';
import type {
  QuestionSuggestion,
  DismissalReason,
  SuggestionsSummary,
  OASISResponse,
} from '@typedefs/index';

interface UseSuggestionsOptions {
  /** Assessment ID to fetch suggestions for */
  assessmentId: string;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** Whether to fetch suggestions (can disable for locked assessments) */
  enabled?: boolean;
}

interface UseSuggestionsReturn {
  /** Suggestions indexed by question code */
  suggestions: Record<string, QuestionSuggestion[]>;
  /** Fetch suggestions for a specific question (debounced) */
  fetchSuggestions: (
    questionCode: string,
    value: string | number | null,
    allResponses?: Record<string, Partial<OASISResponse>>
  ) => void;
  /** Dismiss a suggestion */
  dismissSuggestion: (suggestionId: string, reason: DismissalReason) => Promise<void>;
  /** Get suggestions for a specific question */
  getSuggestionsForQuestion: (questionCode: string) => QuestionSuggestion[];
  /** Whether suggestions are currently loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Clear all cached suggestions */
  clearSuggestions: () => void;
  /** Get suggestions summary (for supervisor view) */
  getSummary: () => Promise<SuggestionsSummary | null>;
  /** Total count of active suggestions */
  totalSuggestions: number;
  /** Count of high priority suggestions */
  highPriorityCount: number;
}

/**
 * Hook for managing real-time OASIS assessment suggestions
 */
export function useSuggestions({
  assessmentId,
  debounceMs = 500,
  enabled = true,
}: UseSuggestionsOptions): UseSuggestionsReturn {
  // State
  const [suggestions, setSuggestions] = useState<Record<string, QuestionSuggestion[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQuestionsRef = useRef<Set<string>>(new Set());
  const lastResponsesRef = useRef<Record<string, string | null>>({});

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Convert OASISResponse map to simple string map for API
   */
  const convertResponses = useCallback(
    (responses?: Record<string, Partial<OASISResponse>>): Record<string, string | null> => {
      if (!responses) return lastResponsesRef.current;

      const converted: Record<string, string | null> = {};
      for (const [code, response] of Object.entries(responses)) {
        converted[code] =
          response.responseValue ||
          response.responseCode ||
          (response.responseNumeric != null ? String(response.responseNumeric) : null);
      }
      lastResponsesRef.current = converted;
      return converted;
    },
    []
  );

  /**
   * Actually fetch suggestions from API
   */
  const doFetch = useCallback(
    async (questionCode: string, allResponses: Record<string, string | null>) => {
      if (!enabled || !assessmentId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await suggestionService.getSuggestionsForQuestion(assessmentId, {
          questionCode,
          currentValue: allResponses[questionCode] ?? null,
          allResponses,
        });

        setSuggestions((prev) => ({
          ...prev,
          [questionCode]: response.suggestions,
        }));
      } catch (err) {
        // Suggestions are non-blocking, so we just log and don't show errors to user
        console.warn('Failed to fetch suggestions:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch suggestions'));
        // Return empty suggestions on error (graceful degradation)
        setSuggestions((prev) => ({
          ...prev,
          [questionCode]: [],
        }));
      } finally {
        setIsLoading(false);
        pendingQuestionsRef.current.delete(questionCode);
      }
    },
    [assessmentId, enabled]
  );

  /**
   * Debounced fetch for suggestions
   */
  const fetchSuggestions = useCallback(
    (
      questionCode: string,
      value: string | number | null,
      allResponses?: Record<string, Partial<OASISResponse>>
    ) => {
      if (!enabled) return;

      // Update the responses ref
      const convertedResponses = convertResponses(allResponses);

      // Update the current value in responses
      if (value !== null) {
        convertedResponses[questionCode] = String(value);
      } else {
        convertedResponses[questionCode] = null;
      }

      // Mark question as pending
      pendingQuestionsRef.current.add(questionCode);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        // Fetch for all pending questions
        for (const code of pendingQuestionsRef.current) {
          doFetch(code, convertedResponses);
        }
      }, debounceMs);
    },
    [enabled, debounceMs, convertResponses, doFetch]
  );

  /**
   * Dismiss a suggestion
   */
  const dismissSuggestion = useCallback(
    async (suggestionId: string, reason: DismissalReason) => {
      if (!assessmentId) return;

      try {
        await suggestionService.dismissSuggestion(assessmentId, suggestionId, reason);

        // Remove from local state
        setSuggestions((prev) => {
          const updated = { ...prev };
          for (const [code, codeSuggestions] of Object.entries(updated)) {
            updated[code] = codeSuggestions.filter((s) => s.id !== suggestionId);
          }
          return updated;
        });
      } catch (err) {
        console.error('Failed to dismiss suggestion:', err);
        throw err;
      }
    },
    [assessmentId]
  );

  /**
   * Get suggestions for a specific question
   */
  const getSuggestionsForQuestion = useCallback(
    (questionCode: string): QuestionSuggestion[] => {
      return suggestions[questionCode] || [];
    },
    [suggestions]
  );

  /**
   * Clear all cached suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions({});
    setError(null);
    pendingQuestionsRef.current.clear();
    lastResponsesRef.current = {};
  }, []);

  /**
   * Get suggestions summary (for supervisor dashboard)
   */
  const getSummary = useCallback(async (): Promise<SuggestionsSummary | null> => {
    if (!assessmentId) return null;

    try {
      return await suggestionService.getSuggestionsSummary(assessmentId);
    } catch (err) {
      console.error('Failed to fetch suggestions summary:', err);
      return null;
    }
  }, [assessmentId]);

  /**
   * Calculate total suggestions count
   */
  const totalSuggestions = useMemo(() => {
    return Object.values(suggestions).reduce((total, arr) => total + arr.length, 0);
  }, [suggestions]);

  /**
   * Calculate high priority suggestions count
   */
  const highPriorityCount = useMemo(() => {
    return Object.values(suggestions).reduce(
      (total, arr) => total + arr.filter((s) => s.priority === 'high').length,
      0
    );
  }, [suggestions]);

  return {
    suggestions,
    fetchSuggestions,
    dismissSuggestion,
    getSuggestionsForQuestion,
    isLoading,
    error,
    clearSuggestions,
    getSummary,
    totalSuggestions,
    highPriorityCount,
  };
}

export default useSuggestions;
