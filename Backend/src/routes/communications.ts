/**
 * Physician Communication Routes
 *
 * API routes for AI-powered physician communication detection and generation.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getCommunicationTriggers,
  detectTriggers,
  dismissCommunicationTrigger,
  generateCommunicationDraft,
  generatePostVisit,
  getCommunication,
  updateCommunication,
  regenerateCommunicationDraft,
  getPatientCommunications,
  getEpisodeCommunications,
} from '../controllers/communication.controller';

const router = Router();

// =============================================================================
// TRIGGER ROUTES
// =============================================================================

/**
 * GET /api/assessments/:id/communication-triggers
 * Get all communication triggers for an assessment
 */
router.get(
  '/assessments/:id/communication-triggers',
  authenticate,
  getCommunicationTriggers
);

/**
 * POST /api/assessments/:id/communication-triggers/detect
 * Detect triggers for a specific question change
 */
router.post(
  '/assessments/:id/communication-triggers/detect',
  authenticate,
  detectTriggers
);

/**
 * POST /api/communication-triggers/:id/dismiss
 * Dismiss a communication trigger
 */
router.post(
  '/communication-triggers/:id/dismiss',
  authenticate,
  dismissCommunicationTrigger
);

// =============================================================================
// GENERATION ROUTES
// =============================================================================

/**
 * POST /api/assessments/:id/communications/generate
 * Generate a communication draft from a trigger
 */
router.post(
  '/assessments/:id/communications/generate',
  authenticate,
  generateCommunicationDraft
);

/**
 * POST /api/assessments/:id/communications/post-visit-summary
 * Generate a comprehensive post-visit summary
 */
router.post(
  '/assessments/:id/communications/post-visit-summary',
  authenticate,
  generatePostVisit
);

// =============================================================================
// COMMUNICATION CRUD ROUTES
// =============================================================================

/**
 * GET /api/communications/:id
 * Get a specific communication
 */
router.get(
  '/communications/:id',
  authenticate,
  getCommunication
);

/**
 * PATCH /api/communications/:id
 * Update a communication draft
 */
router.patch(
  '/communications/:id',
  authenticate,
  updateCommunication
);

/**
 * POST /api/communications/:id/regenerate
 * Regenerate communication with instructions
 */
router.post(
  '/communications/:id/regenerate',
  authenticate,
  regenerateCommunicationDraft
);

// =============================================================================
// LIST ROUTES
// =============================================================================

/**
 * GET /api/patients/:patientId/communications
 * Get all communications for a patient
 */
router.get(
  '/patients/:patientId/communications',
  authenticate,
  getPatientCommunications
);

/**
 * GET /api/episodes/:episodeId/communications
 * Get all communications for an episode
 */
router.get(
  '/episodes/:episodeId/communications',
  authenticate,
  getEpisodeCommunications
);

export default router;
