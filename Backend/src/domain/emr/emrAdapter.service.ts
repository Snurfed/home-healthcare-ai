/**
 * EMR Adapter Service
 *
 * Responsible for:
 * - Transforming canonical visit notes to EMR-specific formats
 * - Applying EMR templates to map fields
 * - Generating clipboard text and structured output
 * - Validating export readiness
 */

import type { CanonicalVisitNote } from '../canonical/types';
import type {
  EMRTemplate,
  EMRTemplateField,
  EMRFieldMapping,
  EMRExportPacket,
  ExportedField,
  ExportValidation,
  MappingLogEntry,
  TransformDefinition,
  EMRCondition,
} from './types';

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

/**
 * Export a canonical visit note to EMR format
 */
export function exportToEMR(
  visitNote: CanonicalVisitNote,
  template: EMRTemplate
): EMRExportPacket {
  const now = new Date().toISOString();
  const mappingLog: MappingLogEntry[] = [];
  const exportedFields: ExportedField[] = [];
  const validationErrors: ExportValidation['errors'] = [];
  const validationWarnings: ExportValidation['warnings'] = [];
  const missingRequired: ExportValidation['missingRequired'] = [];

  // Process each section in the template
  for (const section of template.sections) {
    // Check section conditional include
    if (section.conditionalInclude && !evaluateConditions(section.conditionalInclude, visitNote)) {
      continue;
    }

    // Process each field
    for (const field of section.fields) {
      const result = processField(field, visitNote, template);
      mappingLog.push(result.log);

      if (result.exported) {
        exportedFields.push(result.exported);
      }

      if (result.error) {
        if (field.emrRequired) {
          validationErrors.push({
            type: result.error.type as ExportValidation['errors'][0]['type'],
            field: field.emrLabel,
            emrFieldId: field.emrFieldId,
            canonicalConceptId: field.mapping.canonicalConceptId,
            message: result.error.message,
            severity: 'error',
          });

          if (result.error.type === 'canonical_missing') {
            missingRequired.push({
              emrFieldId: field.emrFieldId,
              emrLabel: field.emrLabel,
              canonicalConceptId: field.mapping.canonicalConceptId,
              canonicalLabel: field.emrLabel, // Would look up from question bank
            });
          }
        } else {
          validationWarnings.push({
            type: result.error.type as ExportValidation['warnings'][0]['type'],
            field: field.emrLabel,
            emrFieldId: field.emrFieldId,
            message: result.error.message,
            severity: 'warning',
          });
        }
      }
    }
  }

  // Calculate completion
  const requiredFields = template.sections.flatMap(s => s.fields.filter(f => f.emrRequired));
  const completedRequired = requiredFields.filter(f =>
    exportedFields.some(e => e.emrFieldId === f.emrFieldId && e.included && e.value !== '')
  );
  const completionPercentage = requiredFields.length > 0
    ? Math.round((completedRequired.length / requiredFields.length) * 100)
    : 100;

  // Build validation result
  const validation: ExportValidation = {
    isValid: validationErrors.length === 0,
    canExport: missingRequired.length === 0 || !template.outputConfig.requireAllRequired,
    errors: validationErrors,
    warnings: validationWarnings,
    missingRequired,
    completionPercentage,
  };

  // Generate outputs
  const clipboardText = generateClipboardText(exportedFields, template);
  const structuredData = generateStructuredData(exportedFields, template, visitNote);

  return {
    id: `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    visitId: visitNote.id,
    templateId: template.id,
    templateVersion: template.version,
    emrVendor: template.emrVendor,
    generatedAt: now,
    generatedBy: visitNote.clinicianId,
    validation,
    clipboardText,
    structuredData,
    fieldValues: exportedFields,
    mappingLog,
  };
}

// =============================================================================
// FIELD PROCESSING
// =============================================================================

interface FieldProcessResult {
  exported?: ExportedField;
  log: MappingLogEntry;
  error?: { type: string; message: string };
}

function processField(
  field: EMRTemplateField,
  visitNote: CanonicalVisitNote,
  template: EMRTemplate
): FieldProcessResult {
  const log: MappingLogEntry = {
    emrFieldId: field.emrFieldId,
    canonicalConceptId: field.mapping.canonicalConceptId,
    transformsApplied: [],
    success: false,
  };

  // Check conditional include
  if (field.conditionalInclude && !evaluateConditions(field.conditionalInclude, visitNote)) {
    log.success = true;
    return {
      exported: {
        emrFieldId: field.emrFieldId,
        emrLabel: field.emrLabel,
        emrSectionId: '', // Would be passed from section context
        value: '',
        included: false,
        reason: 'Conditional exclude',
      },
      log,
    };
  }

  // Extract and transform value
  const { value, rawValue, error } = extractAndTransform(field.mapping, visitNote, template);

  log.inputValue = rawValue;
  log.outputValue = value;

  if (error) {
    log.error = error;
    return {
      error: { type: 'transform_error', message: error },
      log,
    };
  }

  // Check if value is missing
  if (value === undefined || value === null || value === '') {
    const behavior = field.mapping.emptyBehavior || template.outputConfig.emptyFieldBehavior;

    if (behavior === 'omit') {
      log.success = true;
      return {
        exported: {
          emrFieldId: field.emrFieldId,
          emrLabel: field.emrLabel,
          emrSectionId: '',
          value: '',
          rawValue,
          canonicalConceptId: field.mapping.canonicalConceptId,
          included: false,
          reason: 'Empty - omitted',
        },
        log,
      };
    }

    if (behavior === 'default' && field.mapping.defaultValue) {
      log.outputValue = field.mapping.defaultValue;
      log.transformsApplied.push('default_value');
    } else if (behavior === 'include_na') {
      log.outputValue = template.outputConfig.naText || 'N/A';
      log.transformsApplied.push('na_text');
    }

    // Check if required
    if (field.emrRequired) {
      return {
        error: { type: 'canonical_missing', message: `Required field ${field.emrLabel} has no value` },
        log,
      };
    }
  }

  // Apply formatting
  let finalValue = log.outputValue ?? '';
  if (field.formatting) {
    finalValue = applyFormatting(finalValue, field.formatting);
    log.transformsApplied.push('formatting');
  }

  // Validate against allowed values
  if (field.allowedValues && field.allowedValues.length > 0) {
    const allowed = field.allowedValues.find(av => av.code === finalValue || av.label === finalValue);
    if (!allowed && finalValue !== '') {
      log.error = `Value "${finalValue}" not in allowed values for ${field.emrLabel}`;
      return {
        error: { type: 'value_invalid', message: log.error },
        log,
      };
    }
  }

  log.success = true;
  log.outputValue = finalValue;

  return {
    exported: {
      emrFieldId: field.emrFieldId,
      emrLabel: field.emrLabel,
      emrSectionId: '',
      value: finalValue,
      rawValue,
      canonicalConceptId: field.mapping.canonicalConceptId,
      transformApplied: log.transformsApplied.join(', ') || undefined,
      included: field.includeInOutput,
    },
    log,
  };
}

// =============================================================================
// VALUE EXTRACTION & TRANSFORMATION
// =============================================================================

function extractAndTransform(
  mapping: EMRFieldMapping,
  visitNote: CanonicalVisitNote,
  _template: EMRTemplate // Reserved for global transforms
): { value?: string; rawValue?: unknown; error?: string } {
  let rawValue: unknown;
  let value: string | undefined;

  switch (mapping.type) {
    case 'literal':
      return { value: mapping.literalValue, rawValue: mapping.literalValue };

    case 'direct':
    case 'transform':
      if (!mapping.canonicalConceptId) {
        return { error: 'No canonicalConceptId specified for direct/transform mapping' };
      }

      const response = visitNote.responses[mapping.canonicalConceptId];
      rawValue = response?.value;

      if (rawValue === undefined || rawValue === null) {
        // Try compound types
        rawValue = extractFromCompoundTypes(mapping.canonicalConceptId, visitNote);
      }

      if (rawValue === undefined || rawValue === null) {
        return { rawValue: undefined, value: undefined };
      }

      // Apply transform if specified
      if (mapping.transform) {
        try {
          value = applyTransform(rawValue, mapping.transform);
        } catch (e) {
          return { rawValue, error: `Transform error: ${e instanceof Error ? e.message : 'Unknown'}` };
        }
      } else {
        value = String(rawValue);
      }

      return { value, rawValue };

    case 'composite':
      if (!mapping.compositeFields || mapping.compositeFields.length === 0) {
        return { error: 'No compositeFields specified for composite mapping' };
      }

      const parts: string[] = [];
      for (const cf of mapping.compositeFields) {
        const cfResponse = visitNote.responses[cf.canonicalConceptId];
        let cfValue: unknown = cfResponse?.value;

        if (cfValue === undefined || cfValue === null) {
          cfValue = extractFromCompoundTypes(cf.canonicalConceptId, visitNote);
        }

        if (cfValue !== undefined && cfValue !== null) {
          let partValue = String(cfValue);

          if (cf.transform) {
            partValue = applyTransform(cfValue, cf.transform);
          }

          if (cf.prefix) partValue = cf.prefix + partValue;
          if (cf.suffix) partValue = partValue + cf.suffix;

          parts.push(partValue);
        }
      }

      value = parts.join(mapping.compositeFields[0]?.separator || ' ');
      return { value, rawValue: parts };

    case 'computed':
      if (!mapping.computeExpression) {
        return { error: 'No computeExpression specified for computed mapping' };
      }
      // Computed expressions would need a safe evaluator
      // For now, return a placeholder
      return { value: '[COMPUTED]', rawValue: undefined };

    default:
      return { error: `Unknown mapping type: ${mapping.type}` };
  }
}

function extractFromCompoundTypes(conceptId: string, visitNote: CanonicalVisitNote): unknown {
  // Handle vitals.* paths
  if (conceptId.startsWith('vitals.') && visitNote.vitals) {
    const field = conceptId.replace('vitals.', '');
    const fieldMap: Record<string, keyof typeof visitNote.vitals> = {
      'bp_systolic': 'bloodPressureSystolic',
      'bp_diastolic': 'bloodPressureDiastolic',
      'heart_rate': 'heartRate',
      'respiratory_rate': 'respiratoryRate',
      'temperature': 'temperature',
      'oxygen_saturation': 'oxygenSaturation',
      'weight': 'weight',
      'pain_level': 'pain',
    };

    const mappedField = fieldMap[field];
    if (mappedField && mappedField in visitNote.vitals) {
      return visitNote.vitals[mappedField as keyof typeof visitNote.vitals];
    }
  }

  return undefined;
}

// =============================================================================
// TRANSFORMS
// =============================================================================

function applyTransform(value: unknown, transform: TransformDefinition): string {
  switch (transform.type) {
    case 'map':
      if (!transform.valueMap) {
        throw new Error('No valueMap specified for map transform');
      }
      const stringValue = String(value);
      return transform.valueMap[stringValue] ?? stringValue;

    case 'format':
      if (!transform.formatString) {
        return String(value);
      }
      return transform.formatString.replace('{value}', String(value));

    case 'unit_convert':
      const params = transform.params as { from: string; to: string } | undefined;
      if (!params || typeof value !== 'number') {
        return String(value);
      }
      // Common conversions
      if (params.from === 'lbs' && params.to === 'kg') {
        return (value * 0.453592).toFixed(1);
      }
      if (params.from === 'kg' && params.to === 'lbs') {
        return (value * 2.20462).toFixed(1);
      }
      if (params.from === 'F' && params.to === 'C') {
        return ((value - 32) * 5 / 9).toFixed(1);
      }
      if (params.from === 'C' && params.to === 'F') {
        return (value * 9 / 5 + 32).toFixed(1);
      }
      return String(value);

    case 'date_format':
      const dateParams = transform.params as { format: string } | undefined;
      const date = new Date(String(value));
      if (isNaN(date.getTime())) {
        return String(value);
      }
      // Simple date formatting
      const format = dateParams?.format || 'MM/DD/YYYY';
      return formatDate(date, format);

    case 'number_format':
      const numParams = transform.params as { decimals?: number; prefix?: string; suffix?: string } | undefined;
      if (typeof value !== 'number') {
        return String(value);
      }
      let formatted = numParams?.decimals !== undefined
        ? value.toFixed(numParams.decimals)
        : String(value);
      if (numParams?.prefix) formatted = numParams.prefix + formatted;
      if (numParams?.suffix) formatted = formatted + numParams.suffix;
      return formatted;

    case 'boolean_to_text':
      const boolParams = transform.params as { trueText?: string; falseText?: string } | undefined;
      const trueText = boolParams?.trueText || 'Yes';
      const falseText = boolParams?.falseText || 'No';
      return value === true || value === 'true' || value === '1' ? trueText : falseText;

    case 'array_join':
      if (!Array.isArray(value)) {
        return String(value);
      }
      const joinParams = transform.params as { separator?: string } | undefined;
      return value.join(joinParams?.separator || ', ');

    case 'concat':
      if (!Array.isArray(value)) {
        return String(value);
      }
      return value.join('');

    case 'truncate':
      const truncParams = transform.params as { maxLength: number; suffix?: string } | undefined;
      const str = String(value);
      if (!truncParams?.maxLength || str.length <= truncParams.maxLength) {
        return str;
      }
      const suffix = truncParams.suffix ?? '...';
      return str.substring(0, truncParams.maxLength - suffix.length) + suffix;

    case 'uppercase':
      return String(value).toUpperCase();

    case 'lowercase':
      return String(value).toLowerCase();

    case 'titlecase':
      return String(value)
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());

    case 'custom':
      // Custom functions would be registered separately
      console.warn(`Custom transform "${transform.customFn}" not implemented`);
      return String(value);

    default:
      return String(value);
  }
}

function formatDate(date: Date, format: string): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear());

  return format
    .replace('MM', month)
    .replace('DD', day)
    .replace('YYYY', year)
    .replace('YY', year.slice(-2));
}

// =============================================================================
// FORMATTING
// =============================================================================

interface EMRFormatting {
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  wrapInQuotes?: boolean;
  lineBreaks?: 'preserve' | 'remove' | 'convert_to_space';
  casing?: 'preserve' | 'uppercase' | 'lowercase' | 'titlecase';
}

function applyFormatting(value: string, formatting: EMRFormatting): string {
  let result = value;

  // Line breaks
  if (formatting.lineBreaks === 'remove') {
    result = result.replace(/[\r\n]+/g, '');
  } else if (formatting.lineBreaks === 'convert_to_space') {
    result = result.replace(/[\r\n]+/g, ' ');
  }

  // Casing
  switch (formatting.casing) {
    case 'uppercase':
      result = result.toUpperCase();
      break;
    case 'lowercase':
      result = result.toLowerCase();
      break;
    case 'titlecase':
      result = result.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      break;
  }

  // Truncate
  if (formatting.maxLength && result.length > formatting.maxLength) {
    result = result.substring(0, formatting.maxLength);
  }

  // Prefix/suffix
  if (formatting.prefix) result = formatting.prefix + result;
  if (formatting.suffix) result = result + formatting.suffix;

  // Quotes
  if (formatting.wrapInQuotes) {
    result = `"${result}"`;
  }

  return result;
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

function evaluateConditions(conditions: EMRCondition[], visitNote: CanonicalVisitNote): boolean {
  return conditions.every(condition => {
    const response = visitNote.responses[condition.field];
    const value = response?.value;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value as string);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value as string);
      case 'is_set':
        return value !== undefined && value !== null && value !== '';
      case 'is_not_set':
        return value === undefined || value === null || value === '';
      case 'greater_than':
        return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
      case 'less_than':
        return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
      default:
        return true;
    }
  });
}

// =============================================================================
// OUTPUT GENERATION
// =============================================================================

function generateClipboardText(
  exportedFields: ExportedField[],
  template: EMRTemplate
): string {
  const config = template.outputConfig;
  const lines: string[] = [];
  let currentSection = '';

  for (const field of exportedFields) {
    if (!field.included || field.value === '') continue;

    // Add section separator if section changed
    if (field.emrSectionId !== currentSection && currentSection !== '') {
      lines.push(config.sectionSeparator || '\n');
    }
    currentSection = field.emrSectionId;

    // Format field
    if (config.includeLabels) {
      const separator = config.labelSeparator || ': ';
      lines.push(`${field.emrLabel}${separator}${field.value}`);
    } else {
      lines.push(field.value);
    }
  }

  // Join with delimiter
  let delimiter: string;
  switch (config.clipboardDelimiter) {
    case 'tab':
      delimiter = '\t';
      break;
    case 'pipe':
      delimiter = ' | ';
      break;
    case 'custom':
      delimiter = config.customDelimiter || '\n';
      break;
    case 'newline':
    default:
      delimiter = '\n';
  }

  return lines.join(delimiter);
}

function generateStructuredData(
  exportedFields: ExportedField[],
  template: EMRTemplate,
  visitNote: CanonicalVisitNote
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    metadata: {
      visitId: visitNote.id,
      patientId: visitNote.patientId,
      episodeId: visitNote.episodeId,
      discipline: visitNote.discipline,
      visitType: visitNote.visitType,
      visitDate: visitNote.visitDate,
      status: visitNote.status,
      templateId: template.id,
      templateVersion: template.version,
      emrVendor: template.emrVendor,
      exportedAt: new Date().toISOString(),
    },
    sections: {} as Record<string, Record<string, unknown>>,
  };

  // Group fields by section
  const sections: Record<string, Record<string, unknown>> = {};

  for (const field of exportedFields) {
    if (!field.included) continue;

    const sectionId = field.emrSectionId || 'default';
    if (!sections[sectionId]) {
      sections[sectionId] = {};
    }

    sections[sectionId][field.emrFieldId] = {
      label: field.emrLabel,
      value: field.value,
      rawValue: field.rawValue,
    };
  }

  data['sections'] = sections;

  // Include vitals as structured data
  if (visitNote.vitals) {
    data['vitals'] = visitNote.vitals;
  }

  // Include wounds if present
  if (visitNote.wounds && visitNote.wounds.length > 0) {
    data['wounds'] = visitNote.wounds;
  }

  return data;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get available templates for a discipline/visit type
 */
export function getAvailableTemplates(
  _discipline: string,
  _visitType: string,
  _emrVendor?: string
): EMRTemplate[] {
  // This would query from database
  // Placeholder implementation
  return [];
}

/**
 * Copy export text to clipboard (browser-side helper)
 */
export function copyToClipboard(packet: EMRExportPacket): string {
  return packet.clipboardText;
}

export default {
  exportToEMR,
  getAvailableTemplates,
  copyToClipboard,
};
