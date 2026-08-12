/**
 * Visit Notes Routes
 *
 * API routes for visit note documentation and Plan of Care.
 */

import { Router } from 'express';
import visitNoteController from '../controllers/visitNote.controller';
import planOfCareController from '../controllers/planOfCare.controller';

import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// authenticate is attached per route rather than with router.use(). This module
// is mounted at a bare /api, so a blanket middleware would also run for
// requests belonging to routers mounted after it — the ordering dependency that
// hid this module's missing authentication in the first place.

// ===========================================
// VISIT NOTE ROUTES
// ===========================================

// Get visit note by visit ID
router.get('/visits/:visitId/note', authenticate, visitNoteController.getVisitNote);

// Create a new visit note
router.post('/visits/:visitId/note', authenticate, visitNoteController.createVisitNote);

// Update an existing visit note
router.put('/visits/:visitId/note', authenticate, visitNoteController.updateVisitNote);

// Generate AI draft for a section
router.post('/visits/:visitId/note/draft', authenticate, visitNoteController.generateAIDraft);

// Finalize visit note with signatures
router.post('/visits/:visitId/note/finalize', authenticate, visitNoteController.finalizeVisitNote);

// ===========================================
// EPISODE ROUTES
// ===========================================

// Get episode dashboard data
router.get('/episodes/:episodeId/dashboard', authenticate, visitNoteController.getEpisodeDashboard);

// Get visit notes for an episode
router.get('/episodes/:episodeId/visit-notes', authenticate, visitNoteController.getEpisodeVisitNotes);

// ===========================================
// PLAN OF CARE ROUTES
// ===========================================

// Get Plan of Care by episode ID
router.get('/episodes/:episodeId/plan-of-care', authenticate, planOfCareController.getPlanOfCare);

// Create a new Plan of Care
router.post('/episodes/:episodeId/plan-of-care', authenticate, planOfCareController.createPlanOfCare);

// Update an existing Plan of Care
router.put('/episodes/:episodeId/plan-of-care/:pocId', authenticate, planOfCareController.updatePlanOfCare);

// Auto-populate Plan of Care from OASIS
router.post('/episodes/:episodeId/plan-of-care/:pocId/auto-populate', authenticate, planOfCareController.autoPopulateFromOasis);

// Sign Plan of Care
router.post('/episodes/:episodeId/plan-of-care/:pocId/sign', authenticate, planOfCareController.signPlanOfCare);

export default router;
