/**
 * Integrations Routes
 *
 * API routes for email/fax integration management.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import * as controller from '../controllers/integrations.controller';

const router = Router();

// Admin roles for integration management
const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPERVISOR];

// ===========================================
// EMAIL INTEGRATION ROUTES
// ===========================================

/**
 * @route   GET /api/integrations/email/status
 * @desc    Get all email integration statuses
 * @access  Private - Admin/Supervisor
 */
router.get(
  '/email/status',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.getEmailIntegrationStatus
);

/**
 * @route   POST /api/integrations/email/smtp/configure
 * @desc    Configure SMTP settings
 * @access  Private - Admin/Supervisor
 */
router.post(
  '/email/smtp/configure',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.configureSMTP
);

/**
 * @route   POST /api/integrations/email/smtp/test
 * @desc    Test SMTP connection
 * @access  Private - Admin/Supervisor
 */
router.post(
  '/email/smtp/test',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.testSMTP
);

// ===========================================
// GENERIC INTEGRATION MANAGEMENT
// ===========================================

/**
 * @route   POST /api/integrations/:provider/enable
 * @desc    Enable an integration
 * @access  Private - Admin/Supervisor
 */
router.post(
  '/:provider/enable',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.enableIntegration
);

/**
 * @route   POST /api/integrations/:provider/disable
 * @desc    Disable an integration
 * @access  Private - Admin/Supervisor
 */
router.post(
  '/:provider/disable',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.disableIntegration
);

/**
 * @route   POST /api/integrations/:provider/set-primary
 * @desc    Set an integration as primary for its channel
 * @access  Private - Admin/Supervisor
 */
router.post(
  '/:provider/set-primary',
  authenticate,
  authorize(ADMIN_ROLES),
  controller.setPrimaryIntegration
);

export default router;
