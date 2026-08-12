/**
 * EMR Export Routes
 *
 * API endpoints for EMR export operations:
 * - Template management
 * - Export generation
 * - Clipboard formatting
 * - Audit logging
 */

import { Router } from 'express';
import emrExportController from '../controllers/emrExport.controller';

import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// authenticate is attached per route rather than with router.use(). This module
// is mounted at a bare /api, so a blanket middleware would also run for
// requests belonging to routers mounted after it — the ordering dependency that
// hid this module's missing authentication in the first place.

// =============================================================================
// TEMPLATE ENDPOINTS
// =============================================================================

/**
 * Get available templates for a discipline and visit type
 * @route GET /api/emr/templates
 * @query discipline - RN, LVN, PT, OT, SLP, MSW, HHA
 * @query visitType - SOC, ROC, RECERT, FOLLOWUP, DISCHARGE, EVAL, SUPERVISORY
 * @query emrVendor - Optional filter by EMR vendor (HCHB, KINNSER, AXXESS, etc.)
 * @query agencyId - Optional filter by agency ID
 */
router.get('/emr/templates', authenticate, emrExportController.getTemplates);

/**
 * Get all templates (admin endpoint)
 * @route GET /api/emr/templates/all
 */
router.get('/emr/templates/all', authenticate, emrExportController.getAllTemplates);

/**
 * Get a specific template by ID
 * @route GET /api/emr/templates/:templateId
 */
router.get('/emr/templates/:templateId', authenticate, emrExportController.getTemplateById);

// =============================================================================
// VISIT EXPORT ENDPOINTS
// =============================================================================

/**
 * Generate export preview for a visit
 * @route GET /api/visits/:visitId/emr/preview
 * @query templateId - The EMR template to use for export
 */
router.get('/visits/:visitId/emr/preview', authenticate, emrExportController.getExportPreview);

/**
 * Generate full export for a visit
 * @route POST /api/visits/:visitId/emr/export
 * @body templateId - The EMR template to use for export
 */
router.post('/visits/:visitId/emr/export', authenticate, emrExportController.generateExport);

/**
 * Log clipboard copy event
 * @route POST /api/visits/:visitId/emr/copy
 * @body templateId - The EMR template that was copied
 */
router.post('/visits/:visitId/emr/copy', authenticate, emrExportController.logClipboardCopy);

/**
 * Get audit events for a visit
 * @route GET /api/visits/:visitId/emr/audit
 * @query limit - Max number of events to return (default 50)
 */
router.get('/visits/:visitId/emr/audit', authenticate, emrExportController.getAuditEvents);

export default router;
