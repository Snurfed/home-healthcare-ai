/**
 * EMR Export Service
 *
 * API service for EMR export operations including:
 * - Template management
 * - Export generation
 * - Clipboard formatting
 * - Audit logging
 */

import apiClient from './api/client';
import type {
  Discipline,
  VisitType,
  HomeHealthEMRVendor,
  EMRExportPacket,
  EMRTemplate,
  AuditEvent,
} from '@typedefs/index';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  emrVendor: HomeHealthEMRVendor;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  status: 'draft' | 'published' | 'deprecated';
  fieldCount: number;
  isDefault?: boolean;
}

export interface GetTemplatesParams {
  discipline: Discipline;
  visitType: VisitType;
  emrVendor?: HomeHealthEMRVendor;
  agencyId?: string;
}

export interface ExportPreviewResponse {
  clipboardText: string;
  validation: EMRExportPacket['validation'];
  fieldCount: number;
  completedFields: number;
  templateName: string;
  emrVendor: HomeHealthEMRVendor;
}

export interface GenerateExportRequest {
  templateId: string;
}

export interface LogCopyRequest {
  templateId: string;
}

// =============================================================================
// TEMPLATE API
// =============================================================================

/**
 * Get available templates for a discipline and visit type
 */
export async function getTemplates(params: GetTemplatesParams): Promise<TemplateListItem[]> {
  const queryParams = new URLSearchParams({
    discipline: params.discipline,
    visitType: params.visitType,
  });

  if (params.emrVendor) {
    queryParams.append('emrVendor', params.emrVendor);
  }

  if (params.agencyId) {
    queryParams.append('agencyId', params.agencyId);
  }

  const response = await apiClient.get<TemplateListItem[]>(
    `/emr/templates?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get all templates (admin endpoint)
 */
export async function getAllTemplates(): Promise<TemplateListItem[]> {
  const response = await apiClient.get<TemplateListItem[]>('/emr/templates/all');
  return response.data;
}

/**
 * Get a specific template by ID
 */
export async function getTemplateById(templateId: string): Promise<EMRTemplate> {
  const response = await apiClient.get<EMRTemplate>(`/emr/templates/${templateId}`);
  return response.data;
}

// =============================================================================
// EXPORT GENERATION API
// =============================================================================

/**
 * Generate export preview for a visit
 */
export async function getExportPreview(
  visitId: string,
  templateId: string
): Promise<ExportPreviewResponse> {
  const response = await apiClient.get<ExportPreviewResponse>(
    `/visits/${visitId}/emr/preview?templateId=${encodeURIComponent(templateId)}`
  );
  return response.data;
}

/**
 * Generate full export for a visit
 */
export async function generateExport(
  visitId: string,
  templateId: string
): Promise<EMRExportPacket> {
  const response = await apiClient.post<EMRExportPacket>(
    `/visits/${visitId}/emr/export`,
    { templateId }
  );
  return response.data;
}

/**
 * Log clipboard copy event
 */
export async function logClipboardCopy(
  visitId: string,
  templateId: string
): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(
    `/visits/${visitId}/emr/copy`,
    { templateId }
  );
  return response.data;
}

// =============================================================================
// AUDIT LOG API
// =============================================================================

/**
 * Get audit events for a visit
 */
export async function getAuditEvents(
  visitId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const response = await apiClient.get<AuditEvent[]>(
    `/visits/${visitId}/emr/audit?limit=${limit}`
  );
  return response.data;
}

// =============================================================================
// CLIPBOARD UTILITIES
// =============================================================================

/**
 * Copy text to clipboard and log the event
 */
export async function copyToClipboard(
  visitId: string,
  templateId: string,
  text: string
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    // Log the copy event (fire and forget)
    logClipboardCopy(visitId, templateId).catch(console.error);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Generate export and copy to clipboard in one operation
 */
export async function exportAndCopy(
  visitId: string,
  templateId: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const preview = await getExportPreview(visitId, templateId);
    const copied = await copyToClipboard(visitId, templateId, preview.clipboardText);

    if (!copied) {
      return { success: false, error: 'Failed to copy to clipboard' };
    }

    return { success: true, text: preview.clipboardText };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  getTemplates,
  getAllTemplates,
  getTemplateById,
  getExportPreview,
  generateExport,
  logClipboardCopy,
  getAuditEvents,
  copyToClipboard,
  exportAndCopy,
};
