/**
 * EMR Export React Query Hooks
 *
 * Hooks for EMR export operations with React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useState, useCallback } from 'react';
import emrExportService from '@services/emrExport.service';
import type {
  GetTemplatesParams,
  TemplateListItem,
  ExportPreviewResponse,
} from '@services/emrExport.service';
import type {
  EMRTemplate,
  EMRExportPacket,
  AuditEvent,
} from '@typedefs/index';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const emrExportQueryKeys = {
  all: ['emrExport'] as const,
  templates: () => [...emrExportQueryKeys.all, 'templates'] as const,
  templateList: (params: GetTemplatesParams) =>
    [...emrExportQueryKeys.templates(), 'list', params] as const,
  allTemplates: () => [...emrExportQueryKeys.templates(), 'all'] as const,
  template: (id: string) => [...emrExportQueryKeys.templates(), id] as const,
  preview: (visitId: string, templateId: string) =>
    [...emrExportQueryKeys.all, 'preview', visitId, templateId] as const,
  audit: (visitId: string) => [...emrExportQueryKeys.all, 'audit', visitId] as const,
};

// =============================================================================
// TEMPLATE HOOKS
// =============================================================================

/**
 * Hook to get available templates for a discipline and visit type
 */
export function useTemplates(
  params: GetTemplatesParams | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<TemplateListItem[], Error>(
    emrExportQueryKeys.templateList(params || {} as GetTemplatesParams),
    () => emrExportService.getTemplates(params!),
    {
      enabled: !!params?.discipline && !!params?.visitType && (options?.enabled ?? true),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to get all templates (admin)
 */
export function useAllTemplates() {
  return useQuery<TemplateListItem[], Error>(
    emrExportQueryKeys.allTemplates(),
    emrExportService.getAllTemplates,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to get a specific template
 */
export function useTemplate(templateId: string | undefined) {
  return useQuery<EMRTemplate, Error>(
    emrExportQueryKeys.template(templateId || ''),
    () => emrExportService.getTemplateById(templateId!),
    {
      enabled: !!templateId,
      staleTime: 30 * 60 * 1000, // 30 minutes
    }
  );
}

// =============================================================================
// EXPORT HOOKS
// =============================================================================

/**
 * Hook to get export preview
 */
export function useExportPreview(
  visitId: string | undefined,
  templateId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<ExportPreviewResponse, Error>(
    emrExportQueryKeys.preview(visitId || '', templateId || ''),
    () => emrExportService.getExportPreview(visitId!, templateId!),
    {
      enabled: !!visitId && !!templateId && (options?.enabled ?? true),
      staleTime: 30 * 1000, // 30 seconds (preview may change with form edits)
    }
  );
}

/**
 * Hook to generate full export
 */
export function useGenerateExport() {
  const queryClient = useQueryClient();

  return useMutation<
    EMRExportPacket,
    Error,
    { visitId: string; templateId: string }
  >(
    ({ visitId, templateId }) => emrExportService.generateExport(visitId, templateId),
    {
      onSuccess: (_, { visitId }) => {
        // Invalidate audit events to show new export
        queryClient.invalidateQueries(emrExportQueryKeys.audit(visitId));
      },
    }
  );
}

/**
 * Hook to copy export to clipboard
 */
export function useCopyToClipboard() {
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState<boolean | null>(null);

  const copy = useCallback(
    async (visitId: string, templateId: string, text: string) => {
      setIsCopying(true);
      setCopySuccess(null);

      try {
        const success = await emrExportService.copyToClipboard(visitId, templateId, text);
        setCopySuccess(success);
        return success;
      } catch {
        setCopySuccess(false);
        return false;
      } finally {
        setIsCopying(false);
        // Reset success state after 2 seconds
        setTimeout(() => setCopySuccess(null), 2000);
      }
    },
    []
  );

  const resetCopyState = useCallback(() => {
    setCopySuccess(null);
  }, []);

  return {
    copy,
    isCopying,
    copySuccess,
    resetCopyState,
  };
}

/**
 * Hook to export and copy in one operation
 */
export function useExportAndCopy() {
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    text?: string;
    error?: string;
  } | null>(null);

  const exportAndCopy = useCallback(
    async (visitId: string, templateId: string) => {
      setIsExporting(true);
      setExportResult(null);

      try {
        const result = await emrExportService.exportAndCopy(visitId, templateId);
        setExportResult(result);

        if (result.success) {
          // Invalidate audit events
          queryClient.invalidateQueries(emrExportQueryKeys.audit(visitId));
        }

        return result;
      } catch (error) {
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Export failed',
        };
        setExportResult(errorResult);
        return errorResult;
      } finally {
        setIsExporting(false);
      }
    },
    [queryClient]
  );

  const resetExportState = useCallback(() => {
    setExportResult(null);
  }, []);

  return {
    exportAndCopy,
    isExporting,
    exportResult,
    resetExportState,
  };
}

// =============================================================================
// AUDIT HOOKS
// =============================================================================

/**
 * Hook to get audit events for a visit
 */
export function useAuditEvents(
  visitId: string | undefined,
  limit = 50,
  options?: { enabled?: boolean }
) {
  return useQuery<AuditEvent[], Error>(
    emrExportQueryKeys.audit(visitId || ''),
    () => emrExportService.getAuditEvents(visitId!, limit),
    {
      enabled: !!visitId && (options?.enabled ?? true),
      staleTime: 60 * 1000, // 1 minute
    }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  useTemplates,
  useAllTemplates,
  useTemplate,
  useExportPreview,
  useGenerateExport,
  useCopyToClipboard,
  useExportAndCopy,
  useAuditEvents,
  emrExportQueryKeys,
};
