/**
 * EMR Export Controller
 *
 * HTTP handlers for EMR export operations including:
 * - Template listing
 * - Export generation
 * - Clipboard formatting
 * - Audit log retrieval
 */

import { Request, Response } from 'express';
import emrExportService from '../services/emrExport.service';
import type { Discipline, VisitType } from '../domain/canonical/types';
import type { EMRVendor } from '../domain/emr/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GetTemplatesQuery {
  discipline: Discipline;
  visitType: VisitType;
  emrVendor?: EMRVendor;
  agencyId?: string;
}

interface GenerateExportBody {
  templateId: string;
}

interface LogCopyBody {
  templateId: string;
}

// =============================================================================
// TEMPLATE ENDPOINTS
// =============================================================================

/**
 * Get available templates for a discipline and visit type
 * GET /api/emr/templates?discipline=RN&visitType=SOC&emrVendor=HCHB
 */
export async function getTemplates(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as unknown as GetTemplatesQuery;

    if (!query.discipline) {
      res.status(400).json({ error: 'Discipline is required' });
      return;
    }

    if (!query.visitType) {
      res.status(400).json({ error: 'Visit type is required' });
      return;
    }

    // Validate discipline
    const validDisciplines: Discipline[] = ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'];
    if (!validDisciplines.includes(query.discipline)) {
      res.status(400).json({ error: `Invalid discipline. Must be one of: ${validDisciplines.join(', ')}` });
      return;
    }

    // Validate visit type
    const validVisitTypes: VisitType[] = ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL', 'SUPERVISORY'];
    if (!validVisitTypes.includes(query.visitType)) {
      res.status(400).json({ error: `Invalid visit type. Must be one of: ${validVisitTypes.join(', ')}` });
      return;
    }

    const templates = emrExportService.getAvailableTemplates({
      discipline: query.discipline,
      visitType: query.visitType,
      emrVendor: query.emrVendor,
      agencyId: query.agencyId,
    });

    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get all templates (admin endpoint)
 * GET /api/emr/templates/all
 */
export async function getAllTemplates(_req: Request, res: Response): Promise<void> {
  try {
    const templates = emrExportService.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting all templates:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get a specific template by ID
 * GET /api/emr/templates/:templateId
 */
export async function getTemplateById(req: Request, res: Response): Promise<void> {
  try {
    const templateId = req.params['templateId'];

    if (!templateId) {
      res.status(400).json({ error: 'Template ID is required' });
      return;
    }

    const template = emrExportService.getTemplateById(templateId);

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      error: 'Failed to get template',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// EXPORT GENERATION ENDPOINTS
// =============================================================================

/**
 * Generate export preview for a visit
 * GET /api/visits/:visitId/emr/preview?templateId=xxx
 */
export async function getExportPreview(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const templateId = req.query['templateId'] as string;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!templateId) {
      res.status(400).json({ error: 'Template ID is required' });
      return;
    }

    const preview = await emrExportService.generateExportPreview({
      visitId,
      templateId,
    });

    res.json(preview);
  } catch (error) {
    console.error('Error generating export preview:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to generate export preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate full export for a visit
 * POST /api/visits/:visitId/emr/export
 */
export async function generateExport(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as GenerateExportBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.templateId) {
      res.status(400).json({ error: 'Template ID is required' });
      return;
    }

    // Get user ID from auth context (placeholder for now)
    const userId = (req as Request & { user?: { id: string } }).user?.id || 'system';

    const exportPacket = await emrExportService.generateExport(
      {
        visitId,
        templateId: body.templateId,
      },
      userId
    );

    res.json(exportPacket);
  } catch (error) {
    console.error('Error generating export:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to generate export',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Log clipboard copy event
 * POST /api/visits/:visitId/emr/copy
 */
export async function logClipboardCopy(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as LogCopyBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.templateId) {
      res.status(400).json({ error: 'Template ID is required' });
      return;
    }

    // Get user ID from auth context (placeholder for now)
    const userId = (req as Request & { user?: { id: string } }).user?.id || 'system';

    await emrExportService.logClipboardCopy(visitId, body.templateId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging clipboard copy:', error);
    res.status(500).json({
      error: 'Failed to log clipboard copy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// AUDIT LOG ENDPOINTS
// =============================================================================

/**
 * Get audit events for a visit
 * GET /api/visits/:visitId/emr/audit
 */
export async function getAuditEvents(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const limit = parseInt(req.query['limit'] as string) || 50;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    const events = await emrExportService.getAuditEvents(visitId, limit);
    res.json(events);
  } catch (error) {
    console.error('Error getting audit events:', error);
    res.status(500).json({
      error: 'Failed to get audit events',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  getTemplates,
  getAllTemplates,
  getTemplateById,
  getExportPreview,
  generateExport,
  logClipboardCopy,
  getAuditEvents,
};
