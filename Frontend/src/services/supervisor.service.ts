/**
 * Supervisor Service
 *
 * API calls for supervisor dashboard and review management
 */

import apiClient from './api/client';
import type { PaginatedResponse } from '@typedefs/api.types';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface DashboardStats {
  pendingReviewCount: number;
  approvalsToday: number;
  rejectionsToday: number;
  averageReviewTimeHours: number;
  totalAssessmentsThisWeek: number;
  clinicianCount: number;
}

export interface PendingReviewItem {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  assessmentType: string;
  submittedAt: string;
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  completionPercentage: number;
  daysWaiting: number;
  priority: 'high' | 'medium' | 'low';
}

export interface RecentActivityItem {
  id: string;
  action: 'approved' | 'rejected';
  assessmentId: string;
  assessmentType: string;
  patientName: string;
  clinicianName: string;
  reviewerName: string;
  reviewedAt: string;
  notes: string | null;
}

export interface PendingReviewsParams {
  page?: number;
  limit?: number;
  sortBy?: 'submittedAt' | 'daysWaiting' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/supervisor/dashboard/stats');
  return response.data;
}

/**
 * Get pending reviews list
 */
export async function getPendingReviews(
  params?: PendingReviewsParams
): Promise<PaginatedResponse<PendingReviewItem>> {
  const response = await apiClient.get<PaginatedResponse<PendingReviewItem>>(
    '/supervisor/pending-reviews',
    { params }
  );
  return response.data;
}

/**
 * Get recent activity feed
 */
export async function getRecentActivity(limit?: number): Promise<RecentActivityItem[]> {
  const response = await apiClient.get<{ data: RecentActivityItem[] }>(
    '/supervisor/activity',
    { params: { limit } }
  );
  return response.data.data;
}

export default {
  getDashboardStats,
  getPendingReviews,
  getRecentActivity,
};
