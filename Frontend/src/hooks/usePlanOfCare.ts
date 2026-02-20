/**
 * usePlanOfCare Hook
 *
 * React Query hooks for Plan of Care (485) operations.
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useCallback } from 'react';
import { apiClient } from '@services/index';
import type {
  PlanOfCare,
  CreatePlanOfCareRequest,
  UpdatePlanOfCareRequest,
  AutoPopulateFromOasisRequest,
  AutoPopulateFromOasisResponse,
  SignPlanOfCareRequest,
} from '@typedefs/index';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const planOfCareKeys = {
  all: ['plansOfCare'] as const,
  detail: (episodeId: string) => [...planOfCareKeys.all, 'detail', episodeId] as const,
};

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function getPlanOfCare(episodeId: string): Promise<PlanOfCare | null> {
  try {
    const response = await apiClient.get<PlanOfCare>(`/episodes/${episodeId}/plan-of-care`);
    return response.data;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createPlanOfCare(
  episodeId: string,
  data: CreatePlanOfCareRequest
): Promise<PlanOfCare> {
  const response = await apiClient.post<PlanOfCare>(`/episodes/${episodeId}/plan-of-care`, data);
  return response.data;
}

async function updatePlanOfCare(
  episodeId: string,
  pocId: string,
  data: UpdatePlanOfCareRequest
): Promise<PlanOfCare> {
  const response = await apiClient.put<PlanOfCare>(`/episodes/${episodeId}/plan-of-care/${pocId}`, data);
  return response.data;
}

async function autoPopulateFromOasis(
  episodeId: string,
  pocId: string,
  data: AutoPopulateFromOasisRequest
): Promise<AutoPopulateFromOasisResponse> {
  const response = await apiClient.post<AutoPopulateFromOasisResponse>(
    `/episodes/${episodeId}/plan-of-care/${pocId}/auto-populate`,
    data
  );
  return response.data;
}

async function signPlanOfCare(
  episodeId: string,
  pocId: string,
  data: SignPlanOfCareRequest
): Promise<PlanOfCare> {
  const response = await apiClient.post<PlanOfCare>(`/episodes/${episodeId}/plan-of-care/${pocId}/sign`, data);
  return response.data;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch Plan of Care for an episode
 */
export function usePlanOfCareQuery(episodeId: string | null) {
  return useQuery({
    queryKey: planOfCareKeys.detail(episodeId || ''),
    queryFn: () => getPlanOfCare(episodeId!),
    enabled: !!episodeId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create a new Plan of Care
 */
export function useCreatePlanOfCare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      data,
    }: {
      episodeId: string;
      data: CreatePlanOfCareRequest;
    }) => createPlanOfCare(episodeId, data),
    onSuccess: (result: PlanOfCare, variables: { episodeId: string; data: CreatePlanOfCareRequest }) => {
      queryClient.setQueryData(planOfCareKeys.detail(variables.episodeId), result);
    },
  });
}

/**
 * Update Plan of Care
 */
export function useUpdatePlanOfCare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      pocId,
      data,
    }: {
      episodeId: string;
      pocId: string;
      data: UpdatePlanOfCareRequest;
    }) => updatePlanOfCare(episodeId, pocId, data),
    onSuccess: (result: PlanOfCare, variables: { episodeId: string; pocId: string; data: UpdatePlanOfCareRequest }) => {
      queryClient.setQueryData(planOfCareKeys.detail(variables.episodeId), result);
    },
  });
}

/**
 * Auto-populate from OASIS
 */
export function useAutoPopulateFromOasis() {
  return useMutation({
    mutationFn: ({
      episodeId,
      pocId,
      data,
    }: {
      episodeId: string;
      pocId: string;
      data: AutoPopulateFromOasisRequest;
    }) => autoPopulateFromOasis(episodeId, pocId, data),
  });
}

/**
 * Sign Plan of Care
 */
export function useSignPlanOfCare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      pocId,
      data,
    }: {
      episodeId: string;
      pocId: string;
      data: SignPlanOfCareRequest;
    }) => signPlanOfCare(episodeId, pocId, data),
    onSuccess: (result: PlanOfCare, variables: { episodeId: string; pocId: string; data: SignPlanOfCareRequest }) => {
      queryClient.setQueryData(planOfCareKeys.detail(variables.episodeId), result);
    },
  });
}

// =============================================================================
// COMBINED HOOK
// =============================================================================

interface UsePlanOfCareOptions {
  episodeId: string;
  patientId: string;
}

export function usePlanOfCare({ episodeId, patientId }: UsePlanOfCareOptions) {
  // Fetch existing POC
  const { data: planOfCare, isLoading, error } = usePlanOfCareQuery(episodeId);

  // Mutations
  const createMutation = useCreatePlanOfCare();
  const updateMutation = useUpdatePlanOfCare();
  const autoPopulateMutation = useAutoPopulateFromOasis();
  const signMutation = useSignPlanOfCare();

  // Create POC if it doesn't exist
  const createIfNeeded = useCallback(
    async (physicianName: string, certStart: string, certEnd: string) => {
      if (planOfCare) return planOfCare;

      return createMutation.mutateAsync({
        episodeId,
        data: {
          episodeId,
          patientId,
          certificationPeriod: {
            startDate: certStart,
            endDate: certEnd,
          },
          physicianName,
        },
      });
    },
    [planOfCare, createMutation, episodeId, patientId]
  );

  // Save changes
  const save = useCallback(
    async (data: UpdatePlanOfCareRequest) => {
      if (!planOfCare?.id) {
        throw new Error('Plan of Care must be created first');
      }

      return updateMutation.mutateAsync({
        episodeId,
        pocId: planOfCare.id,
        data,
      });
    },
    [planOfCare?.id, updateMutation, episodeId]
  );

  // Auto-populate from OASIS
  const autoPopulate = useCallback(
    async (
      oasisAssessmentId: string,
      fieldsToPopulate?: ('diagnoses' | 'functionalLimitations' | 'mentalStatus' | 'safetyMeasures')[]
    ) => {
      if (!planOfCare?.id) {
        throw new Error('Plan of Care must be created first');
      }

      return autoPopulateMutation.mutateAsync({
        episodeId,
        pocId: planOfCare.id,
        data: {
          oasisAssessmentId,
          fieldsToPopulate,
        },
      });
    },
    [planOfCare?.id, autoPopulateMutation, episodeId]
  );

  // Sign POC
  const sign = useCallback(
    async (signatureType: 'physician' | 'nurse', signatureData: string, signedBy: string) => {
      if (!planOfCare?.id) {
        throw new Error('Plan of Care must be created first');
      }

      return signMutation.mutateAsync({
        episodeId,
        pocId: planOfCare.id,
        data: {
          signatureType,
          signatureData,
          signedAt: new Date().toISOString(),
          signedBy,
        },
      });
    },
    [planOfCare?.id, signMutation, episodeId]
  );

  return {
    planOfCare,
    isLoading,
    error,
    createIfNeeded,
    save,
    isSaving: updateMutation.isLoading,
    autoPopulate,
    isAutoPopulating: autoPopulateMutation.isLoading,
    sign,
    isSigning: signMutation.isLoading,
  };
}

export default usePlanOfCare;
