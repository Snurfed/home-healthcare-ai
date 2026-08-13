/**
 * Compliance Routes
 *
 * API endpoints for Medicare compliance validation including:
 * - Visit compliance validation
 * - OASIS assessment validation
 * - Billing code suggestions
 * - Homebound status checks
 *
 * All routes require authentication and appropriate role authorization.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// Service imports
import {
  validateVisitCompliance,
  validateHomeboundStatus,
  validateSkilledCareNecessity,
  validateFaceToFaceRequirements,
  validateCertificationPeriod,
} from '../services/compliance/medicareCompliance.service';

import {
  validateOasisAssessment,
} from '../services/compliance/oasisValidation.service';

import {
  generateBillingSuggestions,
  generateAssessmentBillingSuggestions,
} from '../services/compliance/billingCodeSuggestion.service';

import { COMMON_DENIAL_REASONS } from '../types/compliance.types';

// ===========================================
// ROUTER SETUP
// ===========================================

const router = Router();

// ===========================================
// REQUEST VALIDATION SCHEMAS
// ===========================================

const ValidateVisitSchema = z.object({
  includeOasisCheck: z.boolean().optional().default(true),
  includeBillingCheck: z.boolean().optional().default(false),
});

const ValidateAssessmentSchema = z.object({
  validateEditChecks: z.boolean().optional().default(true),
  validateSkipPatterns: z.boolean().optional().default(true),
  validateDateRanges: z.boolean().optional().default(true),
});

const HomeboundCheckSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  assessmentId: z.string().uuid('Invalid assessment ID').optional(),
  visitId: z.string().uuid('Invalid visit ID').optional(),
  includeRecommendations: z.boolean().optional().default(true),
  documentedReasons: z.array(z.string()).optional(),
  visitNotes: z.array(z.string()).optional(),
});

// ===========================================
// ERROR HANDLER WRAPPER
// ===========================================

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ===========================================
// VISIT COMPLIANCE VALIDATION
// ===========================================

/**
 * POST /api/compliance/validate/visit/:visitId
 *
 * Validate Medicare compliance for a specific visit.
 * Checks homebound status, skilled care necessity, F2F requirements,
 * and certification period dates.
 *
 * @param visitId - UUID of the visit to validate
 * @body includeOasisCheck - Whether to include OASIS completeness check
 * @body includeBillingCheck - Whether to include billing code suggestions
 *
 * @returns ValidationResult with compliance score and issues
 */
router.post(
  '/validate/visit/:visitId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    const visitId = req.params['visitId'];

    if (!visitId) {
      res.status(400).json({ success: false, error: 'Visit ID is required' });
      return;
    }

    // Validate request body
    const parseResult = ValidateVisitSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }

    const options = parseResult.data;

    const result = await validateVisitCompliance(visitId, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ===========================================
// OASIS ASSESSMENT VALIDATION
// ===========================================

/**
 * POST /api/compliance/validate/assessment/:assessmentId
 *
 * Validate OASIS assessment with CMS edit checks.
 * Includes cross-field validation, skip pattern checks, and date validation.
 *
 * @param assessmentId - UUID of the OASIS assessment to validate
 * @body validateEditChecks - Whether to run CMS edit checks
 * @body validateSkipPatterns - Whether to validate skip patterns
 * @body validateDateRanges - Whether to validate date ranges
 *
 * @returns OasisValidationResult with edit check results and issues
 */
router.post(
  '/validate/assessment/:assessmentId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    const assessmentId = req.params['assessmentId'];

    if (!assessmentId) {
      res.status(400).json({ success: false, error: 'Assessment ID is required' });
      return;
    }

    // Validate request body
    const parseResult = ValidateAssessmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }

    const options = parseResult.data;

    const result = await validateOasisAssessment(assessmentId, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ===========================================
// BILLING CODE SUGGESTIONS
// ===========================================

/**
 * GET /api/compliance/billing-suggestions/:visitId
 *
 * Get ICD-10 and HCPCS code suggestions based on visit data and OASIS assessment.
 * Includes confidence scores, rationale, and upcoding/downcoding risk flags.
 *
 * @param visitId - UUID of the visit
 *
 * @returns BillingSuggestionResult with diagnosis and procedure code suggestions
 */
router.get(
  '/billing-suggestions/:visitId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST, UserRole.BILLING]),
  asyncHandler(async (req: Request, res: Response) => {
    const visitId = req.params['visitId'];

    if (!visitId) {
      res.status(400).json({ success: false, error: 'Visit ID is required' });
      return;
    }

    const result = await generateBillingSuggestions(visitId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/compliance/billing-suggestions/assessment/:assessmentId
 *
 * Get billing code suggestions based on a full OASIS assessment.
 * Useful for episode-level billing review.
 *
 * @param assessmentId - UUID of the OASIS assessment
 *
 * @returns BillingSuggestionResult with diagnosis and procedure code suggestions
 */
router.get(
  '/billing-suggestions/assessment/:assessmentId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST, UserRole.BILLING]),
  asyncHandler(async (req: Request, res: Response) => {
    const assessmentId = req.params['assessmentId'];

    if (!assessmentId) {
      res.status(400).json({ success: false, error: 'Assessment ID is required' });
      return;
    }

    const result = await generateAssessmentBillingSuggestions(assessmentId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ===========================================
// HOMEBOUND STATUS CHECK
// ===========================================

/**
 * POST /api/compliance/homebound-check
 *
 * Check if a patient's homebound status is adequately documented
 * per Medicare Benefit Policy Manual requirements.
 *
 * @body patientId - UUID of the patient
 * @body assessmentId - Optional UUID of specific assessment
 * @body visitId - Optional UUID of specific visit
 * @body includeRecommendations - Whether to include documentation recommendations
 * @body documentedReasons - Optional list of documented homebound reasons
 * @body visitNotes - Optional visit notes for analysis
 *
 * @returns HomeboundCheckResult with validity, qualifying criteria, and issues
 */
router.post(
  '/homebound-check',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const parseResult = HomeboundCheckSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }

    const input = parseResult.data;

    const result = await validateHomeboundStatus(input);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ===========================================
// ADDITIONAL VALIDATION ENDPOINTS
// ===========================================

/**
 * GET /api/compliance/skilled-care/:episodeId
 *
 * Validate skilled care necessity for an episode.
 *
 * @param episodeId - UUID of the episode
 * @query visitId - Optional specific visit to check
 *
 * @returns SkilledCareValidationResult with service requirements and issues
 */
router.get(
  '/skilled-care/:episodeId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    const episodeId = req.params['episodeId'];
    const visitId = req.query['visitId'] as string | undefined;

    if (!episodeId) {
      res.status(400).json({ success: false, error: 'Episode ID is required' });
      return;
    }

    const result = await validateSkilledCareNecessity(episodeId, visitId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/compliance/face-to-face/:episodeId
 *
 * Validate face-to-face encounter requirements for an episode.
 *
 * @param episodeId - UUID of the episode
 *
 * @returns FaceToFaceRequirement with timing validation and content checklist
 */
router.get(
  '/face-to-face/:episodeId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ success: false, error: 'Episode ID is required' });
      return;
    }

    const result = await validateFaceToFaceRequirements(episodeId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/compliance/certification-period/:episodeId
 *
 * Validate certification period dates and check recertification needs.
 *
 * @param episodeId - UUID of the episode
 *
 * @returns CertificationPeriodValidation with dates, status, and issues
 */
router.get(
  '/certification-period/:episodeId',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE, UserRole.THERAPIST_PT, UserRole.THERAPIST_OT, UserRole.THERAPIST_ST]),
  asyncHandler(async (req: Request, res: Response) => {
    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ success: false, error: 'Episode ID is required' });
      return;
    }

    const result = await validateCertificationPeriod(episodeId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ===========================================
// BATCH VALIDATION ENDPOINT
// ===========================================

/**
 * POST /api/compliance/validate/batch
 *
 * Validate multiple visits or assessments in a single request.
 * Useful for dashboard compliance overview.
 *
 * @body visits - Array of visit IDs to validate
 * @body assessments - Array of assessment IDs to validate
 *
 * @returns Array of validation results
 */
router.post(
  '/validate/batch',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
  asyncHandler(async (req: Request, res: Response) => {
    const { visits = [], assessments = [] } = req.body;

    // Limit batch size
    const maxBatchSize = 20;
    if (visits.length + assessments.length > maxBatchSize) {
      res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum of ${maxBatchSize}`,
      });
      return;
    }

    const results: {
      visits: Array<{ visitId: string; result: Awaited<ReturnType<typeof validateVisitCompliance>> }>;
      assessments: Array<{ assessmentId: string; result: Awaited<ReturnType<typeof validateOasisAssessment>> }>;
    } = {
      visits: [],
      assessments: [],
    };

    // Validate visits
    for (const visitId of visits) {
      try {
        const result = await validateVisitCompliance(visitId, { includeOasisCheck: true });
        results.visits.push({ visitId, result });
      } catch (error) {
        results.visits.push({
          visitId,
          result: {
            valid: false,
            issues: [{
              id: 'error',
              field: 'visitId',
              code: 'VALIDATION_ERROR',
              severity: 'error' as const,
              category: 'documentation' as const,
              message: error instanceof Error ? error.message : 'Unknown error',
              suggestion: 'Check the visit ID and try again',
              source: 'compliance.routes',
            }],
            score: 0,
            summary: { errors: 1, warnings: 0, info: 0 },
            validatedAt: new Date().toISOString(),
            entityType: 'visit' as const,
            entityId: visitId,
          },
        });
      }
    }

    // Validate assessments
    for (const assessmentId of assessments) {
      try {
        const result = await validateOasisAssessment(assessmentId);
        results.assessments.push({ assessmentId, result });
      } catch (error) {
        results.assessments.push({
          assessmentId,
          result: {
            valid: false,
            issues: [{
              id: 'error',
              field: 'assessmentId',
              code: 'VALIDATION_ERROR',
              severity: 'error' as const,
              category: 'oasis_completeness' as const,
              message: error instanceof Error ? error.message : 'Unknown error',
              suggestion: 'Check the assessment ID and try again',
              source: 'compliance.routes',
            }],
            score: 0,
            summary: { errors: 1, warnings: 0, info: 0 },
            validatedAt: new Date().toISOString(),
            entityType: 'assessment' as const,
            entityId: assessmentId,
            oasisDetails: {
              assessmentId,
              assessmentType: 'UNKNOWN',
              completionPercentage: 0,
              sectionsWithIssues: [],
              editChecks: [],
              skipPatternViolations: [],
              dateRangeIssues: [],
            },
          },
        });
      }
    }

    // Calculate summary statistics
    const totalVisits = results.visits.length;
    const totalAssessments = results.assessments.length;
    const validVisits = results.visits.filter((v) => v.result.valid).length;
    const validAssessments = results.assessments.filter((a) => a.result.valid).length;
    const avgVisitScore = totalVisits > 0
      ? results.visits.reduce((sum, v) => sum + v.result.score, 0) / totalVisits
      : 0;
    const avgAssessmentScore = totalAssessments > 0
      ? results.assessments.reduce((sum, a) => sum + a.result.score, 0) / totalAssessments
      : 0;

    res.status(200).json({
      success: true,
      data: {
        results,
        summary: {
          totalVisits,
          totalAssessments,
          validVisits,
          validAssessments,
          averageVisitScore: Math.round(avgVisitScore),
          averageAssessmentScore: Math.round(avgAssessmentScore),
        },
      },
    });
  })
);

// ===========================================
// DENIAL REASONS REFERENCE
// ===========================================

/**
 * GET /api/compliance/denial-reasons
 *
 * Get reference information about common Medicare denial reasons.
 * Useful for training and documentation guidance.
 *
 * @returns Object with denial reason codes, descriptions, and prevention tips
 */
router.get(
  '/denial-reasons',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: COMMON_DENIAL_REASONS,
    });
  })
);

// ===========================================
// EXPORT
// ===========================================

export default router;
