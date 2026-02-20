/**
 * EMR Mapping Service
 *
 * Converts FHIR R4 resources to internal application models and vice versa.
 */

import type {
  FhirPatient,
  FhirHumanName,
  FhirAddress,
  FhirContactPoint,
  FhirIdentifier,
  EmrPatientImportData,
  EmrPatientSearchResult,
} from './fhirTypes';
import { FHIR_IDENTIFIER_SYSTEMS } from './fhirTypes';
import { Gender, MaritalStatus, ContactRelationship } from '../../generated/prisma';

// ===========================================
// FHIR TO INTERNAL MAPPING
// ===========================================

/**
 * Extract the official or usual name from a FHIR Patient
 */
export function extractPatientName(names?: FhirHumanName[]): {
  firstName: string;
  lastName: string;
  middleName?: string;
} {
  if (!names || names.length === 0) {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  }

  // Prefer official name, then usual, then first available
  const name =
    names.find(n => n.use === 'official') ||
    names.find(n => n.use === 'usual') ||
    names[0];

  if (!name) {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  }

  const firstName = name.given?.[0] || 'Unknown';
  const middleName = name.given?.slice(1).join(' ') || undefined;
  const lastName = name.family || 'Unknown';

  return { firstName, lastName, middleName };
}

/**
 * Extract primary phone number from FHIR telecom
 */
export function extractPhone(
  telecoms?: FhirContactPoint[],
  use?: 'home' | 'work' | 'mobile'
): string | undefined {
  if (!telecoms) return undefined;

  // Find phone with specified use, or mobile, or first phone
  const phone =
    (use ? telecoms.find(t => t.system === 'phone' && t.use === use) : null) ||
    telecoms.find(t => t.system === 'phone' && t.use === 'mobile') ||
    telecoms.find(t => t.system === 'phone' && t.use === 'home') ||
    telecoms.find(t => t.system === 'phone');

  return phone?.value;
}

/**
 * Extract email from FHIR telecom
 */
export function extractEmail(telecoms?: FhirContactPoint[]): string | undefined {
  if (!telecoms) return undefined;
  const email = telecoms.find(t => t.system === 'email');
  return email?.value;
}

/**
 * Extract primary address from FHIR Patient
 */
export function extractAddress(addresses?: FhirAddress[]): {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
} {
  if (!addresses || addresses.length === 0) {
    return {};
  }

  // Prefer home address, then first available
  const address =
    addresses.find(a => a.use === 'home') ||
    addresses[0];

  if (!address) {
    return {};
  }

  return {
    street1: address.line?.[0],
    street2: address.line?.slice(1).join(', '),
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };
}

/**
 * Extract MRN from FHIR Patient identifiers
 */
export function extractMrn(identifiers?: FhirIdentifier[]): string | undefined {
  if (!identifiers) return undefined;

  // Look for MRN by type code
  const mrnIdentifier = identifiers.find(id => {
    const coding = id.type?.coding;
    return coding?.some(c => c.code === 'MR' || c.code === 'MRN');
  });

  if (mrnIdentifier) {
    return mrnIdentifier.value;
  }

  // Fallback: first identifier that's not SSN
  const firstNonSsn = identifiers.find(
    id => id.system !== FHIR_IDENTIFIER_SYSTEMS.SSN
  );
  return firstNonSsn?.value;
}

/**
 * Map FHIR gender to internal Gender enum
 */
export function mapFhirGender(
  fhirGender?: 'male' | 'female' | 'other' | 'unknown'
): Gender {
  switch (fhirGender) {
    case 'male':
      return Gender.MALE;
    case 'female':
      return Gender.FEMALE;
    case 'other':
      return Gender.OTHER;
    default:
      return Gender.PREFER_NOT_TO_SAY;
  }
}

/**
 * Map FHIR marital status to internal MaritalStatus enum
 */
export function mapFhirMaritalStatus(
  fhirMaritalStatus?: string
): MaritalStatus | undefined {
  switch (fhirMaritalStatus?.toUpperCase()) {
    case 'M':
    case 'MARRIED':
      return MaritalStatus.MARRIED;
    case 'S':
    case 'SINGLE':
    case 'NEVER MARRIED':
      return MaritalStatus.SINGLE;
    case 'D':
    case 'DIVORCED':
      return MaritalStatus.DIVORCED;
    case 'W':
    case 'WIDOWED':
      return MaritalStatus.WIDOWED;
    case 'L':
    case 'SEPARATED':
    case 'LEGALLY SEPARATED':
      return MaritalStatus.SEPARATED;
    case 'T':
    case 'DOMESTIC PARTNER':
      return MaritalStatus.DOMESTIC_PARTNER;
    default:
      return undefined;
  }
}

/**
 * Map FHIR relationship code to internal ContactRelationship enum
 */
export function mapFhirRelationship(
  fhirRelationship?: string
): ContactRelationship {
  const code = fhirRelationship?.toUpperCase();
  switch (code) {
    case 'MTH':
    case 'FTH':
    case 'PRN':
    case 'PARENT':
      return ContactRelationship.PARENT;
    case 'CHILD':
    case 'SON':
    case 'DAU':
      return ContactRelationship.CHILD;
    case 'SIB':
    case 'BRO':
    case 'SIS':
      return ContactRelationship.SIBLING;
    case 'SPS':
    case 'HUSB':
    case 'WIFE':
    case 'SPOUSE':
      return ContactRelationship.SPOUSE;
    case 'GGRPRN':
    case 'GRNDSON':
    case 'GRNDDAU':
    case 'GRANDCHILD':
      return ContactRelationship.GRANDCHILD;
    case 'FRND':
    case 'FRIEND':
      return ContactRelationship.FRIEND;
    case 'NBOR':
    case 'NEIGHBOR':
      return ContactRelationship.NEIGHBOR;
    case 'CGV':
    case 'CAREGIVER':
      return ContactRelationship.CAREGIVER;
    case 'GUARD':
    case 'GUARDIAN':
      return ContactRelationship.LEGAL_GUARDIAN;
    default:
      return ContactRelationship.OTHER;
  }
}

/**
 * Convert FHIR Patient to search result format
 */
export function fhirPatientToSearchResult(
  patient: FhirPatient,
  isImported: boolean = false,
  localPatientId?: string
): EmrPatientSearchResult {
  const { firstName, lastName, middleName } = extractPatientName(patient.name);
  const address = extractAddress(patient.address);

  return {
    fhirId: patient.id || '',
    mrn: extractMrn(patient.identifier),
    firstName,
    lastName,
    middleName,
    dateOfBirth: patient.birthDate || '',
    gender: patient.gender || 'unknown',
    phone: extractPhone(patient.telecom),
    email: extractEmail(patient.telecom),
    address: {
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    },
    isAlreadyImported: isImported,
    localPatientId,
  };
}

/**
 * Convert FHIR Patient to import data format for patient creation
 */
export function fhirPatientToImportData(
  patient: FhirPatient
): EmrPatientImportData {
  const { firstName, lastName, middleName } = extractPatientName(patient.name);
  const address = extractAddress(patient.address);
  const phoneMobile = extractPhone(patient.telecom, 'mobile') ||
                      extractPhone(patient.telecom) ||
                      '0000000000'; // Default if no phone

  // Extract emergency contacts from patient.contact
  const emergencyContacts = patient.contact
    ?.filter(c => c.name)
    .map(c => {
      const contactName = extractPatientName(c.name ? [c.name] : undefined);
      const relationship = c.relationship?.[0]?.coding?.[0]?.code || 'OTHER';
      return {
        firstName: contactName.firstName,
        lastName: contactName.lastName,
        relationship: mapFhirRelationship(relationship).toString(),
        phoneMobile: extractPhone(c.telecom) || '',
        isPrimaryContact: false,
      };
    })
    .filter(c => c.phoneMobile); // Only include contacts with phones

  // Extract preferred language
  const preferredLanguage = patient.communication
    ?.find(c => c.preferred)
    ?.language?.coding?.[0]?.display ||
    patient.communication?.[0]?.language?.coding?.[0]?.display ||
    'English';

  // Extract general practitioner
  const primaryPhysicianName = patient.generalPractitioner?.[0]?.display;

  // Map marital status
  const maritalStatusCode = patient.maritalStatus?.coding?.[0]?.code;

  return {
    firstName,
    lastName,
    middleName,
    dateOfBirth: patient.birthDate || new Date().toISOString().split('T')[0] || '',
    gender: mapFhirGender(patient.gender).toString() as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY',
    phoneMobile,
    phoneHome: extractPhone(patient.telecom, 'home'),
    email: extractEmail(patient.telecom),
    addressStreet1: address.street1 || 'Unknown',
    addressStreet2: address.street2,
    addressCity: address.city || 'Unknown',
    addressState: address.state || 'XX',
    addressZipCode: address.postalCode || '00000',
    maritalStatus: mapFhirMaritalStatus(maritalStatusCode)?.toString(),
    preferredLanguage,
    primaryPhysicianName,
    emergencyContacts: emergencyContacts?.length ? emergencyContacts : undefined,
  };
}

// ===========================================
// INTERNAL TO FHIR MAPPING (for future use)
// ===========================================

/**
 * Map internal Gender to FHIR gender
 */
export function internalGenderToFhir(
  gender: Gender
): 'male' | 'female' | 'other' | 'unknown' {
  switch (gender) {
    case Gender.MALE:
      return 'male';
    case Gender.FEMALE:
      return 'female';
    case Gender.OTHER:
      return 'other';
    default:
      return 'unknown';
  }
}

/**
 * Build FHIR search query string from parameters
 */
export function buildFhirSearchQuery(
  params: Record<string, string | number | undefined>
): string {
  const queryParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return queryParams ? `?${queryParams}` : '';
}
