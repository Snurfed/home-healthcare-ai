/**
 * Clinical Events Routes
 *
 * API routes for clinical event detection and management.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import * as controller from '../controllers/clinicalEvents.controller';

const router = Router();

// Clinical roles that can access event detection
const CLINICAL_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
];

// Admin roles for configuration
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPERVISOR];

// ===========================================
// DETECTION ENDPOINTS
// ===========================================

/**
 * @route   POST /api/clinical-events/detect/keywords
 * @desc    Fast keyword-based detection (real-time)
 * @access  Private - Clinical staff
 */
router.post(
  '/detect/keywords',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.detectByKeywords
);

/**
 * @route   POST /api/clinical-events/detect/full
 * @desc    Full detection with AI analysis (post-save)
 * @access  Private - Clinical staff
 */
router.post(
  '/detect/full',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.detectFull
);

/**
 * @route   POST /api/clinical-events/detect/oasis-changes
 * @desc    Detect functional changes between OASIS assessments
 * @access  Private - Clinical staff
 */
router.post(
  '/detect/oasis-changes',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.detectOasisChanges
);

// ===========================================
// EVENT MANAGEMENT ENDPOINTS
// ===========================================

/**
 * @route   GET /api/clinical-events/pending/:patientId
 * @desc    Get pending (unacknowledged) events for a patient
 * @access  Private - Clinical staff
 */
router.get(
  '/pending/:patientId',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getPendingEvents
);

/**
 * @route   GET /api/clinical-events/:id
 * @desc    Get a single event by ID
 * @access  Private - Clinical staff
 */
router.get(
  '/:id',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getEvent
);

/**
 * @route   POST /api/clinical-events/:id/acknowledge
 * @desc    Acknowledge an event (mark as seen)
 * @access  Private - Clinical staff
 */
router.post(
  '/:id/acknowledge',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.acknowledgeEvent
);

/**
 * @route   POST /api/clinical-events/:id/dismiss
 * @desc    Dismiss an event (won't generate notification)
 * @access  Private - Clinical staff
 */
router.post(
  '/:id/dismiss',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.dismissEvent
);

// ===========================================
// TRIGGER CONFIGURATION ENDPOINTS
// ===========================================

/**
 * @route   GET /api/clinical-events/triggers
 * @desc    Get all trigger configurations
 * @access  Private - Admin/Supervisor
 */
router.get(
  '/triggers',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.getTriggerConfigs
);

/**
 * @route   PATCH /api/clinical-events/triggers/:eventType
 * @desc    Update a trigger configuration
 * @access  Private - Admin/Supervisor
 */
router.patch(
  '/triggers/:eventType',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.updateTriggerConfig
);

export default router;
