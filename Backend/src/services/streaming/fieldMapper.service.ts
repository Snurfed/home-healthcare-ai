/**
 * Field Mapper Service
 *
 * Maps extracted clinical entities to EMR template fields.
 * Supports multiple template types (OASIS, SOAP, custom).
 * Handles field validation and returns structured updates for UI.
 */

import { ExtractedEntity, EntityType } from './realtimeExtraction.service';

// ===========================================
// TYPES
// ===========================================

export type TemplateType = 'OASIS' | 'SOAP' | 'VISIT_NOTE' | 'CUSTOM';

export interface FieldMapping {
  fieldId: string;
  fieldLabel: string;
  section: string;
  value: string | number | boolean | string[];
  displayValue: string;
  confidence: number;
  sourceText: string;
  needsReview: boolean;
  reviewReason?: string;
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessage?: string;
}

export interface FieldUpdate {
  sessionId: string;
  templateType: TemplateType;
  field: FieldMapping;
  allFields: FieldMapping[];
  updatedAt: number;
}

export interface FieldMapperConfig {
  sessionId: string;
  templateType: TemplateType;
  customTemplate?: CustomTemplateDefinition;
}

export interface CustomTemplateDefinition {
  fields: Array<{
    fieldId: string;
    fieldLabel: string;
    section: string;
    dataType: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
    entityTypes: EntityType[];
    validation?: FieldValidation;
  }>;
}

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  allowedValues?: string[];
}

// ===========================================
// VITAL SIGN VALIDATION RANGES
// ===========================================

const VITAL_RANGES = {
  bp_systolic: { min: 60, max: 250, warningMin: 90, warningMax: 180, unit: 'mmHg' },
  bp_diastolic: { min: 30, max: 150, warningMin: 60, warningMax: 110, unit: 'mmHg' },
  heart_rate: { min: 30, max: 250, warningMin: 50, warningMax: 120, unit: 'bpm' },
  respiratory_rate: { min: 4, max: 60, warningMin: 12, warningMax: 24, unit: '/min' },
  temperature: { min: 90, max: 110, warningMin: 97, warningMax: 100.4, unit: 'F' },
  spo2: { min: 50, max: 100, warningMin: 92, warningMax: 100, unit: '%' },
  weight: { min: 20, max: 700, warningMin: 80, warningMax: 400, unit: 'lbs' },
  pain_level: { min: 0, max: 10, warningMin: 0, warningMax: 7, unit: '/10' },
};

// ===========================================
// OASIS FIELD DEFINITIONS
// ===========================================

interface OasisFieldDef {
  fieldId: string;
  fieldLabel: string;
  section: string;
  entityTypes: EntityType[];
  transformer?: (entity: ExtractedEntity) => string | number;
  validation?: FieldValidation;
}

const OASIS_FIELD_DEFINITIONS: OasisFieldDef[] = [
  // Vital Signs (visit-level, not directly OASIS but commonly captured)
  {
    fieldId: 'M1030_BP_SYSTOLIC',
    fieldLabel: 'Blood Pressure - Systolic',
    section: 'Vital Signs',
    entityTypes: ['vital_bp'],
    transformer: (e) => {
      const bp = String(e.value);
      const systolic = bp.split(/[\/\s]+over\s*/i)[0] ?? '0';
      return parseInt(systolic, 10) || 0;
    },
    validation: { min: 60, max: 250 },
  },
  {
    fieldId: 'M1030_BP_DIASTOLIC',
    fieldLabel: 'Blood Pressure - Diastolic',
    section: 'Vital Signs',
    entityTypes: ['vital_bp'],
    transformer: (e) => {
      const bp = String(e.value);
      const parts = bp.split(/[\/\s]+over\s*/i);
      return parseInt(parts[1] || '0', 10) || 0;
    },
    validation: { min: 30, max: 150 },
  },
  {
    fieldId: 'VISIT_HR',
    fieldLabel: 'Heart Rate',
    section: 'Vital Signs',
    entityTypes: ['vital_hr'],
    transformer: (e) => typeof e.value === 'number' ? e.value : parseInt(String(e.value), 10) || 0,
    validation: { min: 30, max: 250 },
  },
  {
    fieldId: 'VISIT_RR',
    fieldLabel: 'Respiratory Rate',
    section: 'Vital Signs',
    entityTypes: ['vital_rr'],
    transformer: (e) => typeof e.value === 'number' ? e.value : parseInt(String(e.value), 10) || 0,
    validation: { min: 4, max: 60 },
  },
  {
    fieldId: 'VISIT_TEMP',
    fieldLabel: 'Temperature',
    section: 'Vital Signs',
    entityTypes: ['vital_temp'],
    transformer: (e) => typeof e.value === 'number' ? e.value : parseFloat(String(e.value)) || 0,
    validation: { min: 90, max: 110 },
  },
  {
    fieldId: 'VISIT_SPO2',
    fieldLabel: 'Oxygen Saturation',
    section: 'Vital Signs',
    entityTypes: ['vital_spo2'],
    transformer: (e) => typeof e.value === 'number' ? e.value : parseInt(String(e.value), 10) || 0,
    validation: { min: 50, max: 100 },
  },
  {
    fieldId: 'M1060_WEIGHT',
    fieldLabel: 'Weight',
    section: 'Vital Signs',
    entityTypes: ['vital_weight'],
    transformer: (e) => typeof e.value === 'number' ? e.value : parseFloat(String(e.value)) || 0,
    validation: { min: 20, max: 700 },
  },
  {
    fieldId: 'M1242_PAIN',
    fieldLabel: 'Pain Level',
    section: 'Vital Signs',
    entityTypes: ['vital_pain'],
    transformer: (e) => {
      const val = String(e.value).toLowerCase();
      if (val === 'none' || val === 'no pain' || val === 'denies') return 0;
      return typeof e.value === 'number' ? e.value : parseInt(String(e.value), 10) || 0;
    },
    validation: { min: 0, max: 10 },
  },

  // Functional Status - Self Care (GG0130)
  {
    fieldId: 'GG0130A',
    fieldLabel: 'Eating',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },
  {
    fieldId: 'GG0130B',
    fieldLabel: 'Oral Hygiene',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },
  {
    fieldId: 'GG0130C',
    fieldLabel: 'Toileting Hygiene',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },
  {
    fieldId: 'GG0130E',
    fieldLabel: 'Dressing Upper Body',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },
  {
    fieldId: 'GG0130F',
    fieldLabel: 'Dressing Lower Body',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },
  {
    fieldId: 'GG0130G',
    fieldLabel: 'Putting On/Taking Off Footwear',
    section: 'Self-Care',
    entityTypes: ['functional_adl'],
  },

  // Functional Status - Mobility (GG0170)
  {
    fieldId: 'GG0170A',
    fieldLabel: 'Roll Left and Right',
    section: 'Mobility',
    entityTypes: ['functional_mobility'],
  },
  {
    fieldId: 'GG0170B',
    fieldLabel: 'Sit to Lying',
    section: 'Mobility',
    entityTypes: ['functional_mobility', 'functional_transfer'],
  },
  {
    fieldId: 'GG0170C',
    fieldLabel: 'Lying to Sitting on Side of Bed',
    section: 'Mobility',
    entityTypes: ['functional_mobility', 'functional_transfer'],
  },
  {
    fieldId: 'GG0170D',
    fieldLabel: 'Sit to Stand',
    section: 'Mobility',
    entityTypes: ['functional_transfer'],
  },
  {
    fieldId: 'GG0170E',
    fieldLabel: 'Chair/Bed-to-Chair Transfer',
    section: 'Mobility',
    entityTypes: ['functional_transfer'],
  },
  {
    fieldId: 'GG0170F',
    fieldLabel: 'Toilet Transfer',
    section: 'Mobility',
    entityTypes: ['functional_transfer'],
  },
  {
    fieldId: 'GG0170I',
    fieldLabel: 'Walk 10 Feet',
    section: 'Mobility',
    entityTypes: ['functional_mobility'],
  },
  {
    fieldId: 'GG0170J',
    fieldLabel: 'Walk 50 Feet with Two Turns',
    section: 'Mobility',
    entityTypes: ['functional_mobility'],
  },
  {
    fieldId: 'GG0170K',
    fieldLabel: 'Walk 150 Feet',
    section: 'Mobility',
    entityTypes: ['functional_mobility'],
  },

  // Clinical Findings
  {
    fieldId: 'M1306_WOUND',
    fieldLabel: 'Wound Status',
    section: 'Clinical Findings',
    entityTypes: ['wound'],
  },
  {
    fieldId: 'M1700_COGNITIVE',
    fieldLabel: 'Cognitive Functioning',
    section: 'Clinical Findings',
    entityTypes: ['mental_status'],
  },
  {
    fieldId: 'M1910_FALL_RISK',
    fieldLabel: 'Fall Risk Assessment',
    section: 'Clinical Findings',
    entityTypes: ['fall_risk'],
  },
  {
    fieldId: 'M2102_HOMEBOUND',
    fieldLabel: 'Homebound Status',
    section: 'Clinical Findings',
    entityTypes: ['homebound_status'],
  },

  // Diagnoses
  {
    fieldId: 'M1021_PRIMARY_DX',
    fieldLabel: 'Primary Diagnosis',
    section: 'Diagnoses',
    entityTypes: ['diagnosis', 'diagnosis_code'],
  },
  {
    fieldId: 'M1023_OTHER_DX',
    fieldLabel: 'Other Diagnoses',
    section: 'Diagnoses',
    entityTypes: ['diagnosis', 'diagnosis_code'],
  },

  // Medications
  {
    fieldId: 'M2003_MEDICATION',
    fieldLabel: 'Medication Intervention',
    section: 'Medications',
    entityTypes: ['medication'],
  },
];

// ===========================================
// SOAP FIELD DEFINITIONS
// ===========================================

const SOAP_FIELD_DEFINITIONS: OasisFieldDef[] = [
  // Vital Signs
  {
    fieldId: 'SOAP_BP_SYSTOLIC',
    fieldLabel: 'Blood Pressure - Systolic',
    section: 'Objective',
    entityTypes: ['vital_bp'],
    transformer: (e) => {
      const bp = String(e.value);
      const systolic = bp.split(/[\/\s]+over\s*/i)[0] ?? '0';
      return parseInt(systolic, 10) || 0;
    },
  },
  {
    fieldId: 'SOAP_BP_DIASTOLIC',
    fieldLabel: 'Blood Pressure - Diastolic',
    section: 'Objective',
    entityTypes: ['vital_bp'],
    transformer: (e) => {
      const bp = String(e.value);
      const parts = bp.split(/[\/\s]+over\s*/i);
      return parseInt(parts[1] || '0', 10) || 0;
    },
  },
  {
    fieldId: 'SOAP_HR',
    fieldLabel: 'Heart Rate',
    section: 'Objective',
    entityTypes: ['vital_hr'],
  },
  {
    fieldId: 'SOAP_TEMP',
    fieldLabel: 'Temperature',
    section: 'Objective',
    entityTypes: ['vital_temp'],
  },
  {
    fieldId: 'SOAP_SPO2',
    fieldLabel: 'Oxygen Saturation',
    section: 'Objective',
    entityTypes: ['vital_spo2'],
  },
  {
    fieldId: 'SOAP_PAIN',
    fieldLabel: 'Pain Level',
    section: 'Subjective',
    entityTypes: ['vital_pain'],
  },
  // Symptoms
  {
    fieldId: 'SOAP_CHIEF_COMPLAINT',
    fieldLabel: 'Chief Complaint',
    section: 'Subjective',
    entityTypes: ['symptom'],
  },
  // Assessment
  {
    fieldId: 'SOAP_DIAGNOSIS',
    fieldLabel: 'Diagnosis',
    section: 'Assessment',
    entityTypes: ['diagnosis', 'diagnosis_code'],
  },
  // Plan
  {
    fieldId: 'SOAP_MEDICATIONS',
    fieldLabel: 'Medications',
    section: 'Plan',
    entityTypes: ['medication'],
  },
];

// ===========================================
// FIELD MAPPER SERVICE
// ===========================================

export class FieldMapperService {
  private config: FieldMapperConfig;
  private fieldDefinitions: OasisFieldDef[];
  private mappedFields: Map<string, FieldMapping> = new Map();

  constructor(config: FieldMapperConfig) {
    this.config = config;
    this.fieldDefinitions = this.getFieldDefinitions(config.templateType, config.customTemplate);
  }

  private getFieldDefinitions(
    templateType: TemplateType,
    customTemplate?: CustomTemplateDefinition
  ): OasisFieldDef[] {
    switch (templateType) {
      case 'OASIS':
        return OASIS_FIELD_DEFINITIONS;
      case 'SOAP':
      case 'VISIT_NOTE':
        return SOAP_FIELD_DEFINITIONS;
      case 'CUSTOM':
        if (customTemplate) {
          return customTemplate.fields.map(f => ({
            fieldId: f.fieldId,
            fieldLabel: f.fieldLabel,
            section: f.section,
            entityTypes: f.entityTypes,
            validation: f.validation,
          }));
        }
        return [];
      default:
        return OASIS_FIELD_DEFINITIONS;
    }
  }

  /**
   * Get all currently mapped fields
   */
  getMappedFields(): FieldMapping[] {
    return Array.from(this.mappedFields.values());
  }

  /**
   * Map an extracted entity to template fields
   */
  mapEntity(entity: ExtractedEntity): FieldUpdate[] {
    const updates: FieldUpdate[] = [];

    // Find matching field definitions
    const matchingDefs = this.fieldDefinitions.filter(def =>
      def.entityTypes.includes(entity.type)
    );

    for (const def of matchingDefs) {
      // Skip if entity doesn't mention the specific field (for ADL items)
      if (this.isSpecificFieldRequired(def) && !this.entityMatchesField(entity, def)) {
        continue;
      }

      // Transform value if transformer exists
      const value = def.transformer ? def.transformer(entity) : entity.value;
      const displayValue = this.formatDisplayValue(value, entity.type, def);

      // Validate the value
      const validation = this.validateValue(value, def);

      // Create field mapping
      const mapping: FieldMapping = {
        fieldId: def.fieldId,
        fieldLabel: def.fieldLabel,
        section: def.section,
        value,
        displayValue,
        confidence: entity.confidence,
        sourceText: entity.sourceText,
        needsReview: entity.confidence < 0.85 || validation.status !== 'valid',
        reviewReason: this.getReviewReason(entity.confidence, validation),
        validationStatus: validation.status,
        validationMessage: validation.message,
      };

      // Store or update mapping (prefer higher confidence)
      const existing = this.mappedFields.get(def.fieldId);
      if (!existing || entity.confidence > existing.confidence) {
        this.mappedFields.set(def.fieldId, mapping);

        updates.push({
          sessionId: this.config.sessionId,
          templateType: this.config.templateType,
          field: mapping,
          allFields: this.getMappedFields(),
          updatedAt: Date.now(),
        });
      }
    }

    return updates;
  }

  /**
   * Check if this field requires specific entity matching
   */
  private isSpecificFieldRequired(def: OasisFieldDef): boolean {
    // GG items require matching the specific activity
    return def.fieldId.startsWith('GG0130') || def.fieldId.startsWith('GG0170');
  }

  /**
   * Check if entity matches the specific field
   */
  private entityMatchesField(entity: ExtractedEntity, def: OasisFieldDef): boolean {
    const sourceText = entity.sourceText.toLowerCase();
    const fieldLabel = def.fieldLabel.toLowerCase();

    // Direct label match
    if (sourceText.includes(fieldLabel)) {
      return true;
    }

    // Keyword matching for specific fields
    const fieldKeywords: Record<string, string[]> = {
      'GG0130A': ['eating', 'feeds', 'meal', 'food'],
      'GG0130B': ['oral hygiene', 'brushing teeth', 'mouth care', 'dental'],
      'GG0130C': ['toileting', 'bathroom', 'commode', 'toileting hygiene'],
      'GG0130E': ['dressing upper', 'upper body', 'shirt', 'putting on top'],
      'GG0130F': ['dressing lower', 'lower body', 'pants', 'putting on pants'],
      'GG0130G': ['footwear', 'shoes', 'socks', 'putting on shoes'],
      'GG0170A': ['roll', 'rolling', 'bed mobility'],
      'GG0170B': ['sit to lying', 'lying down', 'supine'],
      'GG0170C': ['lying to sitting', 'sitting up', 'edge of bed'],
      'GG0170D': ['sit to stand', 'standing up', 'stand'],
      'GG0170E': ['transfer', 'bed to chair', 'chair to bed'],
      'GG0170F': ['toilet transfer', 'commode transfer'],
      'GG0170I': ['walk 10 feet', 'ambulates', 'walking', 'gait'],
      'GG0170J': ['walk 50 feet', 'walks with turns'],
      'GG0170K': ['walk 150 feet', 'walks longer distance'],
    };

    const keywords = fieldKeywords[def.fieldId];
    if (keywords) {
      return keywords.some(kw => sourceText.includes(kw));
    }

    return true; // Default to matching for non-GG fields
  }

  /**
   * Format value for display
   */
  private formatDisplayValue(
    value: string | number | boolean | string[],
    entityType: EntityType,
    _def: OasisFieldDef
  ): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      // Add units for vitals
      const vitalUnits: Record<string, string> = {
        vital_bp: 'mmHg',
        vital_hr: 'bpm',
        vital_rr: '/min',
        vital_temp: 'F',
        vital_spo2: '%',
        vital_weight: 'lbs',
        vital_pain: '/10',
      };

      const unit = vitalUnits[entityType];
      return unit ? `${value} ${unit}` : String(value);
    }

    return String(value);
  }

  /**
   * Validate a value against field constraints
   */
  private validateValue(
    value: string | number | boolean | string[],
    def: OasisFieldDef
  ): { status: 'valid' | 'warning' | 'error'; message?: string } {
    const validation = def.validation;

    if (typeof value === 'number') {
      // Check numeric ranges
      if (validation?.min !== undefined && value < validation.min) {
        return { status: 'error', message: `Value ${value} is below minimum ${validation.min}` };
      }
      if (validation?.max !== undefined && value > validation.max) {
        return { status: 'error', message: `Value ${value} exceeds maximum ${validation.max}` };
      }

      // Check warning ranges for vitals
      const vitalKey = this.getVitalKey(def.fieldId);
      if (vitalKey && VITAL_RANGES[vitalKey as keyof typeof VITAL_RANGES]) {
        const range = VITAL_RANGES[vitalKey as keyof typeof VITAL_RANGES];
        if (value < range.warningMin || value > range.warningMax) {
          return {
            status: 'warning',
            message: `Value ${value} is outside normal range (${range.warningMin}-${range.warningMax} ${range.unit})`,
          };
        }
      }
    }

    if (typeof value === 'string') {
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return { status: 'error', message: 'Value does not match required format' };
        }
      }

      if (validation?.allowedValues && !validation.allowedValues.includes(value)) {
        return { status: 'error', message: `Value must be one of: ${validation.allowedValues.join(', ')}` };
      }
    }

    return { status: 'valid' };
  }

  /**
   * Get vital sign key from field ID
   */
  private getVitalKey(fieldId: string): string | null {
    const vitalFieldMap: Record<string, string> = {
      'M1030_BP_SYSTOLIC': 'bp_systolic',
      'SOAP_BP_SYSTOLIC': 'bp_systolic',
      'M1030_BP_DIASTOLIC': 'bp_diastolic',
      'SOAP_BP_DIASTOLIC': 'bp_diastolic',
      'VISIT_HR': 'heart_rate',
      'SOAP_HR': 'heart_rate',
      'VISIT_RR': 'respiratory_rate',
      'VISIT_TEMP': 'temperature',
      'SOAP_TEMP': 'temperature',
      'VISIT_SPO2': 'spo2',
      'SOAP_SPO2': 'spo2',
      'M1060_WEIGHT': 'weight',
      'M1242_PAIN': 'pain_level',
      'SOAP_PAIN': 'pain_level',
    };

    return vitalFieldMap[fieldId] || null;
  }

  /**
   * Get review reason based on confidence and validation
   */
  private getReviewReason(
    confidence: number,
    validation: { status: string; message?: string }
  ): string | undefined {
    const reasons: string[] = [];

    if (confidence < 0.85) {
      reasons.push(`Low confidence (${Math.round(confidence * 100)}%)`);
    }

    if (validation.status === 'warning') {
      reasons.push(validation.message || 'Unusual value');
    } else if (validation.status === 'error') {
      reasons.push(validation.message || 'Validation error');
    }

    return reasons.length > 0 ? reasons.join('; ') : undefined;
  }

  /**
   * Clear all mapped fields
   */
  clear(): void {
    this.mappedFields.clear();
  }
}

// ===========================================
// SESSION MANAGER
// ===========================================

const activeMappers = new Map<string, FieldMapperService>();

/**
 * Create a new field mapper for a session
 */
export function createFieldMapper(config: FieldMapperConfig): FieldMapperService {
  const mapper = new FieldMapperService(config);
  activeMappers.set(config.sessionId, mapper);
  console.log(`[FieldMapper] Created for session: ${config.sessionId}, template: ${config.templateType}`);
  return mapper;
}

/**
 * Get field mapper for a session
 */
export function getFieldMapper(sessionId: string): FieldMapperService | undefined {
  return activeMappers.get(sessionId);
}

/**
 * Remove field mapper for a session
 */
export function removeFieldMapper(sessionId: string): void {
  activeMappers.delete(sessionId);
  console.log(`[FieldMapper] Removed for session: ${sessionId}`);
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  FieldMapperService,
  createFieldMapper,
  getFieldMapper,
  removeFieldMapper,
};
