/**
 * EMR Routes
 *
 * API routes for EMR integration (FHIR R4)
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import emrController from '../controllers/emr.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// CONNECTION MANAGEMENT (Admin only except list)
// ===========================================

// List all EMR connections (all authenticated users can see enabled ones)
router.get('/connections', emrController.listConnections);

// Create new connection (Admin only)
router.post(
  '/connections',
  authorize([UserRole.ADMIN]),
  emrController.createConnection
);

// Update connection (Admin only)
router.put(
  '/connections/:id',
  authorize([UserRole.ADMIN]),
  emrController.updateConnection
);

// Delete connection (Admin only)
router.delete(
  '/connections/:id',
  authorize([UserRole.ADMIN]),
  emrController.deleteConnection
);

// Test connection (Admin only)
router.post(
  '/connections/:id/test',
  authorize([UserRole.ADMIN]),
  emrController.testConnection
);

// ===========================================
// OAUTH FLOW
// ===========================================

// Get authorization URL (users with patient:create permission)
router.get(
  '/connections/:id/authorize',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  emrController.getAuthorizationUrl
);

// OAuth callback (public - handles redirect from EMR)
// Note: This route doesn't require auth as it's the OAuth callback
router.get('/oauth/callback', emrController.handleOAuthCallback);

// Get connection status for current user
router.get(
  '/connections/:id/status',
  emrController.getConnectionStatus
);

// ===========================================
// PATIENT OPERATIONS
// ===========================================

// Search patients in EMR (requires authorization)
router.get(
  '/connections/:id/patients',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  emrController.searchPatients
);

// Get single patient from EMR
router.get(
  '/connections/:id/patients/:fhirId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  emrController.getPatient
);

// Check for duplicates before import
router.post(
  '/connections/:id/patients/:fhirId/check-duplicates',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  emrController.checkDuplicates
);

// Import patient from EMR
router.post(
  '/connections/:id/patients/:fhirId/import',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  emrController.importPatient
);

export default router;
