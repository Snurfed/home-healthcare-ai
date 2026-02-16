/**
 * Agency Settings Routes
 *
 * API routes for managing agency-level settings
 * used to auto-populate OASIS fields.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import * as controller from '../controllers/agencySettings.controller';

const router = Router();

// Admin roles that can modify settings
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPERVISOR];

// All clinical roles that can read settings
const ALL_CLINICAL_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
  UserRole.HOME_HEALTH_AIDE,
];

/**
 * @route   GET /api/settings/agency
 * @desc    Get agency settings
 * @access  Private - All clinical staff
 */
router.get(
  '/',
  authenticate,
  authorize(ALL_CLINICAL_ROLES),
  controller.getAgencySettings
);

/**
 * @route   PUT /api/settings/agency
 * @desc    Update agency settings
 * @access  Private - Admin/Supervisor only
 */
router.put(
  '/',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.updateAgencySettings
);

/**
 * @route   GET /api/settings/agency/oasis-defaults
 * @desc    Get OASIS field defaults from agency settings
 * @access  Private - All clinical staff
 */
router.get(
  '/oasis-defaults',
  authenticate,
  authorize(ALL_CLINICAL_ROLES),
  controller.getOasisDefaults
);

export default router;
