/**
 * EMR Sync Routes
 *
 * API routes for syncing visit and assessment data to EMR systems.
 * Implements write-back capabilities for FHIR-compliant EMRs.
 *
 * HIPAA Compliance:
 * - All endpoints require authentication
 * - All operations are logged for audit trail
 * - Role-based access control for sync operations
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { withTenant } from '../config/tenancy';
import { UserRole } from '../generated/prisma';
import { EmrSyncService } from '../services/emr/emrSync.service';
import { PointCareAdapterService } from '../services/emr/pointcareAdapter.service';
import prisma from '../config/prisma';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Prisma model accessor (for models not yet in generated client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// ===========================================
// HELPER TYPES
// ===========================================

/**
 * The agency this request runs under.
 *
 * This module declared its own AuthenticatedRequest, a narrower copy of the
 * middleware's that omitted agencyId — so the tenant was not merely unused
 * here, it was not visible. The real type is imported instead.
 */
function tenantOf(req: AuthenticatedRequest, res: Response): string | null {
  const agencyId = req.user?.agencyId;
  if (!agencyId) {
    res.status(403).json({
      success: false,
      error: 'Your account is not assigned to an agency, so EMR sync is unavailable.',
      code: 'NO_AGENCY',
    });
    return null;
  }
  return agencyId;
}

// ===========================================
// VISIT SYNC ENDPOINTS
// ===========================================

/**
 * POST /api/emr-sync/visit/:visitId
 *
 * Sync a visit to the EMR system.
 * Creates FHIR resources for vitals, notes, and procedures.
 */
router.post(
  '/visit/:visitId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visitId = req.params['visitId'] as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const agencyId = tenantOf(req, res);
      if (!agencyId) return;

      return await withTenant(prisma, agencyId, async (tx) => {
      // Get visit and verify access
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        include: {
          patient: {
            include: {
              emrLink: true,
            },
          },
        },
      });

      if (!visit) {
        res.status(404).json({
          success: false,
          error: 'Visit not found',
        });
        return;
      }

      // Verify patient is linked to EMR
      if (!visit.patient.emrLink) {
        res.status(400).json({
          success: false,
          error: 'Patient is not linked to an EMR. Please import the patient first.',
        });
        return;
      }

      // Get connection ID
      const connectionId = visit.patient.emrLink.connectionId;

      // Extract sync options from request body
      const {
        includeVitals = true,
        includeNotes = true,
        includeProcedures = true,
        useTransaction = true,
      } = req.body;

      // Check if this is a PointCare connection
      const isPointCare = await PointCareAdapterService.isPointCareConnection(connectionId);

      if (isPointCare) {
        // Use PointCare adapter for PointCare-specific handling
        const result = await PointCareAdapterService.syncVisit(
          connectionId,
          userId!, // Already checked above
          {
            patientId: visit.patient.emrLink.fhirPatientId,
            visitDate: (visit.actualStartTime || visit.scheduledDate).toISOString(),
            visitType: visit.visitType,
            clinicianId: visit.clinicianId,
            notes: visit.visitNotes || undefined,
            vitalSigns: visit.vitalSigns as Record<string, unknown> || undefined,
          }
        );

        res.status(result.success ? 200 : 500).json({
          success: result.success,
          syncId: result.resourceId,
          error: result.error,
        });
        return;
      }

      // Use standard EMR sync service
      const result = await EmrSyncService.syncVisit(tx, {
        visitId,
        patientFhirId: visit.patient.emrLink.fhirPatientId,
        connectionId,
        userId: userId!, // Already checked above
        includeVitals,
        includeNotes,
        includeProcedures,
      }, {
        useTransaction,
      });

      const statusCode = result.success ? 200 : (result.errors.some(e => e.retryable) ? 503 : 400);

      res.status(statusCode).json({
        success: result.success,
        syncId: result.syncId,
        status: result.status,
        resourcesCreated: result.resourcesCreated,
        resourcesUpdated: result.resourcesUpdated,
        errors: result.errors,
        warnings: result.warnings,
        completedAt: result.completedAt,
      });
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// ASSESSMENT SYNC ENDPOINTS
// ===========================================

/**
 * POST /api/emr-sync/assessment/:assessmentId
 *
 * Sync an OASIS assessment to the EMR system.
 * Creates FHIR Observations for assessment responses and Conditions for diagnoses.
 */
router.post(
  '/assessment/:assessmentId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessmentId = req.params['assessmentId'] as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const agencyId = tenantOf(req, res);
      if (!agencyId) return;

      return await withTenant(prisma, agencyId, async (tx) => {
      // Get assessment and verify access
      const assessment = await tx.oasisAssessment.findUnique({
        where: { id: assessmentId },
        include: {
          patient: {
            include: {
              emrLink: true,
            },
          },
          responses: true,
        },
      });

      if (!assessment) {
        res.status(404).json({
          success: false,
          error: 'Assessment not found',
        });
        return;
      }

      // Verify patient is linked to EMR
      if (!assessment.patient.emrLink) {
        res.status(400).json({
          success: false,
          error: 'Patient is not linked to an EMR. Please import the patient first.',
        });
        return;
      }

      // Get connection ID
      const connectionId = assessment.patient.emrLink.connectionId;

      // Extract sync options from request body
      const {
        includeAllResponses = true,
        includeConditions = true,
        useTransaction = true,
      } = req.body;

      // Check if this is a PointCare connection
      const isPointCare = await PointCareAdapterService.isPointCareConnection(connectionId);

      if (isPointCare) {
        // Use PointCare adapter for PointCare-specific handling
        const result = await PointCareAdapterService.syncOasisAssessment(
          connectionId,
          userId!, // Already checked above
          {
            patientId: assessment.patient.emrLink.fhirPatientId,
            assessmentDate: (assessment.m0090_completionDate || new Date()).toISOString(),
            assessmentType: assessment.assessmentType,
            clinicianId: assessment.clinicianId,
            responses: assessment.responses.map(r => ({
              itemCode: r.itemCode,
              value: r.responseValue || r.responseText || '',
              valueCode: r.responseCode || undefined,
            })),
          }
        );

        res.status(result.success ? 200 : 500).json({
          success: result.success,
          syncId: result.resourceId,
          error: result.error,
        });
        return;
      }

      // Use standard EMR sync service
      const result = await EmrSyncService.syncAssessment(tx, {
        assessmentId,
        patientFhirId: assessment.patient.emrLink.fhirPatientId,
        connectionId,
        userId: userId!, // Already checked above
        includeAllResponses,
        includeConditions,
      }, {
        useTransaction,
      });

      const statusCode = result.success ? 200 : (result.errors.some(e => e.retryable) ? 503 : 400);

      res.status(statusCode).json({
        success: result.success,
        syncId: result.syncId,
        status: result.status,
        resourcesCreated: result.resourcesCreated,
        resourcesUpdated: result.resourcesUpdated,
        errors: result.errors,
        warnings: result.warnings,
        completedAt: result.completedAt,
      });
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// STATUS ENDPOINTS
// ===========================================

/**
 * GET /api/emr-sync/status/:syncId
 *
 * Get the status of a sync job.
 */
router.get(
  '/status/:syncId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const syncId = req.params['syncId'] as string;

      const agencyId = tenantOf(req, res);
      if (!agencyId) return;

      return await withTenant(prisma, agencyId, async (tx) => {
      const status = await EmrSyncService.getSyncStatus(tx, syncId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Sync job not found',
        });
        return;
      }

      res.json({
        success: true,
        data: status,
      });
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/emr-sync/retry/:syncId
 *
 * Retry a failed sync job.
 */
router.post(
  '/retry/:syncId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const syncId = req.params['syncId'] as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const agencyId = tenantOf(req, res);
      if (!agencyId) return;

      return await withTenant(prisma, agencyId, async (tx) => {
      const result = await EmrSyncService.retrySyncJob(tx, syncId, userId);

      const statusCode = result.success ? 200 : (result.errors.some(e => e.retryable) ? 503 : 400);

      res.status(statusCode).json({
        success: result.success,
        syncId: result.syncId,
        status: result.status,
        resourcesCreated: result.resourcesCreated,
        resourcesUpdated: result.resourcesUpdated,
        errors: result.errors,
        warnings: result.warnings,
        completedAt: result.completedAt,
      });
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// HISTORY ENDPOINTS
// ===========================================

/**
 * GET /api/emr-sync/history
 *
 * Get sync job history with optional filters.
 */
router.get(
  '/history',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        type,
        patientId,
        limit = '50',
        offset = '0',
      } = req.query;

      // Build filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (status && typeof status === 'string') {
        where['status'] = status;
      }

      if (type && typeof type === 'string') {
        where['type'] = type;
      }

      if (patientId && typeof patientId === 'string') {
        // Need to look up via visit or assessment
        where['OR'] = [
          { visit: { patientId } },
          { assessment: { patientId } },
        ];
      }

      // Use prismaAny for new models not yet in generated client
      if (!prismaAny.emrSyncJob) {
        res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10),
          },
          message: 'EMR sync jobs table not yet available. Run prisma generate after schema update.',
        });
        return;
      }

      const [jobs, total] = await Promise.all([
        prismaAny.emrSyncJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(parseInt(limit as string, 10), 100),
          skip: parseInt(offset as string, 10),
          include: {
            visit: {
              select: {
                id: true,
                visitType: true,
                scheduledDate: true,
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            assessment: {
              select: {
                id: true,
                assessmentType: true,
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        }),
        prismaAny.emrSyncJob.count({ where }),
      ]);

      res.json({
        success: true,
        data: jobs,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// FIELD MAPPING ENDPOINTS
// ===========================================

/**
 * GET /api/emr-sync/mappings/:agencyId
 *
 * Get EMR field mappings for an agency.
 */
router.get(
  '/mappings/:agencyId',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agencyId = req.params['agencyId'] as string;

      // Use prismaAny for new models not yet in generated client
      if (!prismaAny.emrFieldMapping) {
        res.json({
          success: true,
          data: [],
          message: 'EMR field mappings table not yet available. Run prisma generate after schema update.',
        });
        return;
      }

      const mappings = await prismaAny.emrFieldMapping.findMany({
        where: { agencyId },
        orderBy: { internalField: 'asc' },
      });

      res.json({
        success: true,
        data: mappings,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/emr-sync/mappings/:agencyId
 *
 * Create or update an EMR field mapping.
 */
router.post(
  '/mappings/:agencyId',
  authorize([UserRole.ADMIN]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agencyId = req.params['agencyId'] as string;
      const { internalField, emrField, template, active = true } = req.body;

      if (!internalField || !emrField) {
        res.status(400).json({
          success: false,
          error: 'Both internalField and emrField are required',
        });
        return;
      }

      // Use prismaAny for new models not yet in generated client
      if (!prismaAny.emrFieldMapping) {
        res.status(503).json({
          success: false,
          error: 'EMR field mappings table not yet available. Run prisma generate after schema update.',
        });
        return;
      }

      // Upsert the mapping
      const mapping = await prismaAny.emrFieldMapping.upsert({
        where: {
          agencyId_internalField: {
            agencyId,
            internalField,
          },
        },
        update: {
          emrField,
          template,
          active,
          updatedAt: new Date(),
        },
        create: {
          agencyId,
          internalField,
          emrField,
          template,
          active,
        },
      });

      res.status(201).json({
        success: true,
        data: mapping,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/emr-sync/mappings/:agencyId/:mappingId
 *
 * Delete an EMR field mapping.
 */
router.delete(
  '/mappings/:agencyId/:mappingId',
  authorize([UserRole.ADMIN]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mappingId = req.params['mappingId'] as string;

      // Use prismaAny for new models not yet in generated client
      if (!prismaAny.emrFieldMapping) {
        res.status(503).json({
          success: false,
          error: 'EMR field mappings table not yet available. Run prisma generate after schema update.',
        });
        return;
      }

      await prismaAny.emrFieldMapping.delete({
        where: { id: mappingId },
      });

      res.json({
        success: true,
        message: 'Mapping deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// POINTCARE-SPECIFIC ENDPOINTS
// ===========================================

/**
 * GET /api/emr-sync/pointcare/:connectionId/health
 *
 * Check PointCare connection health.
 */
router.get(
  '/pointcare/:connectionId/health',
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const connectionId = req.params['connectionId'] as string;

      const isPointCare = await PointCareAdapterService.isPointCareConnection(connectionId);

      if (!isPointCare) {
        res.status(400).json({
          success: false,
          error: 'Connection is not a PointCare connection',
        });
        return;
      }

      const agencyId = tenantOf(req, res);
      if (!agencyId) return;

      const health = await withTenant(prisma, agencyId, async (tx) =>
        PointCareAdapterService.checkConnection(tx, connectionId as string)
      );

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
