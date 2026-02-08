/**
 * Suggestion Service
 *
 * API client for real-time OASIS assessment suggestions and guidance.
 */

import apiClient from './api/client';
import type {
  QuestionSuggestion,
  GetSuggestionsRequest,
  GetSuggestionsResponse,
  SuggestionsSummary,
  DismissalReason,
} from '@typedefs/suggestion.types';

// Response types
interface DismissSuggestionResponse {
  success: boolean;
  message: string;
  suggestionId: string;
  reason: DismissalReason;
}

interface GetAllSuggestionsResponse {
  assessmentId: string;
  suggestions: QuestionSuggestion[];
  count: number;
  timestamp: string;
}

export const suggestionService = {
  /**
   * Get suggestions for a specific question
   * Uses debounced calls on the frontend to prevent excessive requests
   */
  async getSuggestionsForQuestion(
    assessmentId: string,
    request: GetSuggestionsRequest
  ): Promise<GetSuggestionsResponse> {
    const response = await apiClient.post<GetSuggestionsResponse>(
      `/oasis/assessments/${assessmentId}/suggestions`,
      request,
      {
        timeout: 3000, // 3 second timeout for suggestions - non-blocking
      }
    );
    return response.data;
  },

  /**
   * Get all active suggestions for an assessment
   */
  async getAllSuggestions(assessmentId: string): Promise<QuestionSuggestion[]> {
    const response = await apiClient.get<GetAllSuggestionsResponse>(
      `/oasis/assessments/${assessmentId}/suggestions`
    );
    return response.data.suggestions;
  },

  /**
   * Get suggestions summary for an assessment
   * Includes totals by type, priority, and financial opportunity
   */
  async getSuggestionsSummary(assessmentId: string): Promise<SuggestionsSummary> {
    const response = await apiClient.get<SuggestionsSummary>(
      `/oasis/assessments/${assessmentId}/suggestions/summary`
    );
    return response.data;
  },

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(
    assessmentId: string,
    suggestionId: string,
    reason: DismissalReason
  ): Promise<DismissSuggestionResponse> {
    const response = await apiClient.post<DismissSuggestionResponse>(
      `/oasis/assessments/${assessmentId}/suggestions/${encodeURIComponent(suggestionId)}/dismiss`,
      { reason }
    );
    return response.data;
  },
};

export default suggestionService;
