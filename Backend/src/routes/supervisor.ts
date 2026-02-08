/**
 * Supervisor Routes
 *
 * API routes for supervisor dashboard and review management
 */

import { Router } from 'express';
import * as supervisorController from '../controllers/supervisor.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// All supervisor routes require authentication and supervisor/admin role
const supervisorAuth = [
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
];

// ===========================================
// ROUTES
// ===========================================

/**
 * @route   GET /api/supervisor/dashboard/stats
 * @desc    Get dashboard statistics for supervisors
 * @access  Private - Admin and Supervisor only
 */
router.get('/dashboard/stats', ...supervisorAuth, supervisorController.getDashboardStats);

/**
 * @route   GET /api/supervisor/pending-reviews
 * @desc    Get paginated list of assessments pending review
 * @access  Private - Admin and Supervisor only
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   sortBy - Sort field: submittedAt, daysWaiting, priority
 * @query   sortOrder - Sort order: asc, desc
 */
router.get('/pending-reviews', ...supervisorAuth, supervisorController.getPendingReviews);

/**
 * @route   GET /api/supervisor/activity
 * @desc    Get recent review activity feed
 * @access  Private - Admin and Supervisor only
 * @query   limit - Number of items to return (default: 10, max: 50)
 */
router.get('/activity', ...supervisorAuth, supervisorController.getRecentActivity);

export default router;
