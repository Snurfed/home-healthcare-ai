/**
 * Canonical Domain Types
 *
 * EMR-agnostic data models representing the "clinical truth".
 * These types use stable conceptIds that never change, regardless of EMR vendor.
 */

// =============================================================================
// CORE ENUMS
// =============================================================================

export type Discipline = 'RN' | 'LVN' | 'PT' | 'OT' | 'SLP' | 'MSW' | 'HHA';

export type VisitType =
  | 'SOC'        // Start of Care
  | 'ROC'        // Resumption of Care
  | 'RECERT'     // Recertification
  | 'FOLLOWUP'   // Follow-up/Routine
  | 'DISCHARGE'  // Discharge
  | 'EVAL'       // Evaluation only
  | 'SUPERVISORY'; // Supervisory visit

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
  | 'scale'           // 0-10 pain scale, etc.
  | 'vitals'          // Compound vital signs
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

// =============================================================================
// CANONICAL VISIT NOTE (The Clinical Truth)
// =============================================================================

/**
 * CanonicalVisitNote stores data using stable conceptIds.
 * This is the authoritative clinical record, independent of any EMR's structure.
 */
export interface CanonicalVisitNote {
  // Identity
  id: string;
  patientId: string;
  episodeId: string;
  clinicianId: string;
  discipline: Discipline;
  visitType: VisitType;

  // Visit metadata
  visitDate: string; // ISO date
  timeIn?: string;   // ISO time
  timeOut?: string;
  location?: 'home' | 'facility' | 'telehealth';

  // Status
  status: VisitNoteStatus;

  // All clinical data stored by conceptId
  responses: Record<string, CanonicalResponse>;

  // Compound sections (pre-structured)
  vitals?: CanonicalVitals;
  wounds?: CanonicalWound[];
  medications?: CanonicalMedication[];
  goals?: CanonicalGoal[];
  interventions?: CanonicalIntervention[];

  // Narrative sections (AI-generated or manual)
  narratives?: Record<string, string>;

  // Signatures
  signatures: CanonicalSignature[];

  // Audit
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentReason?: string;

  // Module toggles (for conditional sections)
  activeModules: string[];
}

/**
 * Individual response to a canonical question.
 */
export interface CanonicalResponse {
  conceptId: string;
  value: CanonicalValue;
  source: 'manual' | 'voice' | 'ai_draft' | 'imported' | 'calculated' | 'default';
  confidence?: number;       // 0-1 for AI-generated
  timestamp: string;
  clinicianId: string;
  notes?: string;            // Clinician's additional notes
  originalValue?: CanonicalValue; // Before any amendments
}

export type CanonicalValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | null;

// =============================================================================
// CANONICAL COMPOUND TYPES
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
// CANONICAL FORM DEFINITION (UI Schema)
// =============================================================================

/**
 * Defines the structure of a form for a specific discipline + visitType.
 * Uses reusable sections from the CanonicalSectionLibrary.
 */
export interface CanonicalFormDefinition {
  id: string;
  discipline: Discipline;
  visitType: VisitType;
  version: string;
  name: string;
  description?: string;

  // Ordered sections
  sections: CanonicalFormSection[];

  // Global form rules
  validationRules?: CanonicalValidationRule[];

  // Module toggle definitions
  moduleToggles?: ModuleToggle[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  status: 'draft' | 'published' | 'deprecated';
}

export interface CanonicalFormSection {
  id: string;
  sectionId: string;           // Reference to CanonicalSectionLibrary
  name: string;
  description?: string;
  icon?: string;
  required: boolean;
  collapsed?: boolean;
  aiDraftEnabled?: boolean;

  // Section-level visibility
  visibilityRules?: CanonicalVisibilityRule[];

  // Questions in this section
  questions: CanonicalFormQuestion[];
}

export interface CanonicalFormQuestion {
  id: string;
  conceptId: string;           // Stable canonical identifier
  label: string;               // User-facing label (EMR-agnostic)
  shortLabel?: string;         // For compact views
  helpText?: string;
  type: CanonicalAnswerType;
  required: boolean;
  defaultValue?: CanonicalValue;

  // Options for select types
  options?: CanonicalOption[];

  // For scale types
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<number, string>;

  // Validation
  validation?: QuestionValidation;

  // Conditional display
  visibilityRules?: CanonicalVisibilityRule[];

  // AI support
  aiDraftEnabled?: boolean;
  aiPromptHint?: string;

  // OASIS mapping (for assessments)
  oasisItemCode?: string;

  // Computed/derived
  computeFrom?: ComputeRule;
}

export interface CanonicalOption {
  code: string;
  label: string;
  description?: string;
  scoringValue?: number;
  excludes?: string[];         // Other options this excludes
}

export interface QuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: string;             // Custom validation function name
}

export interface CanonicalVisibilityRule {
  type: 'show_when' | 'hide_when' | 'require_when';
  conditions: VisibilityCondition[];
  operator: 'AND' | 'OR';
}

export interface VisibilityCondition {
  field: string;               // conceptId or special field
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
  activatedBy?: VisibilityCondition[]; // Auto-activate when conditions met
}

export interface ComputeRule {
  type: 'sum' | 'average' | 'count' | 'formula' | 'lookup';
  sources: string[];           // conceptIds to compute from
  formula?: string;            // For type='formula'
  lookupTable?: Record<string, CanonicalValue>;
}

// =============================================================================
// CANONICAL SECTION LIBRARY (Reusable Modules)
// =============================================================================

/**
 * A library of reusable sections that can be included in any form definition.
 * Sections are versioned and can be shared across visit types.
 */
export interface CanonicalSectionDefinition {
  sectionId: string;
  name: string;
  description?: string;
  category: 'assessment' | 'intervention' | 'education' | 'admin' | 'narrative' | 'compound';
  version: string;

  // Default questions in this section
  questions: CanonicalFormQuestion[];

  // Which visit types typically include this section
  applicableVisitTypes: VisitType[];

  // Which disciplines this section applies to
  applicableDisciplines: Discipline[];

  // Is this a "module" that can be toggled?
  isModule: boolean;
  moduleId?: string;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export interface CanonicalExportRequest {
  visitId: string;
  templateId: string;
  format: 'clipboard' | 'structured' | 'fhir' | 'all';
}

export interface CanonicalValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  completionPercentage: number;
  missingRequired: string[];   // conceptIds
}

export interface ValidationError {
  conceptId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
}
