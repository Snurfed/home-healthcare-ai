/**
 * Supervisor Controller
 *
 * Handles supervisor dashboard and review management endpoints
 */

import { Response, NextFunction } from 'express';
import { UserRole, AuditAction } from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import supervisorService, {
  PendingReviewsInput,
} from '../services/supervisor.service';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface PendingReviewsQuery {
  page?: string;
  limit?: string;
  sortBy?: 'submittedAt' | 'daysWaiting' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface RecentActivityQuery {
  limit?: string;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create audit log for supervisor actions
 */
async function createSupervisorAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  success: boolean,
  req: AuthenticatedRequest,
  options: {
    description?: string;
    errorMessage?: string;
  } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        action,
        resourceType: 'supervisor_dashboard',
        resourceId,
        description: options.description,
        phiAccessed: true,
        phiFields: ['assessment_data', 'patient_info'],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[Supervisor Audit Log Error]', error);
  }
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Get dashboard statistics
 * GET /api/supervisor/dashboard/stats
 */
export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Only supervisors and admins can access
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Supervisor access required',
      });
    }

    const stats = await supervisorService.getDashboardStats();

    // Audit log
    await createSupervisorAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'dashboard-stats',
      true,
      req,
      { description: 'Viewed supervisor dashboard statistics' }
    );

    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}

/**
 * Get pending reviews list
 * GET /api/supervisor/pending-reviews
 */
export async function getPendingReviews(
  req: AuthenticatedRequest & { query: PendingReviewsQuery },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Only supervisors and admins can access
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Supervisor access required',
      });
    }

    const { page, limit, sortBy, sortOrder } = req.query;

    const input: PendingReviewsInput = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy: sortBy as PendingReviewsInput['sortBy'],
      sortOrder: sortOrder as PendingReviewsInput['sortOrder'],
    };

    const result = await supervisorService.getPendingReviews(input);

    // Audit log
    await createSupervisorAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'pending-reviews',
      true,
      req,
      { description: `Viewed ${result.reviews.length} pending reviews (page ${result.page})` }
    );

    return res.status(200).json({
      data: result.reviews,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get recent review activity
 * GET /api/supervisor/activity
 */
export async function getRecentActivity(
  req: AuthenticatedRequest & { query: RecentActivityQuery },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Only supervisors and admins can access
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Supervisor access required',
      });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const activity = await supervisorService.getRecentActivity(Math.min(limit, 50));

    // Audit log
    await createSupervisorAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'activity-feed',
      true,
      req,
      { description: `Viewed ${activity.length} recent activity items` }
    );

    return res.status(200).json({
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  getDashboardStats,
  getPendingReviews,
  getRecentActivity,
};
