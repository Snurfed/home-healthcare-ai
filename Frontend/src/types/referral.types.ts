/**
 * Referral Document Types
 *
 * Types for referral document upload, extraction, and review
 */

import type { UserSummary } from './oasis.types';

// Document type matching backend enum
export type ReferralDocumentType =
  | 'REFERRAL'
  | 'DISCHARGE_SUMMARY'
  | 'FACE_TO_FACE'
  | 'MEDICATION_LIST'
  | 'LAB_RESULTS'
  | 'OTHER';

// Extraction status matching backend enum
export type ExtractionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

// Field acceptance state in review UI
export type FieldAcceptanceState = 'pending' | 'accepted' | 'edited' | 'rejected';

// Document type labels for display
export const DOCUMENT_TYPE_LABELS: Record<ReferralDocumentType, string> = {
  REFERRAL: 'Referral',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  FACE_TO_FACE: 'Face-to-Face Encounter',
  MEDICATION_LIST: 'Medication List',
  LAB_RESULTS: 'Lab Results',
  OTHER: 'Other',
};

// Extraction status config for UI
export const EXTRACTION_STATUS_CONFIG: Record<ExtractionStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'yellow' },
  PROCESSING: { label: 'Processing', color: 'blue' },
  COMPLETED: { label: 'Completed', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
};

// Extracted OASIS field mapping from AI
export interface ExtractedOASISField {
  itemCode: string;
  fieldName: string;
  value: string;
  confidence: number;
  sourceText?: string;
  reasoning?: string;
}

// Extracted patient demographics
export interface ExtractedDemographics {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  phone?: string;
  insurance?: {
    primary?: string;
    memberId?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  physician?: {
    name?: string;
    npi?: string;
    phone?: string;
  };
}

// Extracted diagnosis
export interface ExtractedDiagnosis {
  icdCode: string;
  description: string;
  isPrimary: boolean;
  confidence: number;
  sourceText?: string;
}

// Extracted medication
export interface ExtractedMedication {
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  indication?: string;
  confidence: number;
  sourceText?: string;
}

// Extracted order/discipline
export interface ExtractedOrder {
  discipline: string;
  frequency?: string;
  duration?: string;
  specificOrders?: string[];
  goals?: string[];
  interventions?: string[];
}

// Full extraction result from AI
export interface ExtractionResult {
  demographics?: ExtractedDemographics;
  diagnoses?: ExtractedDiagnosis[];
  medications?: ExtractedMedication[];
  oasisMappings?: Record<string, ExtractedOASISField>;
  orders?: ExtractedOrder[];
  certificationPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  rawText?: string;
  extractionSummary?: {
    totalFieldsExtracted: number;
    highConfidenceCount: number;
    lowConfidenceCount: number;
  };
}

// Referral document from API
export interface ReferralDocument {
  id: string;
  patientId: string;
  assessmentId?: string | null;
  documentType: ReferralDocumentType;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  extractionStatus: ExtractionStatus;
  extractedData?: ExtractionResult | null;
  rawText?: string | null;
  extractionError?: string | null;
  extractedAt?: string | null;
  uploadedById: string;
  uploadedBy?: UserSummary;
  metadata?: Record<string, unknown> | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Referral list item (summary for lists)
export interface ReferralListItem {
  id: string;
  patientId: string;
  assessmentId?: string | null;
  documentType: ReferralDocumentType;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  extractionStatus: ExtractionStatus;
  extractedAt?: string | null;
  uploadedBy?: UserSummary;
  createdAt: string;
}

// Upload referral request
export interface UploadReferralRequest {
  file: File;
  documentType: ReferralDocumentType;
  metadata?: Record<string, unknown>;
}

// Upload referral response
export interface UploadReferralResponse {
  message: string;
  document: ReferralDocument;
}

// Extraction status response (for polling)
export interface ExtractionStatusResponse {
  id: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
  extractedAt?: string | null;
  extractedFieldCount: number;
  isComplete: boolean;
  isFailed: boolean;
  isProcessing: boolean;
}

// Apply extraction request
export interface ApplyExtractionRequest {
  assessmentId: string;
  acceptedFields: Record<string, string>;
}

// Apply extraction response
export interface ApplyExtractionResponse {
  message: string;
  appliedFields: number;
  assessmentId: string;
}

// Field review state for UI
export interface ReviewFieldState {
  itemCode: string;
  originalValue: string;
  editedValue?: string;
  status: FieldAcceptanceState;
  confidence: number;
  sourceText?: string;
}

// Review state for all extracted data
export interface ExtractionReviewState {
  demographics: Record<string, ReviewFieldState>;
  diagnoses: Array<ExtractedDiagnosis & { status: FieldAcceptanceState }>;
  medications: Array<ExtractedMedication & { status: FieldAcceptanceState }>;
  oasisFields: Record<string, ReviewFieldState>;
  orders: Array<ExtractedOrder & { status: FieldAcceptanceState }>;
}
