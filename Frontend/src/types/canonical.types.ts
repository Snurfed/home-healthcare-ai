/**
 * Canonical Domain Types (Frontend)
 *
 * Mirrors Backend/src/domain/canonical/types.ts for frontend use.
 */

// =============================================================================
// CORE ENUMS
// =============================================================================

export type Discipline = 'RN' | 'LVN' | 'PT' | 'OT' | 'SLP' | 'MSW' | 'HHA';

export type VisitType =
  | 'SOC'
  | 'ROC'
  | 'RECERT'
  | 'FOLLOWUP'
  | 'DISCHARGE'
  | 'EVAL'
  | 'SUPERVISORY';

export type CanonicalAnswerType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'date'
  | 'time'
  | 'datetime'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'scale'
  | 'vitals'
  | 'medication_list'
  | 'wound_assessment'
  | 'signature'
  | 'goal_list'
  | 'intervention_list';

export type VisitNoteStatus =
  | 'draft'
  | 'in_progress'
  | 'pending_review'
  | 'finalized'
  | 'amended'
  | 'locked';

export type CanonicalValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | null;

// =============================================================================
// VISIT NOTE
// =============================================================================

export interface CanonicalVisitNote {
  id: string;
  patientId: string;
  episodeId: string;
  clinicianId: string;
  discipline: Discipline;
  visitType: VisitType;
  visitDate: string;
  timeIn?: string;
  timeOut?: string;
  location?: 'home' | 'facility' | 'telehealth';
  status: VisitNoteStatus;
  responses: Record<string, CanonicalResponse>;
  vitals?: CanonicalVitals;
  wounds?: CanonicalWound[];
  medications?: CanonicalMedication[];
  goals?: CanonicalGoal[];
  interventions?: CanonicalIntervention[];
  narratives?: Record<string, string>;
  signatures: CanonicalSignature[];
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentReason?: string;
  activeModules: string[];
}

export interface CanonicalResponse {
  conceptId: string;
  value: CanonicalValue;
  source: 'manual' | 'voice' | 'ai_draft' | 'imported' | 'calculated' | 'default';
  confidence?: number;
  timestamp: string;
  clinicianId: string;
  notes?: string;
  originalValue?: CanonicalValue;
}

// =============================================================================
// COMPOUND TYPES
// =============================================================================

export interface CanonicalVitals {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit: 'F' | 'C';
  oxygenSaturation?: number;
  oxygenOnRoom: boolean;
  oxygenLitersPerMin?: number;
  weight?: number;
  weightUnit: 'lbs' | 'kg';
  height?: number;
  heightUnit: 'in' | 'cm';
  bloodGlucose?: number;
  bloodGlucoseTiming?: 'fasting' | 'random' | 'pre_meal' | 'post_meal';
  pain?: number;
  painLocation?: string;
  painQuality?: string[];
  position?: 'sitting' | 'standing' | 'supine';
  orthostatic?: boolean;
  recordedAt: string;
}

export interface CanonicalWound {
  id: string;
  type: string;
  location: string;
  locationDetail?: string;
  stage?: string;
  length?: number;
  width?: number;
  depth?: number;
  measurementUnit: 'cm' | 'in';
  tunneling?: { direction: string; depth: number }[];
  undermining?: { direction: string; depth: number }[];
  woundBed?: string[];
  exudate?: { amount: string; type: string };
  odor?: boolean;
  periWound?: string[];
  dressing?: string;
  frequency?: string;
  healing?: 'improving' | 'stable' | 'declining';
  photoAttached?: boolean;
  dateIdentified?: string;
  healed?: boolean;
  healedDate?: string;
}

export interface CanonicalMedication {
  id: string;
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  classification?: string;
  highRisk?: boolean;
  newThisVisit?: boolean;
  changed?: boolean;
  changeReason?: string;
  discontinued?: boolean;
  discontinueReason?: string;
  adherence?: 'takes_as_prescribed' | 'takes_incorrectly' | 'does_not_take' | 'unable_to_assess';
  sideEffects?: string[];
}

export interface CanonicalGoal {
  id: string;
  discipline: Discipline;
  type: 'short_term' | 'long_term';
  description: string;
  targetDate?: string;
  measurableOutcome?: string;
  status: 'active' | 'met' | 'progressing' | 'not_met' | 'discontinued' | 'revised';
  progressNotes?: string;
  baseline?: string;
  currentLevel?: string;
}

export interface CanonicalIntervention {
  id: string;
  type: string;
  description: string;
  response?: 'effective' | 'partially_effective' | 'ineffective' | 'unable_to_assess';
  patientTolerance?: string;
  education?: boolean;
  educationTopic?: string;
  demonstratedCompetency?: boolean;
  notes?: string;
}

export interface CanonicalSignature {
  type: 'clinician' | 'patient' | 'caregiver' | 'supervisor';
  name: string;
  credentials?: string;
  relationship?: string;
  signatureData: string;
  signedAt: string;
}

// =============================================================================
// FORM DEFINITIONS
// =============================================================================

export interface CanonicalFormDefinition {
  id: string;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  name: string;
  description?: string;
  sections: CanonicalFormSection[];
  validationRules?: CanonicalValidationRule[];
  moduleToggles?: ModuleToggle[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  status: 'draft' | 'published' | 'deprecated';
}

export interface CanonicalFormSection {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  icon?: string;
  required: boolean;
  collapsed?: boolean;
  aiDraftEnabled?: boolean;
  visibilityRules?: CanonicalVisibilityRule[];
  questions: CanonicalFormQuestion[];
}

export interface CanonicalFormQuestion {
  id: string;
  conceptId: string;
  label: string;
  shortLabel?: string;
  helpText?: string;
  type: CanonicalAnswerType;
  required: boolean;
  defaultValue?: CanonicalValue;
  options?: CanonicalOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<number, string>;
  validation?: QuestionValidation;
  visibilityRules?: CanonicalVisibilityRule[];
  aiDraftEnabled?: boolean;
  aiPromptHint?: string;
  oasisItemCode?: string;
  computeFrom?: ComputeRule;
}

export interface CanonicalOption {
  code: string;
  label: string;
  description?: string;
  scoringValue?: number;
  excludes?: string[];
}

export interface QuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: string;
}

export interface CanonicalVisibilityRule {
  type: 'show_when' | 'hide_when' | 'require_when';
  conditions: VisibilityCondition[];
  operator: 'AND' | 'OR';
}

export interface VisibilityCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains' | 'is_set' | 'is_not_set' | 'module_active';
  value?: CanonicalValue;
}

export interface CanonicalValidationRule {
  id: string;
  name: string;
  message: string;
  severity: 'error' | 'warning';
  conditions: VisibilityCondition[];
  operator: 'AND' | 'OR';
}

export interface ModuleToggle {
  id: string;
  name: string;
  description: string;
  icon?: string;
  defaultActive: boolean;
  activatedBy?: VisibilityCondition[];
}

export interface ComputeRule {
  type: 'sum' | 'average' | 'count' | 'formula' | 'lookup';
  sources: string[];
  formula?: string;
  lookupTable?: Record<string, CanonicalValue>;
}

// =============================================================================
// BUILT FORM TYPES (From Form Engine)
// =============================================================================

export interface BuiltForm {
  definition: CanonicalFormDefinition;
  sections: BuiltSection[];
  activeModules: string[];
  requiresOasis: boolean;
  validationState: FormValidationState;
}

export interface BuiltSection {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  required: boolean;
  collapsed: boolean;
  visible: boolean;
  aiDraftEnabled: boolean;
  questions: BuiltQuestion[];
  completionPercent: number;
}

export interface BuiltQuestion {
  id: string;
  conceptId: string;
  label: string;
  shortLabel?: string;
  helpText?: string;
  type: string;
  required: boolean;
  visible: boolean;
  enabled: boolean;
  currentValue?: CanonicalValue;
  defaultValue?: CanonicalValue;
  options?: Array<{ code: string; label: string; description?: string }>;
  validation?: QuestionValidation;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<number, string>;
  aiDraftEnabled?: boolean;
  oasisItemCode?: string;
  errors: string[];
  warnings: string[];
}

export interface FormValidationState {
  isValid: boolean;
  canSubmit: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  completionPercent: number;
  requiredMissing: string[];
}

export interface ValidationError {
  conceptId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export interface CanonicalValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  completionPercentage: number;
  missingRequired: string[];
}
