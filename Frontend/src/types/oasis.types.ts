/**
 * OASIS Assessment Types
 *
 * Types for OASIS-E assessment data structures
 */

// Assessment status workflow
export type AssessmentStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'NEEDS_CORRECTION'
  | 'SUBMITTED'
  | 'LOCKED';

// Assessment types matching CMS requirements
export type AssessmentType =
  | 'START_OF_CARE'
  | 'RESUMPTION_OF_CARE'
  | 'RECERTIFICATION'
  | 'FOLLOW_UP'
  | 'TRANSFER_TO_INPATIENT'
  | 'DISCHARGE_FROM_AGENCY'
  | 'DEATH_AT_HOME';

// Response input types
export type ResponseType =
  | 'single_select'
  | 'multi_select'
  | 'numeric'
  | 'date'
  | 'text'
  | 'icd10';

// Source of response data
export type SourceType = 'manual' | 'voice' | 'ocr' | 'emr';

// OASIS section identifiers
export type OASISSectionId =
  | 'clinical_record'
  | 'patient_tracking'
  | 'patient_history'
  | 'living_situation'
  | 'sensory_status'
  | 'pain_assessment'
  | 'integumentary_status'
  | 'respiratory_status'
  | 'cardiac_status'
  | 'elimination_status'
  | 'neuro_emotional'
  | 'functional_abilities'
  | 'medication_management'
  | 'care_management'
  | 'therapy_need';

// Section configuration
export interface OASISSection {
  id: OASISSectionId;
  name: string;
  description?: string;
  requiredItems: number;
  icon?: string;
  sortOrder: number;
}

// Question option for single/multi select
export interface QuestionOption {
  code: string;
  label: string;
  description?: string;
}

// Validation rule for a question
export interface ValidationRule {
  ruleType: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: string | number;
  severity: 'error' | 'warning';
  errorMessage: string;
}

// Skip logic condition
export interface SkipLogicCondition {
  dependsOn: string; // itemCode
  operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'greaterThan' | 'lessThan';
  value: string | string[] | number;
}

// OASIS Question from question library
export interface OASISQuestion {
  id: string;
  itemCode: string;
  itemName: string;
  section: OASISSectionId;
  questionText: string;
  helpText?: string | null;
  responseType: ResponseType;
  responses?: QuestionOption[] | null;
  skipLogic?: SkipLogicCondition[] | null;
  validationRules?: ValidationRule[] | null;
  scoringRules?: object | null;
  assessmentTypes: AssessmentType[];
  effectiveDate: string;
  retiredDate?: string | null;
  cmsGuidance?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Individual response to an OASIS question
export interface OASISResponse {
  id?: string;
  assessmentId: string;
  itemCode: string;
  responseValue?: string | null;
  responseCode?: string | null;
  responseText?: string | null;
  responseNumeric?: number | null;
  responseDate?: string | null;
  responseJson?: object | null;
  confidence?: number | null;
  sourceType?: SourceType | null;
  sourceTranscriptionId?: string | null;
  sourceText?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Section progress tracking
export interface SectionProgress {
  sectionId: OASISSectionId;
  totalQuestions: number;
  answeredQuestions: number;
  hasErrors: boolean;
  isComplete: boolean;
}

// Validation error
export interface ValidationError {
  itemCode: string;
  itemName: string;
  errorType: 'required' | 'invalid' | 'consistency' | 'range';
  message: string;
  severity: 'error' | 'warning';
}

// Scoring result
export interface ScoringResult {
  hippsCode?: string;
  clinicalGrouping?: string;
  functionalLevel?: string;
  comorbidityAdjustment?: number;
  caseMixWeight?: number;
}

// Patient summary for assessment display
export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth?: string;
  gender?: string;
  addressState?: string;
  addressZipCode?: string;
}

// Episode summary
export interface EpisodeSummary {
  id: string;
  episodeNumber: number;
  startDate: string;
  endDate?: string | null;
}

// User summary for clinician display
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
}

// Full OASIS Assessment
export interface OASISAssessment {
  id: string;
  patientId: string;
  episodeId: string;
  visitId?: string | null;
  assessmentType: AssessmentType;
  assessmentReason?: string | null;
  status: AssessmentStatus;
  dates: {
    m0030_startOfCareDate?: string | null;
    m0032_resumptionOfCareDate?: string | null;
    m0090_completionDate?: string | null;
    m0906_dischargeDate?: string | null;
  };
  scoring?: ScoringResult;
  completionPercentage: number;
  voicePopulatedFields?: string[] | null;
  responses: Record<string, OASISResponse>;
  validationErrors?: ValidationError[];
  workflow: {
    submittedAt?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    approvedAt?: string | null;
    lockedAt?: string | null;
    correctionReason?: string | null;
    version: number;
  };
  patient?: PatientSummary;
  episode?: EpisodeSummary;
  clinician?: UserSummary;
  reviewer?: UserSummary | null;
  approver?: UserSummary | null;
  createdAt: string;
  updatedAt: string;
}

// Assessment list item (summary)
export interface AssessmentListItem {
  id: string;
  patientId: string;
  episodeId: string;
  assessmentType: AssessmentType;
  status: AssessmentStatus;
  m0030_startOfCareDate?: string | null;
  m0090_completionDate?: string | null;
  completionPercentage: number;
  hippsCode?: string | null;
  clinicianId: string;
  reviewerId?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: PatientSummary;
  clinician?: UserSummary;
  _count?: {
    responses: number;
  };
}

// Create assessment request
export interface CreateAssessmentRequest {
  patientId: string;
  episodeId: string;
  assessmentType: AssessmentType;
  assessmentReason?: string;
  startOfCareDate?: string;
  resumptionOfCareDate?: string;
  visitId?: string;
  copyFromAssessmentId?: string;
}

// Update assessment request
export interface UpdateAssessmentRequest {
  section?: string;
  items?: Record<string, Partial<OASISResponse>>;
  status?: AssessmentStatus;
  assessmentCompletionDate?: string;
}

// Submit for review request
export interface SubmitForReviewRequest {
  supervisorId?: string;
  notes?: string;
  attestation: boolean;
}

// Review assessment request
export interface ReviewAssessmentRequest {
  approved: boolean;
  notes?: string;
  correctionReason?: string;
}

// List assessments query params
export interface ListAssessmentsParams {
  page?: number;
  limit?: number;
  patientId?: string;
  episodeId?: string;
  status?: AssessmentStatus;
  assessmentType?: AssessmentType;
  clinicianId?: string;
  reviewerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'completionPercentage';
  sortOrder?: 'asc' | 'desc';
}

// Question library query params
export interface QuestionLibraryParams {
  section?: OASISSectionId;
  assessmentType?: AssessmentType;
  search?: string;
}

// Section configuration data
export const OASIS_SECTIONS: OASISSection[] = [
  { id: 'clinical_record', name: 'Clinical Record Items', requiredItems: 12, sortOrder: 1 },
  { id: 'patient_tracking', name: 'Patient Tracking Sheet', requiredItems: 8, sortOrder: 2 },
  { id: 'patient_history', name: 'Patient History & Diagnoses', requiredItems: 15, sortOrder: 3 },
  { id: 'living_situation', name: 'Living Situation', requiredItems: 6, sortOrder: 4 },
  { id: 'sensory_status', name: 'Sensory Status', requiredItems: 6, sortOrder: 5 },
  { id: 'pain_assessment', name: 'Pain Assessment', requiredItems: 4, sortOrder: 6 },
  { id: 'integumentary_status', name: 'Integumentary Status', requiredItems: 14, sortOrder: 7 },
  { id: 'respiratory_status', name: 'Respiratory Status', requiredItems: 3, sortOrder: 8 },
  { id: 'cardiac_status', name: 'Cardiac Status', requiredItems: 2, sortOrder: 9 },
  { id: 'elimination_status', name: 'Elimination Status', requiredItems: 5, sortOrder: 10 },
  { id: 'neuro_emotional', name: 'Neuro/Emotional/Behavioral', requiredItems: 8, sortOrder: 11 },
  { id: 'functional_abilities', name: 'Functional Abilities (GG)', requiredItems: 24, sortOrder: 12 },
  { id: 'medication_management', name: 'Medication Management', requiredItems: 8, sortOrder: 13 },
  { id: 'care_management', name: 'Care Management', requiredItems: 4, sortOrder: 14 },
  { id: 'therapy_need', name: 'Therapy Need', requiredItems: 3, sortOrder: 15 },
];

// Assessment type labels
export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  START_OF_CARE: 'Start of Care (SOC)',
  RESUMPTION_OF_CARE: 'Resumption of Care (ROC)',
  RECERTIFICATION: 'Recertification',
  FOLLOW_UP: 'Follow-Up',
  TRANSFER_TO_INPATIENT: 'Transfer to Inpatient',
  DISCHARGE_FROM_AGENCY: 'Discharge from Agency',
  DEATH_AT_HOME: 'Death at Home',
};

// Status labels and colors
export const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'gray' },
  IN_PROGRESS: { label: 'In Progress', color: 'blue' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'yellow' },
  APPROVED: { label: 'Approved', color: 'green' },
  NEEDS_CORRECTION: { label: 'Needs Correction', color: 'red' },
  SUBMITTED: { label: 'Submitted', color: 'purple' },
  LOCKED: { label: 'Locked', color: 'gray' },
};
