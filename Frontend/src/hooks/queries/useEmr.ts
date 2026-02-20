/**
 * EMR React Query Hooks
 *
 * Hooks for EMR integration with React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { emrService } from '@services/index';
import type {
  CreateEmrConnectionRequest,
  UpdateEmrConnectionRequest,
  EmrPatientSearchParams,
  ImportPatientRequest,
  ImportPatientResponse,
  EmrConnection,
  ConnectionStatus,
  EmrPatientSearchResult,
  EmrPatientDetail,
  DuplicateCheckResult,
  ConnectionTestResult,
} from '@typedefs/index';

// ===========================================
// QUERY KEYS
// ===========================================

export const emrQueryKeys = {
  all: ['emr'] as const,
  connections: () => [...emrQueryKeys.all, 'connections'] as const,
  connection: (id: string) => [...emrQueryKeys.connections(), id] as const,
  connectionStatus: (id: string) => [...emrQueryKeys.connection(id), 'status'] as const,
  patients: (connectionId: string, params: EmrPatientSearchParams) =>
    [...emrQueryKeys.all, 'patients', connectionId, params] as const,
  patient: (connectionId: string, fhirId: string) =>
    [...emrQueryKeys.all, 'patient', connectionId, fhirId] as const,
  duplicates: (connectionId: string, fhirId: string) =>
    [...emrQueryKeys.all, 'duplicates', connectionId, fhirId] as const,
};

// ===========================================
// CONNECTION HOOKS
// ===========================================

/**
 * Hook to fetch all EMR connections
 */
export function useEmrConnections() {
  return useQuery<EmrConnection[], Error>(
    emrQueryKeys.connections(),
    emrService.listConnections,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to get connection status for current user
 */
export function useEmrConnectionStatus(connectionId: string | undefined) {
  return useQuery<ConnectionStatus, Error>(
    emrQueryKeys.connectionStatus(connectionId || ''),
    () => emrService.getConnectionStatus(connectionId!),
    {
      enabled: !!connectionId,
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refresh every minute to check token expiry
    }
  );
}

/**
 * Hook to create a new EMR connection
 */
export function useCreateEmrConnection() {
  const queryClient = useQueryClient();

  return useMutation<EmrConnection, Error, CreateEmrConnectionRequest>(
    (data) => emrService.createConnection(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(emrQueryKeys.connections());
      },
    }
  );
}

/**
 * Hook to update an EMR connection
 */
export function useUpdateEmrConnection() {
  const queryClient = useQueryClient();

  return useMutation<EmrConnection, Error, { id: string; data: UpdateEmrConnectionRequest }>(
    ({ id, data }) => emrService.updateConnection(id, data),
    {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries(emrQueryKeys.connections());
        queryClient.invalidateQueries(emrQueryKeys.connection(id));
      },
    }
  );
}

/**
 * Hook to delete an EMR connection
 */
export function useDeleteEmrConnection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>(
    (id) => emrService.deleteConnection(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(emrQueryKeys.connections());
      },
    }
  );
}

/**
 * Hook to test an EMR connection
 */
export function useTestEmrConnection() {
  return useMutation<ConnectionTestResult, Error, string>(
    (id) => emrService.testConnection(id)
  );
}

// ===========================================
// OAUTH HOOKS
// ===========================================

/**
 * Hook to initiate OAuth flow
 */
export function useEmrAuthorize() {
  const queryClient = useQueryClient();

  return useMutation<
    { completed: boolean; connectionId: string },
    Error,
    { connectionId: string; redirectUri?: string }
  >(
    async ({ connectionId, redirectUri }) => {
      const authUrl = await emrService.getAuthorizationUrl(connectionId, redirectUri);
      const completed = await emrService.openOAuthPopup(authUrl);
      return { completed, connectionId };
    },
    {
      onSuccess: ({ connectionId }) => {
        // Refresh connection status after OAuth
        queryClient.invalidateQueries(emrQueryKeys.connectionStatus(connectionId));
      },
    }
  );
}

// ===========================================
// PATIENT SEARCH HOOKS
// ===========================================

/**
 * Hook to search patients in EMR
 */
export function useEmrPatientSearch(
  connectionId: string | undefined,
  params: EmrPatientSearchParams,
  options?: { enabled?: boolean }
) {
  return useQuery<EmrPatientSearchResult[], Error>(
    emrQueryKeys.patients(connectionId || '', params),
    () => emrService.searchPatients(connectionId!, params),
    {
      enabled: !!connectionId && (options?.enabled ?? true) && Object.keys(params).length > 0,
      staleTime: 60 * 1000, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof Error && error.message.includes('authorization')) {
          return false;
        }
        return failureCount < 2;
      },
    }
  );
}

/**
 * Hook to get a single patient from EMR
 */
export function useEmrPatient(
  connectionId: string | undefined,
  fhirId: string | undefined
) {
  return useQuery<EmrPatientDetail, Error>(
    emrQueryKeys.patient(connectionId || '', fhirId || ''),
    () => emrService.getPatient(connectionId!, fhirId!),
    {
      enabled: !!connectionId && !!fhirId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to check for duplicate patients
 */
export function useCheckDuplicates(
  connectionId: string | undefined,
  fhirId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<DuplicateCheckResult, Error>(
    emrQueryKeys.duplicates(connectionId || '', fhirId || ''),
    () => emrService.checkDuplicates(connectionId!, fhirId!),
    {
      enabled: !!connectionId && !!fhirId && (options?.enabled ?? true),
      staleTime: 30 * 1000, // 30 seconds
    }
  );
}

// ===========================================
// IMPORT HOOKS
// ===========================================

/**
 * Hook to import a patient from EMR
 */
export function useImportEmrPatient() {
  const queryClient = useQueryClient();

  return useMutation<
    ImportPatientResponse,
    Error,
    { connectionId: string; fhirId: string; options?: ImportPatientRequest }
  >(
    ({ connectionId, fhirId, options }) =>
      emrService.importPatient(connectionId, fhirId, options),
    {
      onSuccess: (_, { connectionId }) => {
        // Invalidate patient searches to update "already imported" status
        queryClient.invalidateQueries([...emrQueryKeys.all, 'patients', connectionId]);
        // Also invalidate local patient list
        queryClient.invalidateQueries(['patients']);
      },
    }
  );
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  useEmrConnections,
  useEmrConnectionStatus,
  useCreateEmrConnection,
  useUpdateEmrConnection,
  useDeleteEmrConnection,
  useTestEmrConnection,
  useEmrAuthorize,
  useEmrPatientSearch,
  useEmrPatient,
  useCheckDuplicates,
  useImportEmrPatient,
};
