/**
 * Supervisor Service
 *
 * Business logic for supervisor dashboard and review operations
 */

import { AssessmentStatus, Prisma } from '../generated/prisma';
import prisma from '../config/prisma';

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
  submittedAt: Date;
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  completionPercentage: number;
  daysWaiting: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PendingReviewsResult {
  reviews: PendingReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RecentActivityItem {
  id: string;
  action: 'approved' | 'rejected';
  assessmentId: string;
  assessmentType: string;
  patientName: string;
  clinicianName: string;
  reviewerName: string;
  reviewedAt: Date;
  notes: string | null;
}

export interface PendingReviewsInput {
  page?: number;
  limit?: number;
  sortBy?: 'submittedAt' | 'daysWaiting' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate priority based on days waiting
 */
function calculatePriority(daysWaiting: number): 'high' | 'medium' | 'low' {
  if (daysWaiting >= 3) return 'high';
  if (daysWaiting >= 1) return 'medium';
  return 'low';
}

/**
 * Get start of today in UTC
 */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Get start of this week (Sunday) in UTC
 */
function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
}

// ===========================================
// SERVICE FUNCTIONS
// ===========================================

/**
 * Get dashboard statistics for supervisor
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfToday = getStartOfToday();
  const startOfWeek = getStartOfWeek();

  // Run all queries in parallel
  const [
    pendingReviewCount,
    approvalsToday,
    rejectionsToday,
    totalAssessmentsThisWeek,
    clinicianCount,
    reviewTimeData,
  ] = await Promise.all([
    // Count of pending reviews
    prisma.oasisAssessment.count({
      where: {
        status: AssessmentStatus.PENDING_REVIEW,
        deletedAt: null,
      },
    }),

    // Approvals today
    prisma.oasisAssessment.count({
      where: {
        status: AssessmentStatus.APPROVED,
        approvedAt: { gte: startOfToday },
        deletedAt: null,
      },
    }),

    // Rejections (needs correction) today
    prisma.oasisAssessment.count({
      where: {
        status: AssessmentStatus.NEEDS_CORRECTION,
        reviewedAt: { gte: startOfToday },
        deletedAt: null,
      },
    }),

    // Total assessments submitted this week
    prisma.oasisAssessment.count({
      where: {
        submittedAt: { gte: startOfWeek },
        deletedAt: null,
      },
    }),

    // Count of active clinicians
    prisma.user.count({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        role: {
          in: ['NURSE', 'THERAPIST_PT', 'THERAPIST_OT', 'THERAPIST_ST', 'MEDICAL_SOCIAL_WORKER'],
        },
      },
    }),

    // Average review time - get recently reviewed assessments
    prisma.oasisAssessment.findMany({
      where: {
        reviewedAt: { not: null },
        submittedAt: { not: null },
        deletedAt: null,
      },
      select: {
        submittedAt: true,
        reviewedAt: true,
      },
      take: 100,
      orderBy: { reviewedAt: 'desc' },
    }),
  ]);

  // Calculate average review time in hours
  let averageReviewTimeHours = 0;
  if (reviewTimeData.length > 0) {
    const totalHours = reviewTimeData.reduce((sum, assessment) => {
      if (assessment.submittedAt && assessment.reviewedAt) {
        const diffMs = assessment.reviewedAt.getTime() - assessment.submittedAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }
      return sum;
    }, 0);
    averageReviewTimeHours = Math.round((totalHours / reviewTimeData.length) * 10) / 10;
  }

  return {
    pendingReviewCount,
    approvalsToday,
    rejectionsToday,
    averageReviewTimeHours,
    totalAssessmentsThisWeek,
    clinicianCount,
  };
}

/**
 * Get paginated list of pending reviews
 */
export async function getPendingReviews(
  input: PendingReviewsInput
): Promise<PendingReviewsResult> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'submittedAt',
    sortOrder = 'asc',
  } = input;

  const skip = (page - 1) * limit;

  // Build order by clause
  const orderBy: Prisma.OasisAssessmentOrderByWithRelationInput = {};
  if (sortBy === 'submittedAt') {
    orderBy.submittedAt = sortOrder;
  } else if (sortBy === 'daysWaiting') {
    // Days waiting = earliest submitted first = asc on submittedAt
    orderBy.submittedAt = sortOrder === 'asc' ? 'asc' : 'desc';
  } else {
    orderBy.submittedAt = 'asc';
  }

  const [assessments, total] = await Promise.all([
    prisma.oasisAssessment.findMany({
      where: {
        status: AssessmentStatus.PENDING_REVIEW,
        deletedAt: null,
      },
      orderBy,
      skip,
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        clinician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.oasisAssessment.count({
      where: {
        status: AssessmentStatus.PENDING_REVIEW,
        deletedAt: null,
      },
    }),
  ]);

  const now = new Date();

  const reviews: PendingReviewItem[] = assessments.map((assessment) => {
    const daysWaiting = assessment.submittedAt
      ? Math.floor((now.getTime() - assessment.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      id: assessment.id,
      patientId: assessment.patientId,
      patientName: `${assessment.patient.lastName}, ${assessment.patient.firstName}`,
      patientMrn: assessment.patient.mrn,
      assessmentType: assessment.assessmentType,
      submittedAt: assessment.submittedAt!,
      submittedBy: {
        id: assessment.clinician.id,
        firstName: assessment.clinician.firstName,
        lastName: assessment.clinician.lastName,
      },
      completionPercentage: assessment.completionPercentage,
      daysWaiting,
      priority: calculatePriority(daysWaiting),
    };
  });

  // Sort by priority if requested
  if (sortBy === 'priority') {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    reviews.sort((a, b) => {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return sortOrder === 'asc' ? diff : -diff;
    });
  }

  return {
    reviews,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get recent review activity
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
  const recentReviews = await prisma.oasisAssessment.findMany({
    where: {
      reviewedAt: { not: null },
      status: {
        in: [AssessmentStatus.APPROVED, AssessmentStatus.NEEDS_CORRECTION],
      },
      deletedAt: null,
    },
    orderBy: { reviewedAt: 'desc' },
    take: limit,
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      clinician: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      reviewer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return recentReviews.map((assessment) => ({
    id: assessment.id,
    action: assessment.status === AssessmentStatus.APPROVED ? 'approved' : 'rejected',
    assessmentId: assessment.id,
    assessmentType: assessment.assessmentType,
    patientName: `${assessment.patient.lastName}, ${assessment.patient.firstName}`,
    clinicianName: `${assessment.clinician.firstName} ${assessment.clinician.lastName}`,
    reviewerName: assessment.reviewer
      ? `${assessment.reviewer.firstName} ${assessment.reviewer.lastName}`
      : 'Unknown',
    reviewedAt: assessment.reviewedAt!,
    notes: assessment.reviewNotes,
  }));
}

export default {
  getDashboardStats,
  getPendingReviews,
  getRecentActivity,
};
