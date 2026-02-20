/**
 * EMR Export Panel
 *
 * Panel for exporting visit documentation to EMR systems.
 * Includes template selection, preview, and one-click copy.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useTemplates,
  useExportPreview,
  useExportAndCopy,
  useAuditEvents,
} from '@hooks/queries/useEmrExport';
import { Button, Spinner, Badge } from '@components/common';
import { HOME_HEALTH_EMR_VENDOR_CONFIG } from '@typedefs/emrTemplate.types';
import type { Discipline, VisitType, HomeHealthEMRVendor } from '@typedefs/index';

// =============================================================================
// ICONS
// =============================================================================

const ClipboardIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
    />
  </svg>
);

const CheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const RefreshIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface EMRExportPanelProps {
  visitId: string;
  discipline: Discipline;
  visitType: VisitType;
  onExportComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function EMRExportPanel({
  visitId,
  discipline,
  visitType,
  onExportComplete,
}: EMRExportPanelProps) {
  // Local state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [copiedRecently, setCopiedRecently] = useState(false);

  // Fetch templates
  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useTemplates({ discipline, visitType });

  // Fetch preview when template selected
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = useExportPreview(visitId, selectedTemplateId || undefined, {
    enabled: !!selectedTemplateId,
  });

  // Fetch audit events
  const { data: auditEvents } = useAuditEvents(visitId, 10);

  // Export and copy hook
  const { exportAndCopy, isExporting, exportResult } = useExportAndCopy();

  // Auto-select first template
  useMemo(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, selectedTemplateId]);

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (!selectedTemplateId) return;

    const result = await exportAndCopy(visitId, selectedTemplateId);

    if (result.success) {
      setCopiedRecently(true);
      setTimeout(() => setCopiedRecently(false), 3000);
      onExportComplete?.();
    }
  }, [visitId, selectedTemplateId, exportAndCopy, onExportComplete]);

  // Get selected template
  const selectedTemplate = useMemo(() => {
    return templates?.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // Get vendor config
  const vendorConfig = useMemo(() => {
    if (!selectedTemplate) return null;
    return HOME_HEALTH_EMR_VENDOR_CONFIG[selectedTemplate.emrVendor as HomeHealthEMRVendor];
  }, [selectedTemplate]);

  // Loading state
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-600">Loading EMR templates...</span>
      </div>
    );
  }

  // Error state
  if (templatesError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <WarningIcon className="w-5 h-5" />
          <span className="font-medium">Failed to load EMR templates</span>
        </div>
        <p className="mt-2 text-sm text-red-600">
          {templatesError instanceof Error ? templatesError.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  // No templates state
  if (!templates || templates.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <ClipboardIcon className="w-12 h-12 mx-auto text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No Export Templates</h3>
        <p className="mt-2 text-sm text-gray-500">
          No EMR export templates are configured for {discipline} - {visitType} visits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select EMR Template</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((template) => {
            const config = HOME_HEALTH_EMR_VENDOR_CONFIG[template.emrVendor as HomeHealthEMRVendor];
            const isSelected = template.id === selectedTemplateId;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={`
                  flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium text-gray-900">{template.name}</span>
                  {template.isDefault && (
                    <Badge variant="info" size="sm">
                      Default
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-gray-500 mt-1">
                  {config?.label || template.emrVendor}
                </span>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span>{template.fieldCount} fields</span>
                  <span>v{template.version}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Section */}
      {selectedTemplateId && (
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Preview Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Export Preview</h3>
              {vendorConfig && (
                <p className="text-sm text-gray-500">
                  Formatted for {vendorConfig.label}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refetchPreview()}
                disabled={previewLoading}
              >
                <RefreshIcon className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="primary"
                onClick={handleCopy}
                disabled={isExporting || !preview || preview.validation.errors.length > 0}
              >
                {isExporting ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Copying...</span>
                  </>
                ) : copiedRecently ? (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Validation Status */}
          {preview && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Completion */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          preview.validation.completionPercentage >= 100
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${preview.validation.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">
                      {preview.completedFields}/{preview.fieldCount} fields
                    </span>
                  </div>

                  {/* Errors/Warnings */}
                  {preview.validation.errors.length > 0 && (
                    <Badge variant="error">
                      {preview.validation.errors.length} error
                      {preview.validation.errors.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {preview.validation.warnings.length > 0 && (
                    <Badge variant="warning">
                      {preview.validation.warnings.length} warning
                      {preview.validation.warnings.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {preview.validation.errors.length === 0 &&
                    preview.validation.warnings.length === 0 && (
                      <Badge variant="success">Ready to export</Badge>
                    )}
                </div>
              </div>

              {/* Validation Messages */}
              {(preview.validation.errors.length > 0 ||
                preview.validation.warnings.length > 0) && (
                <div className="mt-3 space-y-2">
                  {preview.validation.errors.map((error, idx) => (
                    <div
                      key={`error-${idx}`}
                      className="flex items-center gap-2 text-sm text-red-600"
                    >
                      <WarningIcon className="w-4 h-4 flex-shrink-0" />
                      <span>{error.message}</span>
                    </div>
                  ))}
                  {preview.validation.warnings.map((warning, idx) => (
                    <div
                      key={`warning-${idx}`}
                      className="flex items-center gap-2 text-sm text-yellow-600"
                    >
                      <WarningIcon className="w-4 h-4 flex-shrink-0" />
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview Content */}
          <div className="p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
                <span className="ml-3 text-gray-600">Generating preview...</span>
              </div>
            ) : previewError ? (
              <div className="text-red-600 text-center py-8">
                Failed to generate preview
              </div>
            ) : preview ? (
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-auto font-mono">
                {preview.clipboardText}
              </pre>
            ) : null}
          </div>
        </div>
      )}

      {/* Export Result */}
      {exportResult && (
        <div
          className={`p-4 rounded-lg ${
            exportResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {exportResult.success ? (
              <>
                <CheckIcon className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">
                  Successfully copied to clipboard
                </span>
              </>
            ) : (
              <>
                <WarningIcon className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">{exportResult.error}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recent Exports */}
      {auditEvents && auditEvents.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Exports</h3>
          <div className="space-y-2">
            {auditEvents
              .filter((e) => e.eventType === 'export_copied' || e.eventType === 'export_generated')
              .slice(0, 5)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      {event.eventType === 'export_copied' ? 'Copied' : 'Generated'}
                    </span>
                    {event.templateId && (
                      <span className="text-xs text-gray-500">
                        ({event.templateVersion || 'unknown version'})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
