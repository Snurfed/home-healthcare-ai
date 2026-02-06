/**
 * React Query Provider
 *
 * Configuration for React Query client
 */

import { QueryClient } from 'react-query';

// Create query client with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      cacheTime: 30 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus (prevents data flicker during tablet use)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys for type-safe cache management
export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
  },

  // Assessments
  assessments: {
    all: ['assessments'] as const,
    lists: () => [...queryKeys.assessments.all, 'list'] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.assessments.lists(), params] as const,
    details: () => [...queryKeys.assessments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.assessments.details(), id] as const,
  },

  // Questions
  questions: {
    all: ['questions'] as const,
    lists: () => [...queryKeys.questions.all, 'list'] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.questions.lists(), params] as const,
    bySection: (section: string) =>
      [...queryKeys.questions.all, 'section', section] as const,
  },

  // Patients
  patients: {
    all: ['patients'] as const,
    lists: () => [...queryKeys.patients.all, 'list'] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.patients.lists(), params] as const,
    search: (query: string, params: Record<string, unknown>) =>
      [...queryKeys.patients.all, 'search', query, params] as const,
    details: () => [...queryKeys.patients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.patients.details(), id] as const,
  },

  // Episodes
  episodes: {
    all: ['episodes'] as const,
    byPatient: (patientId: string) =>
      [...queryKeys.episodes.all, 'patient', patientId] as const,
    details: () => [...queryKeys.episodes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.episodes.details(), id] as const,
  },
};

export default queryClient;
