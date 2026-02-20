/**
 * Visit Notes Routes
 *
 * API routes for visit note documentation and Plan of Care.
 */

import { Router } from 'express';
import visitNoteController from '../controllers/visitNote.controller';
import planOfCareController from '../controllers/planOfCare.controller';

const router = Router();

// ===========================================
// VISIT NOTE ROUTES
// ===========================================

// Get visit note by visit ID
router.get('/visits/:visitId/note', visitNoteController.getVisitNote);

// Create a new visit note
router.post('/visits/:visitId/note', visitNoteController.createVisitNote);

// Update an existing visit note
router.put('/visits/:visitId/note', visitNoteController.updateVisitNote);

// Generate AI draft for a section
router.post('/visits/:visitId/note/draft', visitNoteController.generateAIDraft);

// Finalize visit note with signatures
router.post('/visits/:visitId/note/finalize', visitNoteController.finalizeVisitNote);

// ===========================================
// EPISODE ROUTES
// ===========================================

// Get episode dashboard data
router.get('/episodes/:episodeId/dashboard', visitNoteController.getEpisodeDashboard);

// Get visit notes for an episode
router.get('/episodes/:episodeId/visit-notes', visitNoteController.getEpisodeVisitNotes);

// ===========================================
// PLAN OF CARE ROUTES
// ===========================================

// Get Plan of Care by episode ID
router.get('/episodes/:episodeId/plan-of-care', planOfCareController.getPlanOfCare);

// Create a new Plan of Care
router.post('/episodes/:episodeId/plan-of-care', planOfCareController.createPlanOfCare);

// Update an existing Plan of Care
router.put('/episodes/:episodeId/plan-of-care/:pocId', planOfCareController.updatePlanOfCare);

// Auto-populate Plan of Care from OASIS
router.post('/episodes/:episodeId/plan-of-care/:pocId/auto-populate', planOfCareController.autoPopulateFromOasis);

// Sign Plan of Care
router.post('/episodes/:episodeId/plan-of-care/:pocId/sign', planOfCareController.signPlanOfCare);

export default router;
