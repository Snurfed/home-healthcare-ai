/**
 * Suggestion Routes
 *
 * Routes for real-time OASIS assessment guidance and optimization suggestions.
 *
 * Endpoints:
 * - POST   /api/oasis/assessments/:id/suggestions           - Get suggestions for a question
 * - GET    /api/oasis/assessments/:id/suggestions           - Get all suggestions for assessment
 * - GET    /api/oasis/assessments/:id/suggestions/summary   - Get suggestions summary
 * - POST   /api/oasis/assessments/:id/suggestions/:suggestionId/dismiss - Dismiss a suggestion
 */

import { Router } from 'express';
import * as suggestionController from '../controllers/suggestion.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

const router = Router();

// Roles that can view and interact with suggestions
const CLINICAL_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
];

// Roles that can view optimization/revenue suggestions
const OPTIMIZATION_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.BILLING,
];

/**
 * POST /assessments/:id/suggestions
 * Get suggestions for a specific question in an assessment
 *
 * Request body:
 * {
 *   "questionCode": "M1021",
 *   "currentValue": "E11.9",
 *   "allResponses": { "M1021": "E11.9", "M1023": "I10,E78.5", ... }
 * }
 *
 * Response:
 * {
 *   "assessmentId": "uuid",
 *   "questionCode": "M1021",
 *   "suggestions": [...],
 *   "timestamp": "2025-01-20T10:00:00.000Z"
 * }
 */
router.post(
  '/assessments/:id/suggestions',
  authenticate,
  authorize(CLINICAL_ROLES),
  suggestionController.getSuggestions
);

/**
 * GET /assessments/:id/suggestions
 * Get all active suggestions for an assessment
 *
 * Response:
 * {
 *   "assessmentId": "uuid",
 *   "suggestions": [...],
 *   "count": 5,
 *   "timestamp": "2025-01-20T10:00:00.000Z"
 * }
 */
router.get(
  '/assessments/:id/suggestions',
  authenticate,
  authorize(CLINICAL_ROLES),
  suggestionController.getAllSuggestions
);

/**
 * GET /assessments/:id/suggestions/summary
 * Get suggestions summary for an assessment
 *
 * Response:
 * {
 *   "assessmentId": "uuid",
 *   "totalSuggestions": 10,
 *   "byType": { "OPTIMIZATION": 3, "INCONSISTENCY": 2, ... },
 *   "byPriority": { "high": 2, "medium": 5, "low": 3 },
 *   "dismissed": 2,
 *   "active": 8,
 *   "totalFinancialOpportunity": 850,
 *   "topSuggestions": [...]
 * }
 */
router.get(
  '/assessments/:id/suggestions/summary',
  authenticate,
  authorize(OPTIMIZATION_ROLES),
  suggestionController.getSuggestionsSummary
);

/**
 * POST /assessments/:id/suggestions/:suggestionId/dismiss
 * Dismiss a suggestion
 *
 * Request body:
 * {
 *   "reason": "addressed" | "not_applicable" | "reviewed"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Suggestion dismissed",
 *   "suggestionId": "uuid",
 *   "reason": "addressed"
 * }
 */
router.post(
  '/assessments/:id/suggestions/:suggestionId/dismiss',
  authenticate,
  authorize(CLINICAL_ROLES),
  suggestionController.dismissSuggestion
);

export default router;
