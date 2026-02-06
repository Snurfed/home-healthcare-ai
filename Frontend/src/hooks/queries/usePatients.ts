/**
 * Patient Query Hooks
 *
 * React Query hooks for patient operations
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { queryKeys } from '@context/QueryProvider';
import { patientService } from '@services/index';
import type { PatientSearchParams, PatientListItem, CreatePatientRequest } from '@services/patient.service';
import type { PaginatedResponse } from '@typedefs/api.types';

/**
 * Hook to search patients
 */
export function usePatientSearch(params?: PatientSearchParams) {
  return useQuery<PaginatedResponse<PatientListItem>, Error>(
    queryKeys.patients.search(params?.search || '', (params || {}) as Record<string, unknown>),
    () => patientService.searchPatients(params),
    {
      keepPreviousData: true,
      enabled: true,
    }
  );
}

/**
 * Hook to get a single patient
 */
export function usePatient(id: string | undefined) {
  return useQuery<PatientListItem, Error>(
    queryKeys.patients.detail(id || ''),
    () => patientService.getPatient(id!),
    {
      enabled: !!id,
    }
  );
}

/**
 * Hook to create a new patient
 */
export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation<PatientListItem, Error, CreatePatientRequest>(
    (data) => patientService.createPatient(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.patients.all);
      },
    }
  );
}
