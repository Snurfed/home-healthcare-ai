/**
 * Form Engine React Query Hooks
 *
 * Hooks for form engine operations with React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import formEngineService from '@services/formEngine.service';
import type {
  GetFormParams,
  GetFormResponse,
  SaveResponsesRequest,
  SaveResponsesResponse,
  ToggleModuleRequest,
  ToggleModuleResponse,
  FormDefinitionListItem,
  SectionListItem,
  QuestionSearchResult,
} from '@services/formEngine.service';
import type {
  Discipline,
  VisitType,
  CanonicalValidationResult,
  CanonicalFormDefinition,
} from '@typedefs/index';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const formEngineQueryKeys = {
  all: ['formEngine'] as const,
  forms: () => [...formEngineQueryKeys.all, 'forms'] as const,
  form: (params: GetFormParams) => [...formEngineQueryKeys.forms(), params] as const,
  visitForm: (visitId: string, options?: { discipline?: Discipline; visitType?: VisitType }) =>
    [...formEngineQueryKeys.all, 'visitForm', visitId, options] as const,
  definitions: () => [...formEngineQueryKeys.all, 'definitions'] as const,
  definition: (id: string) => [...formEngineQueryKeys.definitions(), id] as const,
  sections: () => [...formEngineQueryKeys.all, 'sections'] as const,
  validation: (visitId: string) => [...formEngineQueryKeys.all, 'validation', visitId] as const,
  questions: () => [...formEngineQueryKeys.all, 'questions'] as const,
  questionSearch: (query: string, limit?: number) =>
    [...formEngineQueryKeys.questions(), 'search', query, limit] as const,
  question: (conceptId: string) => [...formEngineQueryKeys.questions(), conceptId] as const,
};

// =============================================================================
// FORM RETRIEVAL HOOKS
// =============================================================================

/**
 * Hook to get form for a discipline and visit type
 */
export function useForm(
  params: GetFormParams,
  options?: { enabled?: boolean }
) {
  return useQuery<GetFormResponse, Error>(
    formEngineQueryKeys.form(params),
    () => formEngineService.getForm(params),
    {
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  );
}

/**
 * Hook to get form for a specific visit
 */
export function useVisitForm(
  visitId: string | undefined,
  options?: {
    discipline?: Discipline;
    visitType?: VisitType;
    enabled?: boolean;
  }
) {
  return useQuery<GetFormResponse, Error>(
    formEngineQueryKeys.visitForm(visitId || '', {
      discipline: options?.discipline,
      visitType: options?.visitType,
    }),
    () => formEngineService.getVisitForm(visitId!, {
      discipline: options?.discipline,
      visitType: options?.visitType,
    }),
    {
      enabled: !!visitId && (options?.enabled ?? true),
      staleTime: 30 * 1000, // 30 seconds (form data changes frequently)
      refetchOnWindowFocus: false,
    }
  );
}

/**
 * Hook to get all form definitions
 */
export function useFormDefinitions() {
  return useQuery<FormDefinitionListItem[], Error>(
    formEngineQueryKeys.definitions(),
    formEngineService.getFormDefinitions,
    {
      staleTime: 60 * 60 * 1000, // 1 hour (definitions rarely change)
    }
  );
}

/**
 * Hook to get a specific form definition
 */
export function useFormDefinition(definitionId: string | undefined) {
  return useQuery<CanonicalFormDefinition, Error>(
    formEngineQueryKeys.definition(definitionId || ''),
    () => formEngineService.getFormDefinitionById(definitionId!),
    {
      enabled: !!definitionId,
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );
}

/**
 * Hook to get all available sections
 */
export function useSections() {
  return useQuery<SectionListItem[], Error>(
    formEngineQueryKeys.sections(),
    formEngineService.getSections,
    {
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );
}

// =============================================================================
// RESPONSE MANAGEMENT HOOKS
// =============================================================================

/**
 * Hook to save responses for a visit
 */
export function useSaveResponses(visitId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<SaveResponsesResponse, Error, SaveResponsesRequest>(
    (data) => formEngineService.saveResponses(visitId!, data),
    {
      onSuccess: () => {
        // Invalidate form data to refresh
        if (visitId) {
          queryClient.invalidateQueries(formEngineQueryKeys.visitForm(visitId));
          queryClient.invalidateQueries(formEngineQueryKeys.validation(visitId));
        }
      },
    }
  );
}

/**
 * Hook to toggle a module on/off
 */
export function useToggleModule(visitId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<ToggleModuleResponse, Error, ToggleModuleRequest>(
    (data) => formEngineService.toggleModule(visitId!, data),
    {
      onSuccess: () => {
        // Invalidate form data to refresh with new module state
        if (visitId) {
          queryClient.invalidateQueries(formEngineQueryKeys.visitForm(visitId));
        }
      },
    }
  );
}

// =============================================================================
// VALIDATION HOOKS
// =============================================================================

/**
 * Hook to validate a visit note
 */
export function useValidateVisitNote(
  visitId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<CanonicalValidationResult, Error>(
    formEngineQueryKeys.validation(visitId || ''),
    () => formEngineService.validateVisitNote(visitId!),
    {
      enabled: !!visitId && (options?.enabled ?? true),
      staleTime: 10 * 1000, // 10 seconds
    }
  );
}

/**
 * Hook to validate on demand
 */
export function useValidateOnDemand() {
  return useMutation<CanonicalValidationResult, Error, string>(
    (visitId) => formEngineService.validateVisitNote(visitId)
  );
}

// =============================================================================
// QUESTION LOOKUP HOOKS
// =============================================================================

/**
 * Hook to search questions
 */
export function useSearchQuestions(
  query: string,
  limit = 20,
  options?: { enabled?: boolean }
) {
  return useQuery<QuestionSearchResult[], Error>(
    formEngineQueryKeys.questionSearch(query, limit),
    () => formEngineService.searchQuestions(query, limit),
    {
      enabled: query.length >= 2 && (options?.enabled ?? true),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to get a single question by concept ID
 */
export function useQuestion(conceptId: string | undefined) {
  return useQuery<QuestionSearchResult | null, Error>(
    formEngineQueryKeys.question(conceptId || ''),
    () => formEngineService.getQuestion(conceptId!),
    {
      enabled: !!conceptId,
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  useForm,
  useVisitForm,
  useFormDefinitions,
  useFormDefinition,
  useSections,
  useSaveResponses,
  useToggleModule,
  useValidateVisitNote,
  useValidateOnDemand,
  useSearchQuestions,
  useQuestion,
  formEngineQueryKeys,
};
