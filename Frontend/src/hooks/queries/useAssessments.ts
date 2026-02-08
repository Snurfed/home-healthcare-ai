/**
 * Assessment Query Hooks
 *
 * React Query hooks for OASIS assessments
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { queryKeys } from '@context/QueryProvider';
import { oasisService } from '@services/index';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import type {
  OASISAssessment,
  AssessmentListItem,
  OASISQuestion,
  ListAssessmentsParams,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  SubmitForReviewRequest,
  ReviewAssessmentRequest,
  PaginatedResponse,
  HIPPSDetailsResponse,
  HIPPSDetailsOptions,
} from '@typedefs/index';

/**
 * Hook to list assessments
 */
export function useAssessments(params?: ListAssessmentsParams) {
  return useQuery<PaginatedResponse<AssessmentListItem>, Error>(
    queryKeys.assessments.list((params || {}) as Record<string, unknown>),
    () => oasisService.listAssessments(params),
    {
      keepPreviousData: true, // Smooth pagination
    }
  );
}

/**
 * Hook to get a single assessment
 */
export function useAssessment(id: string | undefined) {
  const { setAssessment } = useAssessmentStore();

  return useQuery<OASISAssessment, Error>(
    queryKeys.assessments.detail(id || ''),
    () => oasisService.getAssessment(id!),
    {
      enabled: !!id,
      onSuccess: (data) => {
        setAssessment(data);
      },
    }
  );
}

/**
 * Hook to create a new assessment
 */
export function useCreateAssessment() {
  const queryClient = useQueryClient();

  return useMutation<OASISAssessment, Error, CreateAssessmentRequest>(
    (data) => oasisService.createAssessment(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
    }
  );
}

/**
 * Hook to update an assessment
 */
export function useUpdateAssessment(id: string) {
  const queryClient = useQueryClient();
  const { markSaved, setSaveError, setSaving } = useAssessmentStore();

  return useMutation<
    { id: string; status: string; completionPercentage: number; updatedAt: string },
    Error,
    UpdateAssessmentRequest
  >(
    async (data) => {
      setSaving(true);
      return oasisService.updateAssessment(id, data);
    },
    {
      onSuccess: () => {
        markSaved();
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
      onError: (error) => {
        setSaveError(error.message);
      },
    }
  );
}

/**
 * Hook to submit assessment for review
 */
export function useSubmitForReview(id: string) {
  const queryClient = useQueryClient();

  return useMutation<OASISAssessment, Error, SubmitForReviewRequest>(
    (data) => oasisService.submitForReview(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
    }
  );
}

/**
 * Hook to review an assessment (approve/reject)
 */
export function useReviewAssessment(id: string) {
  const queryClient = useQueryClient();

  return useMutation<OASISAssessment, Error, ReviewAssessmentRequest>(
    (data) => oasisService.reviewAssessment(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
    }
  );
}

/**
 * Hook to lock an assessment
 */
export function useLockAssessment(id: string) {
  const queryClient = useQueryClient();

  return useMutation<OASISAssessment, Error>(
    () => oasisService.lockAssessment(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
    }
  );
}

/**
 * Hook to delete an assessment
 */
export function useDeleteAssessment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>(
    (id) => oasisService.deleteAssessment(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.lists());
      },
    }
  );
}

/**
 * Hook to get OASIS questions
 */
export function useQuestions(params?: { section?: string; assessmentType?: string }) {
  return useQuery<OASISQuestion[], Error>(
    params?.section
      ? queryKeys.questions.bySection(params.section)
      : params?.assessmentType
      ? ['questions', 'byType', params.assessmentType]
      : queryKeys.questions.lists(),
    () => oasisService.getQuestions(params as never),
    {
      staleTime: 60 * 60 * 1000, // Questions rarely change, cache for 1 hour
      enabled: params === undefined || params.assessmentType !== undefined || params.section !== undefined,
    }
  );
}

/**
 * Hook to calculate HIPPS score
 */
export function useCalculateScore(id: string) {
  const queryClient = useQueryClient();

  return useMutation(
    () => oasisService.calculateScore(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
      },
    }
  );
}

/**
 * Hook to get detailed HIPPS information
 */
export function useHippsDetails(id: string | undefined, options?: HIPPSDetailsOptions) {
  return useQuery<HIPPSDetailsResponse, Error>(
    ['hipps', id, options],
    () => oasisService.getHippsDetails(id!, options),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );
}

/**
 * Hook to calculate enhanced HIPPS score with breakdown
 */
export function useCalculateEnhancedScore(id: string) {
  const queryClient = useQueryClient();

  return useMutation<
    HIPPSDetailsResponse,
    Error,
    { includeOptimizations?: boolean; wageIndex?: number }
  >(
    (options) => oasisService.calculateEnhancedScore(id, options),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.assessments.detail(id));
        queryClient.invalidateQueries(['hipps', id]);
      },
    }
  );
}
