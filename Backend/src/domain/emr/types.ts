/**
 * EMR Template & Adapter Types
 *
 * These types define how canonical clinical data maps to specific EMR systems.
 * Each EMR vendor (and potentially each agency) can have different field structures.
 */

import type { Discipline, VisitType } from '../canonical/types';

// =============================================================================
// EMR VENDORS
// =============================================================================

export type EMRVendor =
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
// EMR TEMPLATE (Field Mapping Definition)
// =============================================================================

/**
 * EMRTemplate defines how to map canonical data to a specific EMR's format.
 * Templates are versioned and can be agency-specific.
 */
export interface EMRTemplate {
  id: string;
  name: string;
  description?: string;

  // Targeting
  emrVendor: EMRVendor;
  agencyId?: string;           // If agency-specific
  discipline: Discipline;
  visitType: VisitType;

  // Versioning
  version: string;
  previousVersionId?: string;
  status: 'draft' | 'published' | 'deprecated' | 'archived';

  // Template structure
  sections: EMRTemplateSection[];

  // Global transforms
  globalTransforms?: GlobalTransform[];

  // Output configuration
  outputConfig: OutputConfig;

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  notes?: string;
}

export interface EMRTemplateSection {
  id: string;
  emrSectionId: string;        // EMR's internal section ID
  emrSectionName: string;      // EMR's section label
  order: number;
  fields: EMRTemplateField[];
  conditionalInclude?: EMRCondition[];
}

/**
 * EMRTemplateField defines a single field in the EMR output.
 */
export interface EMRTemplateField {
  id: string;

  // EMR-specific identifiers
  emrFieldId: string;          // EMR's internal field ID
  emrLabel: string;            // EMR's exact field label
  emrAnswerType: EMRAnswerType;

  // Order in the EMR output
  order: number;

  // Mapping to canonical data
  mapping: EMRFieldMapping;

  // EMR-specific allowed values
  allowedValues?: EMRAllowedValue[];

  // Requirements in EMR context
  emrRequired: boolean;
  emrRequiredRules?: EMRCondition[];

  // Visibility in EMR output
  includeInOutput: boolean;
  conditionalInclude?: EMRCondition[];

  // Formatting
  formatting?: EMRFormatting;

  // Notes for template builders
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

/**
 * EMRFieldMapping defines how to extract data from canonical model.
 */
export interface EMRFieldMapping {
  type: 'direct' | 'transform' | 'composite' | 'literal' | 'computed';

  // For type='direct' or 'transform'
  canonicalConceptId?: string;

  // For type='composite' - combine multiple fields
  compositeFields?: CompositeFieldMapping[];

  // For type='literal' - static value
  literalValue?: string;

  // For type='computed' - derive from other values
  computeExpression?: string;

  // Transform function
  transform?: TransformDefinition;

  // Fallback if no value
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

/**
 * TransformDefinition specifies how to convert canonical values to EMR format.
 */
export interface TransformDefinition {
  type: TransformType;
  params?: Record<string, unknown>;
  valueMap?: Record<string, string>;  // For 'map' type
  formatString?: string;               // For 'format' type
  customFn?: string;                   // For 'custom' type
}

export type TransformType =
  | 'map'              // Map canonical value to EMR code
  | 'format'           // String formatting
  | 'unit_convert'     // Convert units (lbs->kg, F->C)
  | 'date_format'      // Date formatting
  | 'number_format'    // Number formatting
  | 'boolean_to_text'  // true/false -> "Yes"/"No" or codes
  | 'array_join'       // Join array values
  | 'concat'           // Concatenate strings
  | 'truncate'         // Truncate to max length
  | 'uppercase'
  | 'lowercase'
  | 'titlecase'
  | 'custom';          // Custom function name

export interface EMRAllowedValue {
  code: string;               // EMR's internal code
  label: string;              // EMR's display label
  canonicalCodes?: string[];  // Canonical codes that map to this
  description?: string;
  deprecated?: boolean;
}

export interface EMRCondition {
  field: string;              // canonicalConceptId or special field
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
  // Clipboard output
  clipboardFormat: 'plain_text' | 'rich_text' | 'html' | 'markdown';
  clipboardDelimiter: 'newline' | 'tab' | 'pipe' | 'custom';
  customDelimiter?: string;
  includeLabels: boolean;
  labelSeparator: string;     // e.g., ": " or " - "
  sectionSeparator: string;   // e.g., "\n\n" or "---"
  emptyFieldBehavior: 'include_blank' | 'omit' | 'include_na';
  naText: string;             // e.g., "N/A" or "-"

  // Structured output
  structuredFormat: 'json' | 'xml' | 'hl7' | 'fhir_r4';
  fhirResourceType?: string;  // For FHIR output

  // Validation
  validateBeforeExport: boolean;
  requireAllRequired: boolean;
}

// =============================================================================
// EMR EXPORT PACKET (Output)
// =============================================================================

/**
 * EMRExportPacket is the final output ready for EMR consumption.
 */
export interface EMRExportPacket {
  // Metadata
  id: string;
  visitId: string;
  templateId: string;
  templateVersion: string;
  emrVendor: EMRVendor;
  generatedAt: string;
  generatedBy: string;

  // Validation summary
  validation: ExportValidation;

  // Outputs
  clipboardText: string;
  structuredData: Record<string, unknown>;
  fieldValues: ExportedField[];

  // For debugging/audit
  mappingLog?: MappingLogEntry[];
}

export interface ExportValidation {
  isValid: boolean;
  canExport: boolean;          // Can export even with warnings
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
  reason?: string;            // If not included
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

  // Context
  patientId?: string;
  episodeId?: string;
  visitId?: string;
  templateId?: string;
  templateVersion?: string;

  // Details
  action: string;
  details?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;

  // Result
  success: boolean;
  errorMessage?: string;

  // Source
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
