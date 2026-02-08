/**
 * Suggestion Controller
 *
 * HTTP handlers for the suggestion/guidance API endpoints.
 * Provides real-time documentation guidance and optimization suggestions.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as suggestionService from '../services/suggestion.service';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface GetSuggestionsRequestBody {
  questionCode: string;
  currentValue: string | number | null;
  allResponses: Record<string, string | null>;
}

export interface DismissSuggestionRequestBody {
  reason: 'addressed' | 'not_applicable' | 'reviewed';
}

// ===========================================
// CONTROLLERS
// ===========================================

/**
 * Get suggestions for a specific question
 * POST /api/oasis/assessments/:id/suggestions
 */
export async function getSuggestions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];
    const { questionCode, currentValue, allResponses } = req.body as GetSuggestionsRequestBody;

    // Validate required fields
    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    if (!questionCode) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'questionCode is required',
      });
      return;
    }

    // Get suggestions
    const suggestions = await suggestionService.getSuggestionsForQuestion({
      assessmentId,
      questionCode,
      currentValue: currentValue ?? null,
      allResponses: allResponses || {},
    });

    res.json({
      assessmentId,
      questionCode,
      suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Dismiss a suggestion
 * POST /api/oasis/assessments/:id/suggestions/:suggestionId/dismiss
 */
export async function dismissSuggestion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];
    const suggestionId = req.params['suggestionId'];
    const { reason } = req.body as DismissSuggestionRequestBody;
    const userId = req.user?.id;

    // Validate required fields
    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    if (!suggestionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'suggestionId is required',
      });
      return;
    }

    if (!reason || !['addressed', 'not_applicable', 'reviewed'].includes(reason)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'reason must be one of: addressed, not_applicable, reviewed',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Extract question code from suggestion ID (format: ruleId-questionCode)
    const questionCode = suggestionId.split('-').pop() || '';

    // Dismiss the suggestion
    await suggestionService.dismissSuggestion({
      assessmentId,
      suggestionId,
      questionCode,
      reason,
      userId,
    });

    res.json({
      success: true,
      message: 'Suggestion dismissed',
      suggestionId,
      reason,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get suggestions summary for an assessment
 * GET /api/oasis/assessments/:id/suggestions/summary
 */
export async function getSuggestionsSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];

    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    const summary = await suggestionService.getSuggestionsSummary(assessmentId);

    res.json(summary);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all active suggestions for an assessment
 * GET /api/oasis/assessments/:id/suggestions
 */
export async function getAllSuggestions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];

    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    const suggestions = await suggestionService.getAllSuggestionsForAssessment(assessmentId);

    res.json({
      assessmentId,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getSuggestions,
  dismissSuggestion,
  getSuggestionsSummary,
  getAllSuggestions,
};
