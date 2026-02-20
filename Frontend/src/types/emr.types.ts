/**
 * EMR Integration Types
 *
 * TypeScript interfaces for EMR/FHIR integration
 */

// ===========================================
// EMR VENDOR & CONNECTION
// ===========================================

export type EmrVendor =
  | 'EPIC'
  | 'CERNER'
  | 'ALLSCRIPTS'
  | 'MEDITECH'
  | 'ATHENAHEALTH'
  | 'NEXTGEN'
  | 'CUSTOM';

export interface EmrConnection {
  id: string;
  name: string;
  vendor: EmrVendor;
  fhirBaseUrl: string;
  isEnabled: boolean;
  lastConnectedAt: string | null;
  lastConnectionError: string | null;
  createdAt: string;
  scopes: string[];
}

export interface CreateEmrConnectionRequest {
  name: string;
  vendor: EmrVendor;
  fhirBaseUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
}

export interface UpdateEmrConnectionRequest {
  name?: string;
  fhirBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  isEnabled?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  capabilities?: string[];
}

export interface ConnectionStatus {
  connectionId: string;
  connectionName: string;
  isEnabled: boolean;
  isAuthorized: boolean;
  lastConnectedAt: string | null;
  tokenExpiresAt: string | null;
}

// ===========================================
// EMR PATIENT SEARCH
// ===========================================

export interface EmrPatientSearchParams {
  name?: string;
  given?: string;
  family?: string;
  birthdate?: string;
  mrn?: string;
  phone?: string;
  _count?: number;
}

export interface EmrPatientSearchResult {
  fhirId: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  phone?: string;
  email?: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  isAlreadyImported: boolean;
  localPatientId?: string;
}

// ===========================================
// EMR PATIENT IMPORT
// ===========================================

export interface EmrPatientImportData {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  phoneMobile: string;
  phoneHome?: string;
  email?: string;
  addressStreet1: string;
  addressStreet2?: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  maritalStatus?: string;
  preferredLanguage?: string;
  primaryPhysicianName?: string;
  primaryPhysicianPhone?: string;
  emergencyContacts?: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
    phoneMobile: string;
    isPrimaryContact: boolean;
  }>;
}

export interface EmrPatientDetail {
  fhirPatient: unknown; // Full FHIR Patient resource
  importPreview: EmrPatientImportData;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPatient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
  };
  potentialMatches?: Array<{
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phoneMobile: string;
  }>;
  reason?: 'already_imported' | 'potential_match';
}

export interface ImportPatientRequest {
  overrides?: Partial<EmrPatientImportData>;
  forceImport?: boolean;
}

export interface ImportPatientResponse {
  message: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
  };
}

// ===========================================
// VENDOR CONFIGURATION
// ===========================================

export const EMR_VENDOR_CONFIG: Record<EmrVendor, { label: string; icon: string; color: string }> = {
  EPIC: { label: 'Epic', icon: 'epic', color: 'bg-red-100 text-red-800' },
  CERNER: { label: 'Cerner', icon: 'cerner', color: 'bg-orange-100 text-orange-800' },
  ALLSCRIPTS: { label: 'Allscripts', icon: 'allscripts', color: 'bg-blue-100 text-blue-800' },
  MEDITECH: { label: 'Meditech', icon: 'meditech', color: 'bg-purple-100 text-purple-800' },
  ATHENAHEALTH: { label: 'athenahealth', icon: 'athena', color: 'bg-green-100 text-green-800' },
  NEXTGEN: { label: 'NextGen', icon: 'nextgen', color: 'bg-teal-100 text-teal-800' },
  CUSTOM: { label: 'Custom FHIR', icon: 'custom', color: 'bg-gray-100 text-gray-800' },
};
