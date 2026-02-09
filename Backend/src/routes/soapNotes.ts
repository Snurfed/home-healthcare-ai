/**
 * SOAP Notes Routes
 *
 * API routes for SOAP note generation and management.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import * as controller from '../controllers/soapNotes.controller';

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// Clinical roles that can access SOAP notes
const CLINICAL_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
];

// Roles that can finalize/approve SOAP notes (kept for reference)
// const SUPERVISOR_ROLES = [UserRole.ADMIN, UserRole.SUPERVISOR];

// ===========================================
// ROUTES - Assessment-scoped
// ===========================================

/**
 * @route   POST /api/assessments/:assessmentId/soap-notes
 * @desc    Generate/create a new SOAP note for an assessment
 * @access  Private - Clinical staff
 */
router.post(
  '/assessments/:assessmentId/soap-notes',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.createSoapNote
);

/**
 * @route   GET /api/assessments/:assessmentId/soap-notes
 * @desc    Get SOAP note for a specific assessment
 * @access  Private - Clinical staff
 */
router.get(
  '/assessments/:assessmentId/soap-notes',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getSoapNoteByAssessment
);

// ===========================================
// ROUTES - SOAP Note-scoped
// ===========================================

/**
 * @route   GET /api/soap-notes/:id
 * @desc    Get a single SOAP note by ID
 * @access  Private - Clinical staff
 */
router.get(
  '/soap-notes/:id',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getSoapNote
);

/**
 * @route   PATCH /api/soap-notes/:id
 * @desc    Update/edit SOAP note sections (S, O, A, P)
 * @access  Private - Clinical staff (cannot edit finalized notes)
 */
router.patch(
  '/soap-notes/:id',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.updateSoapNote
);

/**
 * @route   PATCH /api/soap-notes/:id/status
 * @desc    Change SOAP note status (draft -> reviewed -> finalized)
 * @access  Private - Clinical staff for review, Supervisors for finalization
 */
router.patch(
  '/soap-notes/:id/status',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.updateSoapNoteStatus
);

// ===========================================
// ROUTES - Patient-scoped
// ===========================================

/**
 * @route   GET /api/patients/:patientId/soap-notes
 * @desc    List all SOAP notes for a patient
 * @access  Private - Clinical staff
 */
router.get(
  '/patients/:patientId/soap-notes',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.listSoapNotesByPatient
);

// ===========================================
// EXPORTS
// ===========================================

export default router;
