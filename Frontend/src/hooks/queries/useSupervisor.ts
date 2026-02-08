/**
 * Supervisor Query Hooks
 *
 * React Query hooks for supervisor dashboard operations
 */

import { useQuery } from 'react-query';
import * as supervisorService from '@services/supervisor.service';
import type {
  DashboardStats,
  PendingReviewItem,
  RecentActivityItem,
  PendingReviewsParams,
} from '@services/supervisor.service';
import type { PaginatedResponse } from '@typedefs/api.types';

/**
 * Hook to get supervisor dashboard statistics
 * Refetches every 60 seconds
 */
export function useSupervisorStats() {
  return useQuery<DashboardStats, Error>(
    ['supervisor', 'stats'],
    () => supervisorService.getDashboardStats(),
    {
      refetchInterval: 60 * 1000, // Refetch every 60 seconds
      staleTime: 30 * 1000, // Consider stale after 30 seconds
    }
  );
}

/**
 * Hook to get pending reviews
 */
export function usePendingReviews(params?: PendingReviewsParams) {
  return useQuery<PaginatedResponse<PendingReviewItem>, Error>(
    ['supervisor', 'pending-reviews', params],
    () => supervisorService.getPendingReviews(params),
    {
      keepPreviousData: true,
    }
  );
}

/**
 * Hook to get recent activity
 */
export function useRecentActivity(limit?: number) {
  return useQuery<RecentActivityItem[], Error>(
    ['supervisor', 'activity', limit],
    () => supervisorService.getRecentActivity(limit),
    {
      staleTime: 30 * 1000, // Consider stale after 30 seconds
    }
  );
}
