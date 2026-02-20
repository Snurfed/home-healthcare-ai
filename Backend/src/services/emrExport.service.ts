/**
 * EMR Export Service
 *
 * Business logic layer for EMR export operations including:
 * - Template management
 * - Export generation
 * - Clipboard formatting
 * - Audit logging
 */

import prisma from '../config/prisma';
import { exportToEMR } from '../domain/emr/emrAdapter.service';
import { HCHB_RN_SOC_TEMPLATE } from '../domain/emr/templates/hchb-rn-soc.template';
import type {
  EMRTemplate,
  EMRExportPacket,
  EMRVendor,
  AuditEvent,
  AuditEventType,
} from '../domain/emr/types';
import type {
  CanonicalVisitNote,
  CanonicalResponse,
  Discipline,
  VisitType,
} from '../domain/canonical/types';

// =============================================================================
// TYPES
// =============================================================================

export interface GetTemplatesRequest {
  discipline: Discipline;
  visitType: VisitType;
  emrVendor?: EMRVendor;
  agencyId?: string;
}

export interface GenerateExportRequest {
  visitId: string;
  templateId: string;
}

export interface ExportPreviewRequest {
  visitId: string;
  templateId: string;
}

export interface ExportPreviewResponse {
  clipboardText: string;
  validation: EMRExportPacket['validation'];
  fieldCount: number;
  completedFields: number;
  templateName: string;
  emrVendor: EMRVendor;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  emrVendor: EMRVendor;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  status: EMRTemplate['status'];
  fieldCount: number;
  isDefault?: boolean;
}

// =============================================================================
// TEMPLATE STORAGE (In-memory for now, would be database in production)
// =============================================================================

const TEMPLATE_REGISTRY: Map<string, EMRTemplate> = new Map();

// Register default templates
TEMPLATE_REGISTRY.set(HCHB_RN_SOC_TEMPLATE.id, HCHB_RN_SOC_TEMPLATE);

/**
 * Register a template (for testing or dynamic loading)
 */
export function registerTemplate(template: EMRTemplate): void {
  TEMPLATE_REGISTRY.set(template.id, template);
}

// =============================================================================
// TEMPLATE RETRIEVAL
// =============================================================================

/**
 * Get available templates for a discipline and visit type
 */
export function getAvailableTemplates(request: GetTemplatesRequest): TemplateListItem[] {
  const { discipline, visitType, emrVendor, agencyId } = request;

  const templates: TemplateListItem[] = [];

  for (const template of Array.from(TEMPLATE_REGISTRY.values())) {
    // Filter by discipline and visit type
    if (template.discipline !== discipline || template.visitType !== visitType) {
      continue;
    }

    // Filter by EMR vendor if specified
    if (emrVendor && template.emrVendor !== emrVendor) {
      continue;
    }

    // Filter by agency if specified (agency-specific or global)
    if (agencyId && template.agencyId && template.agencyId !== agencyId) {
      continue;
    }

    // Only include published templates
    if (template.status !== 'published') {
      continue;
    }

    const fieldCount = template.sections.reduce(
      (sum, section) => sum + section.fields.length,
      0
    );

    templates.push({
      id: template.id,
      name: template.name,
      description: template.description,
      emrVendor: template.emrVendor,
      discipline: template.discipline,
      visitType: template.visitType,
      version: template.version,
      status: template.status,
      fieldCount,
      isDefault: !template.agencyId, // Global templates are marked as default
    });
  }

  return templates;
}

/**
 * Get a template by ID
 */
export function getTemplateById(templateId: string): EMRTemplate | undefined {
  return TEMPLATE_REGISTRY.get(templateId);
}

/**
 * Get all templates (for admin)
 */
export function getAllTemplates(): TemplateListItem[] {
  const templates: TemplateListItem[] = [];

  for (const template of Array.from(TEMPLATE_REGISTRY.values())) {
    const fieldCount = template.sections.reduce(
      (sum, section) => sum + section.fields.length,
      0
    );

    templates.push({
      id: template.id,
      name: template.name,
      description: template.description,
      emrVendor: template.emrVendor,
      discipline: template.discipline,
      visitType: template.visitType,
      version: template.version,
      status: template.status,
      fieldCount,
      isDefault: !template.agencyId,
    });
  }

  return templates;
}

// =============================================================================
// EXPORT GENERATION
// =============================================================================

/**
 * Generate export preview (without saving)
 */
export async function generateExportPreview(
  request: ExportPreviewRequest
): Promise<ExportPreviewResponse> {
  const { visitId, templateId } = request;

  // Get the template
  const template = TEMPLATE_REGISTRY.get(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Get the visit note
  const visitNote = await getCanonicalVisitNote(visitId);
  if (!visitNote) {
    throw new Error(`Visit ${visitId} not found`);
  }

  // Generate export
  const exportPacket = exportToEMR(visitNote, template);

  // Count fields
  const fieldCount = exportPacket.fieldValues.length;
  const completedFields = exportPacket.fieldValues.filter(
    (f) => f.included && f.value !== ''
  ).length;

  return {
    clipboardText: exportPacket.clipboardText,
    validation: exportPacket.validation,
    fieldCount,
    completedFields,
    templateName: template.name,
    emrVendor: template.emrVendor,
  };
}

/**
 * Generate full export packet
 */
export async function generateExport(
  request: GenerateExportRequest,
  userId: string
): Promise<EMRExportPacket> {
  const { visitId, templateId } = request;

  // Get the template
  const template = TEMPLATE_REGISTRY.get(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Get the visit note
  const visitNote = await getCanonicalVisitNote(visitId);
  if (!visitNote) {
    throw new Error(`Visit ${visitId} not found`);
  }

  // Generate export
  const exportPacket = exportToEMR(visitNote, template);

  // Log the export event
  await logAuditEvent({
    eventType: 'export_generated',
    userId,
    visitId,
    templateId,
    templateVersion: template.version,
    action: 'Generated EMR export',
    details: {
      emrVendor: template.emrVendor,
      fieldCount: exportPacket.fieldValues.length,
      completedFields: exportPacket.fieldValues.filter((f) => f.included).length,
      completionPercentage: exportPacket.validation.completionPercentage,
      hasErrors: exportPacket.validation.errors.length > 0,
      hasWarnings: exportPacket.validation.warnings.length > 0,
    },
    success: true,
  });

  return exportPacket;
}

/**
 * Log clipboard copy event
 */
export async function logClipboardCopy(
  visitId: string,
  templateId: string,
  userId: string
): Promise<void> {
  const template = TEMPLATE_REGISTRY.get(templateId);

  await logAuditEvent({
    eventType: 'export_copied',
    userId,
    visitId,
    templateId,
    templateVersion: template?.version,
    action: 'Copied export to clipboard',
    details: {
      emrVendor: template?.emrVendor,
    },
    success: true,
  });
}

// =============================================================================
// VISIT NOTE RETRIEVAL
// =============================================================================

/**
 * Build canonical visit note from database
 */
async function getCanonicalVisitNote(visitId: string): Promise<CanonicalVisitNote | null> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      episode: true,
    },
  });

  if (!visit) {
    return null;
  }

  // Parse visit notes JSON
  const notes = parseJsonField(visit.visitNotes);
  const responses = (notes['responses'] as Record<string, CanonicalResponse>) || {};
  const discipline = (notes['discipline'] as Discipline) || 'RN';
  const visitType = (notes['visitType'] as VisitType) || 'FOLLOWUP';

  return {
    id: (notes['id'] as string) || visitId,
    patientId: visit.patientId,
    episodeId: visit.episodeId,
    clinicianId: visit.clinicianId || '',
    discipline,
    visitType,
    visitDate: visit.scheduledDate.toISOString().split('T')[0]!,
    timeIn: notes['timeIn'] as string | undefined,
    timeOut: notes['timeOut'] as string | undefined,
    status: (notes['status'] as CanonicalVisitNote['status']) || 'draft',
    responses,
    vitals: notes['vitals'] as CanonicalVisitNote['vitals'],
    wounds: notes['wounds'] as CanonicalVisitNote['wounds'],
    medications: notes['medications'] as CanonicalVisitNote['medications'],
    goals: notes['goals'] as CanonicalVisitNote['goals'],
    interventions: notes['interventions'] as CanonicalVisitNote['interventions'],
    narratives: notes['narratives'] as Record<string, string>,
    signatures: (notes['signatures'] as CanonicalVisitNote['signatures']) || [],
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
    finalizedAt: notes['finalizedAt'] as string | undefined,
    finalizedBy: notes['finalizedBy'] as string | undefined,
    activeModules: (notes['activeModules'] as string[]) || [],
  };
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

interface LogAuditEventParams {
  eventType: AuditEventType;
  userId: string;
  visitId?: string;
  patientId?: string;
  episodeId?: string;
  templateId?: string;
  templateVersion?: string;
  action: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event
 */
async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    eventType: params.eventType,
    timestamp: new Date().toISOString(),
    userId: params.userId,
    visitId: params.visitId,
    patientId: params.patientId,
    episodeId: params.episodeId,
    templateId: params.templateId,
    templateVersion: params.templateVersion,
    action: params.action,
    details: params.details,
    previousState: params.previousState,
    newState: params.newState,
    success: params.success,
    errorMessage: params.errorMessage,
  };

  // In production, this would write to an audit log table
  // For now, log to console in development
  if (process.env['NODE_ENV'] !== 'production') {
    console.log('[AUDIT]', JSON.stringify(event, null, 2));
  }

  // TODO: Store in database audit_events table
  // await prisma.auditEvent.create({ data: event });
}

/**
 * Get audit events for a visit
 */
export async function getAuditEvents(
  visitId: string,
  _limit = 50
): Promise<AuditEvent[]> {
  // TODO: Query from database
  // For now, return empty array
  console.log(`Getting audit events for visit ${visitId}`);
  return [];
}

// =============================================================================
// HELPERS
// =============================================================================

function parseJsonField(value: string | null | undefined): Record<string, unknown> {
  if (value === null || value === undefined || value === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  getAvailableTemplates,
  getTemplateById,
  getAllTemplates,
  generateExportPreview,
  generateExport,
  logClipboardCopy,
  getAuditEvents,
  registerTemplate,
};
