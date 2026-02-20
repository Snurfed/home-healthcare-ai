/**
 * EMR Template & Adapter Types (Frontend)
 *
 * Types for EMR template mapping and export functionality.
 * Mirrors Backend/src/domain/emr/types.ts
 */

import type { Discipline, VisitType } from './canonical.types';

// =============================================================================
// EMR VENDORS (Home Health Specific)
// =============================================================================

export type HomeHealthEMRVendor =
  | 'homecare_homebase'
  | 'wellsky'
  | 'kinnser'
  | 'axxess'
  | 'hchb'
  | 'devero'
  | 'brightree'
  | 'thornberry'
  | 'netsmart'
  | 'meditech'
  | 'epic'
  | 'cerner'
  | 'pointcare'
  | 'custom';

// =============================================================================
// EMR TEMPLATE
// =============================================================================

export interface EMRTemplate {
  id: string;
  name: string;
  description?: string;
  emrVendor: HomeHealthEMRVendor;
  agencyId?: string;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  previousVersionId?: string;
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  sections: EMRTemplateSection[];
  globalTransforms?: GlobalTransform[];
  outputConfig: OutputConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  notes?: string;
}

export interface EMRTemplateSection {
  id: string;
  emrSectionId: string;
  emrSectionName: string;
  order: number;
  fields: EMRTemplateField[];
  conditionalInclude?: EMRCondition[];
}

export interface EMRTemplateField {
  id: string;
  emrFieldId: string;
  emrLabel: string;
  emrAnswerType: EMRAnswerType;
  order: number;
  mapping: EMRFieldMapping;
  allowedValues?: EMRAllowedValue[];
  emrRequired: boolean;
  emrRequiredRules?: EMRCondition[];
  includeInOutput: boolean;
  conditionalInclude?: EMRCondition[];
  formatting?: EMRFormatting;
  notes?: string;
}

export type EMRAnswerType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'multi_checkbox'
  | 'coded_value'
  | 'vitals_compound'
  | 'signature'
  | 'custom';

export interface EMRFieldMapping {
  type: 'direct' | 'transform' | 'composite' | 'literal' | 'computed';
  canonicalConceptId?: string;
  compositeFields?: CompositeFieldMapping[];
  literalValue?: string;
  computeExpression?: string;
  transform?: TransformDefinition;
  defaultValue?: string;
  emptyBehavior?: 'blank' | 'default' | 'omit' | 'error';
}

export interface CompositeFieldMapping {
  canonicalConceptId: string;
  order: number;
  separator?: string;
  transform?: TransformDefinition;
  prefix?: string;
  suffix?: string;
}

export interface TransformDefinition {
  type: TransformType;
  params?: Record<string, unknown>;
  valueMap?: Record<string, string>;
  formatString?: string;
  customFn?: string;
}

export type TransformType =
  | 'map'
  | 'format'
  | 'unit_convert'
  | 'date_format'
  | 'number_format'
  | 'boolean_to_text'
  | 'array_join'
  | 'concat'
  | 'truncate'
  | 'uppercase'
  | 'lowercase'
  | 'titlecase'
  | 'custom';

export interface EMRAllowedValue {
  code: string;
  label: string;
  canonicalCodes?: string[];
  description?: string;
  deprecated?: boolean;
}

export interface EMRCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'is_set' | 'is_not_set' | 'greater_than' | 'less_than';
  value?: unknown;
}

export interface EMRFormatting {
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  wrapInQuotes?: boolean;
  lineBreaks?: 'preserve' | 'remove' | 'convert_to_space';
  casing?: 'preserve' | 'uppercase' | 'lowercase' | 'titlecase';
}

export interface GlobalTransform {
  name: string;
  appliesTo: 'all' | 'text' | 'numbers' | 'dates' | string[];
  transform: TransformDefinition;
}

export interface OutputConfig {
  clipboardFormat: 'plain_text' | 'rich_text' | 'html' | 'markdown';
  clipboardDelimiter: 'newline' | 'tab' | 'pipe' | 'custom';
  customDelimiter?: string;
  includeLabels: boolean;
  labelSeparator: string;
  sectionSeparator: string;
  emptyFieldBehavior: 'include_blank' | 'omit' | 'include_na';
  naText: string;
  structuredFormat: 'json' | 'xml' | 'hl7' | 'fhir_r4';
  fhirResourceType?: string;
  validateBeforeExport: boolean;
  requireAllRequired: boolean;
}

// =============================================================================
// EMR EXPORT PACKET
// =============================================================================

export interface EMRExportPacket {
  id: string;
  visitId: string;
  templateId: string;
  templateVersion: string;
  emrVendor: HomeHealthEMRVendor;
  generatedAt: string;
  generatedBy: string;
  validation: ExportValidation;
  clipboardText: string;
  structuredData: Record<string, unknown>;
  fieldValues: ExportedField[];
  mappingLog?: MappingLogEntry[];
}

export interface ExportValidation {
  isValid: boolean;
  canExport: boolean;
  errors: ExportValidationIssue[];
  warnings: ExportValidationIssue[];
  missingRequired: MissingRequiredField[];
  completionPercentage: number;
}

export interface ExportValidationIssue {
  type: 'canonical_missing' | 'emr_required' | 'transform_error' | 'value_invalid';
  field?: string;
  emrFieldId?: string;
  canonicalConceptId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MissingRequiredField {
  emrFieldId: string;
  emrLabel: string;
  canonicalConceptId?: string;
  canonicalLabel?: string;
}

export interface ExportedField {
  emrFieldId: string;
  emrLabel: string;
  emrSectionId: string;
  value: string;
  rawValue?: unknown;
  canonicalConceptId?: string;
  transformApplied?: string;
  included: boolean;
  reason?: string;
}

export interface MappingLogEntry {
  emrFieldId: string;
  canonicalConceptId?: string;
  inputValue?: unknown;
  outputValue?: string;
  transformsApplied: string[];
  success: boolean;
  error?: string;
}

// =============================================================================
// TEMPLATE VERSION MANAGEMENT
// =============================================================================

export interface EMRTemplateVersion {
  id: string;
  templateId: string;
  version: string;
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  templateData: EMRTemplate;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  deprecatedAt?: string;
  deprecatedBy?: string;
  notes?: string;
}

export interface TemplateChangeLog {
  id: string;
  templateId: string;
  versionFrom: string;
  versionTo: string;
  changeType: 'created' | 'updated' | 'published' | 'deprecated' | 'rolled_back';
  changes: FieldChange[];
  userId: string;
  timestamp: string;
  notes?: string;
}

export interface FieldChange {
  fieldId: string;
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: unknown;
  newValue?: unknown;
  path?: string;
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  timestamp: string;
  userId: string;
  userRole?: string;
  patientId?: string;
  episodeId?: string;
  visitId?: string;
  templateId?: string;
  templateVersion?: string;
  action: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditEventType =
  | 'template_created'
  | 'template_updated'
  | 'template_published'
  | 'template_deprecated'
  | 'template_rolled_back'
  | 'visit_created'
  | 'visit_updated'
  | 'visit_finalized'
  | 'visit_amended'
  | 'export_generated'
  | 'export_copied'
  | 'validation_failed'
  | 'user_login'
  | 'user_logout';

// =============================================================================
// UI HELPER TYPES
// =============================================================================

export interface TemplateListItem {
  id: string;
  name: string;
  emrVendor: HomeHealthEMRVendor;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  status: EMRTemplate['status'];
  updatedAt: string;
  fieldCount: number;
}

export interface ExportPreview {
  clipboardText: string;
  validation: ExportValidation;
  fieldCount: number;
  completedFields: number;
}

export const HOME_HEALTH_EMR_VENDOR_CONFIG: Record<HomeHealthEMRVendor, { label: string; shortLabel: string }> = {
  homecare_homebase: { label: 'HomeCare HomeBase', shortLabel: 'HCHB' },
  wellsky: { label: 'WellSky', shortLabel: 'WellSky' },
  kinnser: { label: 'Kinnser', shortLabel: 'Kinnser' },
  axxess: { label: 'Axxess', shortLabel: 'Axxess' },
  hchb: { label: 'HCHB', shortLabel: 'HCHB' },
  devero: { label: 'Devero', shortLabel: 'Devero' },
  brightree: { label: 'Brightree', shortLabel: 'Brightree' },
  thornberry: { label: 'Thornberry', shortLabel: 'Thornberry' },
  netsmart: { label: 'Netsmart', shortLabel: 'Netsmart' },
  meditech: { label: 'MEDITECH', shortLabel: 'MEDITECH' },
  epic: { label: 'Epic', shortLabel: 'Epic' },
  cerner: { label: 'Cerner', shortLabel: 'Cerner' },
  pointcare: { label: 'PointCare', shortLabel: 'PointCare' },
  custom: { label: 'Custom', shortLabel: 'Custom' },
};
