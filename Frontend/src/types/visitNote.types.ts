/**
 * Visit Note Types
 *
 * TypeScript interfaces for the visit documentation system.
 */

// =============================================================================
// DISCIPLINE & VISIT PURPOSE TYPES
// =============================================================================

export type Discipline = 'RN' | 'LVN' | 'PT' | 'OT' | 'SLP' | 'MSW' | 'HHA';
export type VisitPurpose = 'SOC' | 'ROC' | 'RECERT' | 'FOLLOWUP' | 'DISCHARGE' | 'EVALUATION';

export type ResponseType =
  | 'single_select'
  | 'multi_select'
  | 'numeric'
  | 'text'
  | 'date'
  | 'time'
  | 'vitals'
  | 'signature'
  | 'checkbox'
  | 'pain_scale'
  | 'wound_assessment'
  | 'medication_list';

// =============================================================================
// FORM CONFIGURATION TYPES
// =============================================================================

export interface VisitFormQuestion {
  id: string;
  code: string;
  label: string;
  responseType: ResponseType;
  required: boolean;
  options?: { code: string; label: string }[];
  placeholder?: string;
  helpText?: string;
  aiDraftEnabled?: boolean;
  oasisMapping?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
  };
  conditionalDisplay?: {
    dependsOn: string;
    showWhen: string | string[];
  };
}

export interface VisitFormSection {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  collapsed?: boolean;
  aiDraftEnabled?: boolean;
  questions: VisitFormQuestion[];
}

export interface VisitFormConfig {
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  requiresOasis: boolean;
  requiresPhysicianOrder: boolean;
  sections: VisitFormSection[];
}

// =============================================================================
// VITAL SIGNS TYPES
// =============================================================================

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit?: 'F' | 'C';
  oxygenSaturation?: number;
  oxygenSaturationOnRoom?: boolean;
  oxygenLitersPerMin?: number;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  bloodGlucose?: number;
  bloodGlucoseTiming?: 'fasting' | 'random' | 'pre_meal' | 'post_meal';
  pain?: number; // 0-10 scale
  painLocation?: string;
}

export interface VitalSignsWithMeta extends VitalSigns {
  recordedAt: string;
  recordedBy: string;
  position?: 'sitting' | 'standing' | 'supine';
  orthostatic?: boolean;
}

// =============================================================================
// WOUND ASSESSMENT TYPES
// =============================================================================

export interface WoundAssessment {
  woundId?: string;
  location: string;
  type: 'pressure_ulcer' | 'surgical' | 'venous' | 'arterial' | 'diabetic' | 'trauma' | 'other';
  stage?: '1' | '2' | '3' | '4' | 'unstageable' | 'dtpi';
  length?: number;
  width?: number;
  depth?: number;
  tunneling?: boolean;
  tunnelingDescription?: string;
  undermining?: boolean;
  underminingDescription?: string;
  drainage?: 'none' | 'serous' | 'serosanguinous' | 'sanguinous' | 'purulent';
  drainageAmount?: 'scant' | 'small' | 'moderate' | 'large';
  odor?: boolean;
  periwoundCondition?: string;
  woundBed?: string;
  treatmentProvided?: string;
  dressingApplied?: string;
  healing?: 'improving' | 'stable' | 'worsening';
}

// =============================================================================
// VISIT NOTE TYPES
// =============================================================================

export type VisitNoteStatus = 'draft' | 'in_progress' | 'pending_review' | 'finalized' | 'amended';

export interface VisitNoteResponse {
  questionCode: string;
  value: string | number | boolean | string[] | VitalSigns | WoundAssessment | null;
  source?: 'manual' | 'voice' | 'ai_draft' | 'oasis' | 'system';
  aiConfidence?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface VisitNoteSectionProgress {
  sectionId: string;
  totalQuestions: number;
  completedQuestions: number;
  requiredQuestions: number;
  requiredCompleted: number;
  isComplete: boolean;
}

export interface VisitNoteSignature {
  type: 'clinician' | 'patient' | 'caregiver' | 'witness';
  signedBy: string;
  signedAt: string;
  signatureData?: string; // Base64 encoded signature image
  relationship?: string; // For caregiver/witness
}

export interface VisitNote {
  id: string;
  visitId: string;
  patientId: string;
  episodeId: string;
  clinicianId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  status: VisitNoteStatus;
  visitDate: string;
  timeIn?: string;
  timeOut?: string;
  responses: Record<string, VisitNoteResponse>;
  vitalSigns?: VitalSigns;
  wounds?: WoundAssessment[];
  signatures: VisitNoteSignature[];
  sectionProgress: VisitNoteSectionProgress[];
  aiDraftGenerated?: boolean;
  oasisLinked?: boolean;
  oasisAssessmentId?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  amendedAt?: string;
  amendedBy?: string;
  amendmentReason?: string;
}

export interface VisitNoteListItem {
  id: string;
  visitId: string;
  patientName: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  visitDate: string;
  status: VisitNoteStatus;
  clinicianName: string;
  completionPercent: number;
  requiresOasis: boolean;
  oasisComplete: boolean;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateVisitNoteRequest {
  visitId: string;
  patientId: string;
  episodeId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  visitDate: string;
}

export interface UpdateVisitNoteRequest {
  responses?: Record<string, Partial<VisitNoteResponse>>;
  vitalSigns?: VitalSigns;
  wounds?: WoundAssessment[];
  timeIn?: string;
  timeOut?: string;
}

export interface GenerateAIDraftRequest {
  sectionId: string;
  questionCodes?: string[];
  context?: {
    patientHistory?: string;
    recentVisits?: string;
    oasisResponses?: Record<string, string>;
  };
}

export interface GenerateAIDraftResponse {
  success: boolean;
  drafts: {
    questionCode: string;
    draftValue: string;
    confidence: number;
    suggestions?: string[];
  }[];
  generationTimeMs: number;
  error?: string;
}

export interface FinalizeVisitNoteRequest {
  clinicianSignature: {
    signatureData: string;
    signedAt: string;
  };
  patientSignature?: {
    signatureData: string;
    signedAt: string;
    signedBy: string;
    relationship?: string;
  };
}

export interface AmendVisitNoteRequest {
  amendmentReason: string;
  responses: Record<string, Partial<VisitNoteResponse>>;
  signature: {
    signatureData: string;
    signedAt: string;
  };
}

// =============================================================================
// EPISODE DASHBOARD TYPES
// =============================================================================

export interface RequiredAssessment {
  type: 'SOC' | 'ROC' | 'RECERT' | 'DISCHARGE' | 'TRANSFER';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignedTo?: string;
  completedAt?: string;
  completedBy?: string;
  assessmentId?: string;
}

export interface VisitHistoryItem {
  id: string;
  visitDate: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  clinicianName: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
  noteStatus?: VisitNoteStatus;
  noteId?: string;
}

export interface EpisodeDashboardData {
  episodeId: string;
  episodeNumber: string;
  patientId: string;
  patientName: string;
  certificationPeriod: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  status: 'active' | 'pending' | 'discharged' | 'on_hold';
  primaryDiagnosis?: string;
  requiredAssessments: RequiredAssessment[];
  visitHistory: VisitHistoryItem[];
  completionProgress: {
    totalVisits: number;
    completedVisits: number;
    scheduledVisits: number;
    documentsComplete: number;
    documentsPending: number;
  };
  alerts: {
    type: 'overdue' | 'missing_signature' | 'oasis_needed' | 'recert_due' | 'discharge_pending';
    message: string;
    severity: 'high' | 'medium' | 'low';
    actionRequired?: string;
  }[];
}

// =============================================================================
// PLAN OF CARE (485) TYPES
// =============================================================================

export type PlanOfCareStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'amended';

export interface ServiceFrequency {
  discipline: Discipline;
  frequency: string; // e.g., "2W2, 1W4" (2x/week for 2 weeks, 1x/week for 4 weeks)
  duration?: string;
  startDate?: string;
  endDate?: string;
}

export interface CareGoal {
  id: string;
  discipline: Discipline;
  goalType: 'short_term' | 'long_term';
  description: string;
  targetDate: string;
  status: 'active' | 'met' | 'revised' | 'discontinued';
  measurableOutcome?: string;
}

export interface Diagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
  onsetDate?: string;
  sequence?: number;
}

export interface PlanOfCare {
  id: string;
  episodeId: string;
  patientId: string;
  status: PlanOfCareStatus;
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  diagnoses: Diagnosis[];
  functionalLimitations: string[];
  safetyMeasures: string[];
  dmeNeeds: string[];
  serviceFrequencies: ServiceFrequency[];
  goals: CareGoal[];
  allowedActivities?: string;
  nutritionalRequirements?: string;
  mentalStatus?: string;
  prognosis?: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  dischargeGoals?: string;
  physicianName: string;
  physicianNpi?: string;
  physicianSignedAt?: string;
  physicianSignedBy?: string;
  nurseSignedAt?: string;
  nurseSignedBy?: string;
  createdAt: string;
  updatedAt: string;
  effectiveDate: string;
  expirationDate?: string;
}

export interface PlanOfCareListItem {
  id: string;
  episodeId: string;
  patientName: string;
  status: PlanOfCareStatus;
  certificationStart: string;
  certificationEnd: string;
  physicianSigned: boolean;
  createdAt: string;
}

export interface CreatePlanOfCareRequest {
  episodeId: string;
  patientId: string;
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  physicianName: string;
  physicianNpi?: string;
}

export interface UpdatePlanOfCareRequest {
  diagnoses?: Diagnosis[];
  functionalLimitations?: string[];
  safetyMeasures?: string[];
  dmeNeeds?: string[];
  serviceFrequencies?: ServiceFrequency[];
  goals?: CareGoal[];
  allowedActivities?: string;
  nutritionalRequirements?: string;
  mentalStatus?: string;
  prognosis?: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  dischargeGoals?: string;
}

export interface AutoPopulateFromOasisRequest {
  oasisAssessmentId: string;
  fieldsToPopulate?: ('diagnoses' | 'functionalLimitations' | 'mentalStatus' | 'safetyMeasures')[];
}

export interface AutoPopulateFromOasisResponse {
  success: boolean;
  populated: {
    field: string;
    value: unknown;
    source: string;
    oasisItemCode: string;
  }[];
  warnings?: string[];
}

export interface SignPlanOfCareRequest {
  signatureType: 'physician' | 'nurse';
  signatureData: string;
  signedAt: string;
  signedBy: string;
}
