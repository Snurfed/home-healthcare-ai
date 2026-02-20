/**
 * EMR Service
 *
 * API client for EMR integration endpoints
 */

import apiClient from './api/client';
import type {
  EmrConnection,
  CreateEmrConnectionRequest,
  UpdateEmrConnectionRequest,
  ConnectionTestResult,
  ConnectionStatus,
  EmrPatientSearchParams,
  EmrPatientSearchResult,
  EmrPatientDetail,
  DuplicateCheckResult,
  ImportPatientRequest,
  ImportPatientResponse,
} from '@typedefs/index';

const EMR_BASE_URL = '/emr';

// ===========================================
// CONNECTION MANAGEMENT
// ===========================================

/**
 * List all EMR connections
 */
export async function listConnections(): Promise<EmrConnection[]> {
  const response = await apiClient.get<{ connections: EmrConnection[] }>(
    `${EMR_BASE_URL}/connections`
  );
  return response.data.connections;
}

/**
 * Create a new EMR connection
 */
export async function createConnection(
  data: CreateEmrConnectionRequest
): Promise<EmrConnection> {
  const response = await apiClient.post<{ connection: EmrConnection }>(
    `${EMR_BASE_URL}/connections`,
    data
  );
  return response.data.connection;
}

/**
 * Update an EMR connection
 */
export async function updateConnection(
  id: string,
  data: UpdateEmrConnectionRequest
): Promise<EmrConnection> {
  const response = await apiClient.put<{ connection: EmrConnection }>(
    `${EMR_BASE_URL}/connections/${id}`,
    data
  );
  return response.data.connection;
}

/**
 * Delete an EMR connection
 */
export async function deleteConnection(id: string): Promise<void> {
  await apiClient.delete(`${EMR_BASE_URL}/connections/${id}`);
}

/**
 * Test an EMR connection
 */
export async function testConnection(id: string): Promise<ConnectionTestResult> {
  const response = await apiClient.post<ConnectionTestResult>(
    `${EMR_BASE_URL}/connections/${id}/test`,
    {}
  );
  return response.data;
}

/**
 * Get connection status for current user
 */
export async function getConnectionStatus(id: string): Promise<ConnectionStatus> {
  const response = await apiClient.get<ConnectionStatus>(
    `${EMR_BASE_URL}/connections/${id}/status`
  );
  return response.data;
}

// ===========================================
// OAUTH FLOW
// ===========================================

/**
 * Get authorization URL for OAuth flow
 */
export async function getAuthorizationUrl(
  connectionId: string,
  redirectUri?: string
): Promise<string> {
  const params = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : '';
  const response = await apiClient.get<{ authorizationUrl: string }>(
    `${EMR_BASE_URL}/connections/${connectionId}/authorize${params}`
  );
  return response.data.authorizationUrl;
}

/**
 * Open OAuth popup for EMR authorization
 */
export function openOAuthPopup(authUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'EMR Authorization',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      resolve(false);
      return;
    }

    // Poll for popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        resolve(true);
      }
    }, 500);

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      if (!popup.closed) {
        popup.close();
      }
      resolve(false);
    }, 10 * 60 * 1000);
  });
}

// ===========================================
// PATIENT OPERATIONS
// ===========================================

/**
 * Search patients in EMR
 */
export async function searchPatients(
  connectionId: string,
  params: EmrPatientSearchParams
): Promise<EmrPatientSearchResult[]> {
  const searchParams = new URLSearchParams();

  if (params.name) searchParams.set('name', params.name);
  if (params.given) searchParams.set('given', params.given);
  if (params.family) searchParams.set('family', params.family);
  if (params.birthdate) searchParams.set('birthdate', params.birthdate);
  if (params.mrn) searchParams.set('mrn', params.mrn);
  if (params.phone) searchParams.set('phone', params.phone);
  if (params._count) searchParams.set('_count', String(params._count));

  const queryString = searchParams.toString();
  const response = await apiClient.get<{ patients: EmrPatientSearchResult[] }>(
    `${EMR_BASE_URL}/connections/${connectionId}/patients${queryString ? `?${queryString}` : ''}`
  );

  return response.data.patients;
}

/**
 * Get a single patient from EMR
 */
export async function getPatient(
  connectionId: string,
  fhirId: string
): Promise<EmrPatientDetail> {
  const response = await apiClient.get<EmrPatientDetail>(
    `${EMR_BASE_URL}/connections/${connectionId}/patients/${fhirId}`
  );
  return response.data;
}

/**
 * Check for duplicate patients before import
 */
export async function checkDuplicates(
  connectionId: string,
  fhirId: string
): Promise<DuplicateCheckResult> {
  const response = await apiClient.post<DuplicateCheckResult>(
    `${EMR_BASE_URL}/connections/${connectionId}/patients/${fhirId}/check-duplicates`,
    {}
  );
  return response.data;
}

/**
 * Import a patient from EMR
 */
export async function importPatient(
  connectionId: string,
  fhirId: string,
  options: ImportPatientRequest = {}
): Promise<ImportPatientResponse> {
  const response = await apiClient.post<ImportPatientResponse>(
    `${EMR_BASE_URL}/connections/${connectionId}/patients/${fhirId}/import`,
    options
  );
  return response.data;
}

// ===========================================
// EXPORTS
// ===========================================

export const emrService = {
  // Connections
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  getConnectionStatus,
  // OAuth
  getAuthorizationUrl,
  openOAuthPopup,
  // Patients
  searchPatients,
  getPatient,
  checkDuplicates,
  importPatient,
};

export default emrService;
