/**
 * SOAP Note Types
 *
 * TypeScript interfaces for SOAP note generation and management
 */

// ===========================================
// ENUMS / CONSTANTS
// ===========================================

export type SoapNoteStatus = 'DRAFT' | 'REVIEWED' | 'FINALIZED' | 'AMENDED';

export type SoapSection = 'subjective' | 'objective' | 'assessment' | 'plan';

export const SOAP_STATUS_CONFIG: Record<
  SoapNoteStatus,
  { label: string; color: 'warning' | 'info' | 'success' | 'default' }
> = {
  DRAFT: { label: 'Draft', color: 'warning' },
  REVIEWED: { label: 'Reviewed', color: 'info' },
  FINALIZED: { label: 'Finalized', color: 'success' },
  AMENDED: { label: 'Amended', color: 'default' },
};

export const SOAP_SECTION_CONFIG: Record<
  SoapSection,
  { label: string; description: string; icon: string }
> = {
  subjective: {
    label: 'Subjective',
    description: 'Patient-reported symptoms, concerns, and history',
    icon: 'S',
  },
  objective: {
    label: 'Objective',
    description: 'Clinical findings, vital signs, and observations',
    icon: 'O',
  },
  assessment: {
    label: 'Assessment',
    description: 'Clinical interpretation and diagnosis summary',
    icon: 'A',
  },
  plan: {
    label: 'Plan',
    description: 'Treatment goals, interventions, and follow-up',
    icon: 'P',
  },
};

// ===========================================
// SOAP NOTE TYPES
// ===========================================

export interface SoapNotePatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth?: string;
}

export interface SoapNoteUser {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
}

export interface SoapNoteAssessment {
  id: string;
  assessmentType: string;
  status: string;
  m0030_startOfCareDate?: string;
}

export interface SoapNote {
  id: string;
  assessmentId: string;
  patientId: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: SoapNoteStatus;
  version: number;
  aiModelUsed: string | null;
  reviewNotes: string | null;
  amendmentReason: string | null;
  patient?: SoapNotePatient;
  generatedBy?: SoapNoteUser;
  generatedAt: string;
  reviewedBy?: SoapNoteUser;
  reviewedAt?: string;
  finalizedBy?: SoapNoteUser;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoapNoteListItem {
  id: string;
  assessmentId: string;
  patientId: string;
  status: SoapNoteStatus;
  version: number;
  generatedAt: string;
  reviewedAt?: string;
  finalizedAt?: string;
  createdAt: string;
  assessment?: {
    id: string;
    assessmentType: string;
    status: string;
  };
  generatedBy?: SoapNoteUser;
  reviewedBy?: SoapNoteUser;
  finalizedBy?: SoapNoteUser;
}

// ===========================================
// API REQUEST/RESPONSE TYPES
// ===========================================

export interface GenerateSoapNoteRequest {
  additionalContext?: string;
}

export interface GenerateSoapNoteResponse {
  message: string;
  soapNote: SoapNote;
  generation: {
    timeMs: number;
    modelUsed: string;
    confidence?: number;
  };
}

export interface UpdateSoapNoteRequest {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface UpdateSoapNoteStatusRequest {
  status: SoapNoteStatus;
  reviewNotes?: string;
  amendmentReason?: string;
}

export interface RegenerateSectionRequest {
  section: SoapSection;
  instructions?: string;
}

export interface RegenerateSectionResponse {
  message: string;
  section: SoapSection;
  content: string;
  soapNote: {
    id: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    status: SoapNoteStatus;
    updatedAt: string;
  };
  generation: {
    timeMs: number;
    modelUsed: string;
  };
}

export interface SoapNotesListParams {
  page?: number;
  limit?: number;
  status?: SoapNoteStatus;
  startDate?: string;
  endDate?: string;
}

export interface SoapNotesListResponse {
  data: SoapNoteListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SoapNoteValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  sectionStatus: Record<SoapSection, { complete: boolean; issues: string[] }>;
}
