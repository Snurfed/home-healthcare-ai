/**
 * FHIR R4 Type Definitions
 *
 * Core types for FHIR R4 resources used in EMR integration.
 * Based on HL7 FHIR R4 specification.
 */

// ===========================================
// FHIR PRIMITIVES & BASE TYPES
// ===========================================

export interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: FhirCoding[];
  tag?: FhirCoding[];
}

export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
  period?: FhirPeriod;
  assigner?: FhirReference;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirReference {
  reference?: string;
  type?: string;
  identifier?: FhirIdentifier;
  display?: string;
}

export interface FhirAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FhirPeriod;
}

export interface FhirHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FhirPeriod;
}

export interface FhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: FhirPeriod;
}

export interface FhirAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

// ===========================================
// FHIR PATIENT RESOURCE
// ===========================================

export interface FhirPatientContact {
  relationship?: FhirCodeableConcept[];
  name?: FhirHumanName;
  telecom?: FhirContactPoint[];
  address?: FhirAddress;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: FhirReference;
  period?: FhirPeriod;
}

export interface FhirPatientCommunication {
  language: FhirCodeableConcept;
  preferred?: boolean;
}

export interface FhirPatientLink {
  other: FhirReference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

export interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  meta?: FhirMeta;
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FhirAddress[];
  maritalStatus?: FhirCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: FhirAttachment[];
  contact?: FhirPatientContact[];
  communication?: FhirPatientCommunication[];
  generalPractitioner?: FhirReference[];
  managingOrganization?: FhirReference;
  link?: FhirPatientLink[];
}

// ===========================================
// FHIR BUNDLE (Search Results)
// ===========================================

export interface FhirBundleLink {
  relation: string;
  url: string;
}

export interface FhirBundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface FhirBundleEntryRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface FhirBundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: FhirOperationOutcome;
}

export interface FhirBundleEntry<T = FhirResource> {
  fullUrl?: string;
  resource?: T;
  search?: FhirBundleEntrySearch;
  request?: FhirBundleEntryRequest;
  response?: FhirBundleEntryResponse;
}

export interface FhirBundle<T = FhirResource> {
  resourceType: 'Bundle';
  id?: string;
  meta?: FhirMeta;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' |
        'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: FhirBundleLink[];
  entry?: FhirBundleEntry<T>[];
}

// ===========================================
// FHIR OPERATION OUTCOME (Errors)
// ===========================================

export interface FhirOperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details?: FhirCodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  id?: string;
  meta?: FhirMeta;
  issue: FhirOperationOutcomeIssue[];
}

// Generic FHIR Resource type
export type FhirResource = FhirPatient | FhirBundle | FhirOperationOutcome;

// ===========================================
// SEARCH PARAMETERS
// ===========================================

export interface PatientSearchParams {
  /** Search by given name */
  given?: string;
  /** Search by family name */
  family?: string;
  /** Search by name (any part) */
  name?: string;
  /** Search by date of birth (YYYY-MM-DD) */
  birthdate?: string;
  /** Search by gender */
  gender?: 'male' | 'female' | 'other' | 'unknown';
  /** Search by identifier (e.g., MRN) */
  identifier?: string;
  /** Search by phone number */
  phone?: string;
  /** Search by email */
  email?: string;
  /** Search by address */
  address?: string;
  /** Search by city */
  'address-city'?: string;
  /** Search by state */
  'address-state'?: string;
  /** Search by postal code */
  'address-postalcode'?: string;
  /** Maximum results to return */
  _count?: number;
  /** Sort order */
  _sort?: string;
}

// ===========================================
// OAUTH TYPES
// ===========================================

export interface SmartConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  registration_endpoint?: string;
  management_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  scopes_supported?: string[];
  response_types_supported?: string[];
  capabilities?: string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  patient?: string; // Patient ID if patient-level scope
  id_token?: string;
}

export interface OAuthState {
  connectionId: string;
  userId: string;
  redirectUri: string;
  nonce: string;
}

// ===========================================
// INTERNAL TYPES
// ===========================================

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

// ===========================================
// KNOWN IDENTIFIER SYSTEMS
// ===========================================

export const FHIR_IDENTIFIER_SYSTEMS = {
  MRN: 'http://terminology.hl7.org/CodeSystem/v2-0203',
  SSN: 'http://hl7.org/fhir/sid/us-ssn',
  MEDICARE: 'http://hl7.org/fhir/sid/us-medicare',
  DRIVER_LICENSE: 'urn:oid:2.16.840.1.113883.4.3.36',
} as const;

export const FHIR_MARITAL_STATUS = {
  'A': 'Annulled',
  'D': 'Divorced',
  'I': 'Interlocutory',
  'L': 'Legally Separated',
  'M': 'Married',
  'P': 'Polygamous',
  'S': 'Never Married',
  'T': 'Domestic Partner',
  'U': 'Unmarried',
  'W': 'Widowed',
  'UNK': 'Unknown',
} as const;
