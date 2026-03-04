/**
 * Capture Types
 *
 * Data models for the new audio-first capture workflow
 */

// =============================================================================
// RECORDING
// =============================================================================

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';

export interface RecordingSegment {
  id: string;
  startTime: number; // seconds from start
  endTime: number;
  speaker: 'clinician' | 'patient' | 'caregiver' | 'unknown';
  transcript: string;
  confidence: number;
}

export interface Recording {
  id: string;
  visitId: string;
  status: RecordingStatus;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  audioUrl?: string;
  transcript?: string;
  segments: RecordingSegment[];
  extractionStatus: 'pending' | 'processing' | 'complete' | 'error';
}

// =============================================================================
// REFERRAL DOCUMENTS
// =============================================================================

export type DocumentExtractionStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface ReferralDocument {
  id: string;
  visitId: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'fax';
  fileSize: number;
  uploadedAt: string;
  pageCount?: number;
  extractionStatus: DocumentExtractionStatus;
  extractedEntities?: ExtractedEntities;
  extractedText?: string; // Raw text extracted from the document
  thumbnailUrl?: string;
}

// =============================================================================
// EXTRACTED ENTITIES
// =============================================================================

export interface ExtractedEntity {
  value: string | number | boolean | string[];
  confidence: number;
  source: EntitySource;
  verified?: boolean;
}

export interface EntitySource {
  type: 'audio' | 'document' | 'manual';
  documentId?: string;
  pageNumber?: number;
  audioTimestamp?: number; // seconds
  audioSegmentId?: string;
  excerpt?: string; // relevant text snippet
}

export interface DiagnosisEntity extends ExtractedEntity {
  icdCode?: string;
  description: string;
  isPrimary?: boolean;
  onsetDate?: string;
}

export interface MedicationEntity extends ExtractedEntity {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  prescriber?: string;
  isNew?: boolean;
  isDiscontinued?: boolean;
}

export interface VitalEntity extends ExtractedEntity {
  type: 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'respiratory_rate' | 'temperature' | 'spo2' | 'weight' | 'pain_level';
  value: number;
  unit: string;
}

export interface WoundEntity extends ExtractedEntity {
  location: string;
  type?: string;
  stage?: string;
  length?: number;
  width?: number;
  depth?: number;
  drainage?: string;
  odor?: boolean;
  tunneling?: boolean;
}

export interface FunctionalEntity extends ExtractedEntity {
  domain: 'mobility' | 'self_care' | 'cognition' | 'communication';
  item: string;
  score?: string;
  description: string;
}

export interface ExtractedEntities {
  // Clinical data
  diagnoses: DiagnosisEntity[];
  medications: MedicationEntity[];
  vitals: VitalEntity[];
  wounds: WoundEntity[];
  functionalStatus: FunctionalEntity[];

  // Visit context
  chiefComplaint?: ExtractedEntity;
  historyOfPresentIllness?: ExtractedEntity;
  reviewOfSystems?: ExtractedEntity;
  physicalExam?: ExtractedEntity;

  // Regulatory/compliance
  homeboundReason?: ExtractedEntity;
  skilledNeedJustification?: ExtractedEntity;
  safetyRisks?: ExtractedEntity;
  fallRisk?: ExtractedEntity;

  // Plan
  goalsProgress?: ExtractedEntity;
  interventionsPerformed?: ExtractedEntity;
  patientEducation?: ExtractedEntity;
  coordinationOfCare?: ExtractedEntity;
  planNextVisit?: ExtractedEntity;

  // Orders
  newOrders?: ExtractedEntity[];
  physicianNotification?: ExtractedEntity;
}

// =============================================================================
// EMR TEMPLATE
// =============================================================================

export type EmrFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'single_select'
  | 'multi_select'
  | 'boolean'
  | 'scale'
  | 'signature';

export interface EmrFieldOption {
  code: string;
  label: string;
  description?: string;
}

export interface EmrFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
}

export interface EmrField {
  fieldId: string;
  label: string;
  shortLabel?: string;
  section: string;
  type: EmrFieldType;
  options?: EmrFieldOption[];
  required: boolean;
  validation?: EmrFieldValidation;
  helpText?: string;
  oasisItemCode?: string; // For OASIS-mapped fields
}

export interface EmrTemplate {
  id: string;
  name: string;
  vendor: string;
  version: string;
  visitType: string;
  discipline: string;
  fields: EmrField[];
  sections: string[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// EMR ANSWER MAP
// =============================================================================

export interface EmrAnswer {
  fieldId: string;
  fieldLabel: string;
  section: string;
  required: boolean;
  type: EmrFieldType;

  // AI-proposed answer
  proposedAnswer?: string | number | boolean | string[];
  proposedAnswerLabel?: string; // Human-readable for select fields
  confidence: number; // 0-1
  sources: EntitySource[];

  // User modifications
  userAnswer?: string | number | boolean | string[];
  userModified: boolean;
  userApproved: boolean;

  // Status
  status: 'filled' | 'empty' | 'low_confidence' | 'needs_review';
}

export interface EmrAnswerMap {
  visitId: string;
  templateId: string;
  templateName: string;
  generatedAt: string;

  answers: EmrAnswer[];

  // Summary stats
  totalFields: number;
  filledFields: number;
  requiredFields: number;
  requiredFilledFields: number;
  lowConfidenceCount: number;

  // Generated content
  soapNote?: SoapNote;
  visitNarrative?: string;
}

// =============================================================================
// SOAP NOTE
// =============================================================================

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;

  // Additional sections
  interventions?: string;
  patientEducation?: string;
  coordinationOfCare?: string;
  homeboundStatus?: string;
  skilledNeed?: string;
}

// =============================================================================
// VISIT CAPTURE SESSION
// =============================================================================

export type CaptureStatus =
  | 'setup'           // Initial state, selecting patient/visit type
  | 'ready'           // Ready to record
  | 'capturing'       // Recording in progress
  | 'processing'      // AI processing audio/docs
  | 'review'          // Ready for review
  | 'approved'        // User approved
  | 'exported';       // Exported to EMR

export interface VisitCapture {
  id: string;
  visitId: string;
  patientId: string;
  episodeId: string;

  // Basic info
  visitType: string;
  discipline: string;
  visitDate: string;
  timeIn?: string;
  timeOut?: string;
  location?: string;

  // Capture data
  status: CaptureStatus;
  recording?: Recording;
  referralDocuments: ReferralDocument[];
  emrTemplate?: EmrTemplate;

  // Extracted data
  extractedEntities?: ExtractedEntities;
  emrAnswerMap?: EmrAnswerMap;

  // Timeline
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  exportedAt?: string;
}

// =============================================================================
// EXTRACTION TIMELINE ITEM
// =============================================================================

export type TimelineItemType =
  | 'recording_started'
  | 'recording_paused'
  | 'recording_resumed'
  | 'recording_stopped'
  | 'document_uploaded'
  | 'extraction_started'
  | 'entity_extracted'
  | 'soap_generated'
  | 'emr_mapped'
  | 'user_edit'
  | 'export_completed';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: string;
  title: string;
  description?: string;
  entityType?: string;
  entityCount?: number;
  confidence?: number;
}
