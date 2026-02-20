/**
 * Mock FHIR Service
 *
 * Provides mock FHIR data for development and testing.
 * Enable via USE_MOCK_FHIR=true environment variable.
 */

import type {
  FhirPatient,
  FhirBundle,
  PatientSearchParams,
} from './fhirTypes';

// ===========================================
// MOCK PATIENT DATA
// ===========================================

const MOCK_PATIENTS: FhirPatient[] = [
  {
    resourceType: 'Patient',
    id: 'mock-patient-001',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-15T10:30:00Z',
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        },
        system: 'urn:oid:1.2.3.4.5.6',
        value: 'EMR-12345678',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Smith',
        given: ['John', 'Robert'],
      },
    ],
    telecom: [
      { system: 'phone', value: '555-123-4567', use: 'mobile' },
      { system: 'phone', value: '555-123-4568', use: 'home' },
      { system: 'email', value: 'john.smith@email.com', use: 'home' },
    ],
    gender: 'male',
    birthDate: '1950-03-15',
    address: [
      {
        use: 'home',
        line: ['123 Main Street', 'Apt 4B'],
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'USA',
      },
    ],
    maritalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: 'M' }],
      text: 'Married',
    },
    contact: [
      {
        relationship: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'SPS' }],
            text: 'Spouse',
          },
        ],
        name: { family: 'Smith', given: ['Mary'] },
        telecom: [{ system: 'phone', value: '555-123-4569', use: 'mobile' }],
      },
    ],
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }] },
        preferred: true,
      },
    ],
    generalPractitioner: [{ display: 'Dr. Jane Wilson, MD' }],
  },
  {
    resourceType: 'Patient',
    id: 'mock-patient-002',
    meta: {
      versionId: '1',
      lastUpdated: '2024-01-20T14:15:00Z',
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        },
        system: 'urn:oid:1.2.3.4.5.6',
        value: 'EMR-12345679',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Smith',
        given: ['Jane', 'Marie'],
      },
    ],
    telecom: [
      { system: 'phone', value: '555-987-6543', use: 'mobile' },
      { system: 'email', value: 'jane.smith@email.com', use: 'home' },
    ],
    gender: 'female',
    birthDate: '1952-07-22',
    address: [
      {
        use: 'home',
        line: ['456 Oak Avenue'],
        city: 'Springfield',
        state: 'IL',
        postalCode: '62702',
        country: 'USA',
      },
    ],
    maritalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: 'W' }],
      text: 'Widowed',
    },
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }] },
        preferred: true,
      },
    ],
    generalPractitioner: [{ display: 'Dr. Robert Chen, MD' }],
  },
  {
    resourceType: 'Patient',
    id: 'mock-patient-003',
    meta: {
      versionId: '1',
      lastUpdated: '2024-02-01T09:00:00Z',
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        },
        system: 'urn:oid:1.2.3.4.5.6',
        value: 'EMR-12345680',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Johnson',
        given: ['Michael', 'Lee'],
      },
    ],
    telecom: [
      { system: 'phone', value: '555-456-7890', use: 'mobile' },
      { system: 'email', value: 'mjohnson@email.com' },
    ],
    gender: 'male',
    birthDate: '1945-11-08',
    address: [
      {
        use: 'home',
        line: ['789 Elm Court'],
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
      },
    ],
    maritalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: 'M' }],
      text: 'Married',
    },
    contact: [
      {
        relationship: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'CHILD' }],
            text: 'Child',
          },
        ],
        name: { family: 'Johnson', given: ['Sarah'] },
        telecom: [{ system: 'phone', value: '555-456-7891', use: 'mobile' }],
      },
    ],
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }] },
        preferred: true,
      },
    ],
    generalPractitioner: [{ display: 'Dr. Amanda Torres, MD' }],
  },
  {
    resourceType: 'Patient',
    id: 'mock-patient-004',
    meta: {
      versionId: '1',
      lastUpdated: '2024-02-10T11:30:00Z',
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        },
        system: 'urn:oid:1.2.3.4.5.6',
        value: 'EMR-12345681',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Garcia',
        given: ['Maria', 'Elena'],
      },
    ],
    telecom: [
      { system: 'phone', value: '555-321-0987', use: 'mobile' },
      { system: 'phone', value: '555-321-0988', use: 'home' },
    ],
    gender: 'female',
    birthDate: '1960-05-30',
    address: [
      {
        use: 'home',
        line: ['321 Pine Street'],
        city: 'Naperville',
        state: 'IL',
        postalCode: '60540',
        country: 'USA',
      },
    ],
    maritalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: 'D' }],
      text: 'Divorced',
    },
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'es', display: 'Spanish' }] },
        preferred: true,
      },
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }] },
        preferred: false,
      },
    ],
    generalPractitioner: [{ display: 'Dr. Carlos Rodriguez, MD' }],
  },
  {
    resourceType: 'Patient',
    id: 'mock-patient-005',
    meta: {
      versionId: '1',
      lastUpdated: '2024-02-15T16:45:00Z',
    },
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
        },
        system: 'urn:oid:1.2.3.4.5.6',
        value: 'EMR-12345682',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: 'Williams',
        given: ['Robert', 'James'],
      },
    ],
    telecom: [
      { system: 'phone', value: '555-654-3210', use: 'mobile' },
    ],
    gender: 'male',
    birthDate: '1938-12-01',
    address: [
      {
        use: 'home',
        line: ['555 Maple Drive', 'Unit 12'],
        city: 'Evanston',
        state: 'IL',
        postalCode: '60201',
        country: 'USA',
      },
    ],
    maritalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: 'W' }],
      text: 'Widowed',
    },
    contact: [
      {
        relationship: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'CHILD' }],
            text: 'Child',
          },
        ],
        name: { family: 'Williams', given: ['Jennifer'] },
        telecom: [{ system: 'phone', value: '555-654-3211', use: 'mobile' }],
      },
      {
        relationship: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'CGV' }],
            text: 'Caregiver',
          },
        ],
        name: { family: 'Thompson', given: ['Lisa'] },
        telecom: [{ system: 'phone', value: '555-654-3212', use: 'mobile' }],
      },
    ],
    communication: [
      {
        language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en', display: 'English' }] },
        preferred: true,
      },
    ],
    generalPractitioner: [{ display: 'Dr. Patricia Lee, MD' }],
  },
];

// ===========================================
// MOCK SERVICE CLASS
// ===========================================

export class MockFhirService {
  /**
   * Check if mock mode is enabled
   */
  static isEnabled(): boolean {
    return process.env['USE_MOCK_FHIR'] === 'true';
  }

  /**
   * Search patients with optional filters
   */
  static searchPatients(params: PatientSearchParams): FhirBundle<FhirPatient> {
    let results = [...MOCK_PATIENTS];

    // Filter by name (any part)
    if (params.name) {
      const searchTerm = params.name.toLowerCase();
      results = results.filter(p =>
        p.name?.some(n =>
          n.family?.toLowerCase().includes(searchTerm) ||
          n.given?.some(g => g.toLowerCase().includes(searchTerm))
        )
      );
    }

    // Filter by family name
    if (params.family) {
      const searchTerm = params.family.toLowerCase();
      results = results.filter(p =>
        p.name?.some(n => n.family?.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by given name
    if (params.given) {
      const searchTerm = params.given.toLowerCase();
      results = results.filter(p =>
        p.name?.some(n => n.given?.some(g => g.toLowerCase().includes(searchTerm)))
      );
    }

    // Filter by birthdate
    if (params.birthdate) {
      results = results.filter(p => p.birthDate === params.birthdate);
    }

    // Filter by gender
    if (params.gender) {
      results = results.filter(p => p.gender === params.gender);
    }

    // Filter by identifier (MRN)
    if (params.identifier) {
      const searchTerm = params.identifier.toLowerCase();
      results = results.filter(p =>
        p.identifier?.some(id => id.value?.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by phone
    if (params.phone) {
      const searchTerm = params.phone.replace(/\D/g, ''); // Remove non-digits
      results = results.filter(p =>
        p.telecom?.some(t =>
          t.system === 'phone' && t.value?.replace(/\D/g, '').includes(searchTerm)
        )
      );
    }

    // Filter by city
    if (params['address-city']) {
      const searchTerm = params['address-city'].toLowerCase();
      results = results.filter(p =>
        p.address?.some(a => a.city?.toLowerCase().includes(searchTerm))
      );
    }

    // Limit results
    const count = params._count || 20;
    results = results.slice(0, count);

    // Build bundle
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: results.length,
      link: [
        {
          relation: 'self',
          url: `Patient?_count=${count}`,
        },
      ],
      entry: results.map(patient => ({
        fullUrl: `Patient/${patient.id}`,
        resource: patient,
        search: {
          mode: 'match',
          score: 1.0,
        },
      })),
    };
  }

  /**
   * Get a single patient by ID
   */
  static getPatient(id: string): FhirPatient | null {
    return MOCK_PATIENTS.find(p => p.id === id) || null;
  }

  /**
   * Simulate OAuth authorization URL
   */
  static getAuthorizationUrl(_connectionId: string, redirectUri: string, state: string): string {
    // In mock mode, redirect directly back with a mock code
    const mockCode = `mock-auth-code-${Date.now()}`;
    return `${redirectUri}?code=${mockCode}&state=${state}`;
  }

  /**
   * Simulate OAuth token exchange
   */
  static async exchangeCodeForToken(_code: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
  }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      access_token: `mock-access-token-${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      refresh_token: `mock-refresh-token-${Date.now()}`,
      scope: 'patient/*.read launch/patient',
    };
  }

  /**
   * Simulate token refresh
   */
  static async refreshToken(_refreshToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      access_token: `mock-access-token-refreshed-${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: `mock-refresh-token-refreshed-${Date.now()}`,
    };
  }
}

export default MockFhirService;
