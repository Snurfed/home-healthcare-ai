/**
 * SOAP Notes Controller
 *
 * Handles CRUD operations for SOAP notes tied to OASIS assessments.
 */

import { Response, NextFunction } from 'express';
import {
  UserRole,
  SoapNoteStatus,
  AuditAction,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { generateSoapNote, validateSoapNote } from '../services/soapNoteGeneration.service';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CreateSoapNoteRequest extends AuthenticatedRequest {
  params: { assessmentId: string };
  body: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    generateFromAssessment?: boolean;
  };
}

export interface UpdateSoapNoteRequest extends AuthenticatedRequest {
  params: { id: string };
  body: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
}

export interface UpdateStatusRequest extends AuthenticatedRequest {
  params: { id: string };
  body: {
    status: SoapNoteStatus;
    reviewNotes?: string;
    amendmentReason?: string;
  };
}

export interface ListSoapNotesQuery {
  page?: string;
  limit?: string;
  status?: SoapNoteStatus;
  startDate?: string;
  endDate?: string;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create audit log for SOAP note operations
 */
async function createSoapNoteAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  _patientId: string | null,
  success: boolean,
  req: AuthenticatedRequest,
  options: {
    description?: string;
    previousValues?: object;
    newValues?: object;
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
        resourceType: 'soap_note',
        resourceId,
        description: options.description,
        previousValues: options.previousValues ? JSON.parse(JSON.stringify(options.previousValues)) : null,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : null,
        phiAccessed: true,
        phiFields: ['soap_content', 'patient_data'],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[SOAP Note Audit Log Error]', error);
  }
}

/**
 * Check if user has access to patient's SOAP notes
 */
async function checkPatientAccess(
  userId: string,
  userRole: UserRole,
  patientId: string
): Promise<boolean> {
  if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERVISOR) {
    return true;
  }

  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      patientId,
      userId,
      endDate: null,
    },
  });

  return !!assignment;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Create a new SOAP note for an assessment
 * POST /api/assessments/:assessmentId/soap-notes
 */
export async function createSoapNote(
  req: CreateSoapNoteRequest,
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

    const assessmentId = req.params['assessmentId'];
    const {
      subjective,
      objective,
      assessment: assessmentContent,
      plan,
      generateFromAssessment = false,
    } = req.body;

    // Validate assessment exists
    const oasisAssessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        responses: true,
      },
    });

    if (!oasisAssessment || oasisAssessment.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, oasisAssessment.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create SOAP notes for this patient',
      });
    }

    // Check if SOAP note already exists for this assessment
    const existingNote = await prisma.soapNote.findFirst({
      where: {
        assessmentId,
        deletedAt: null,
      },
    });

    if (existingNote) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A SOAP note already exists for this assessment',
        existingSoapNoteId: existingNote.id,
      });
    }

    let soapContent = {
      subjective: subjective || '',
      objective: objective || '',
      assessment: assessmentContent || '',
      plan: plan || '',
    };

    let aiModelUsed: string | null = null;

    // Generate from assessment if requested
    if (generateFromAssessment) {
      const generationResult = await generateSoapNote({
        assessmentId,
        patientId: oasisAssessment.patientId,
        assessmentData: oasisAssessment.responses as unknown as Record<string, unknown>,
      });

      if (generationResult.success) {
        soapContent = generationResult.content;
        aiModelUsed = generationResult.aiModelUsed || null;
      }
    }

    // Create SOAP note
    const soapNote = await prisma.soapNote.create({
      data: {
        assessmentId,
        patientId: oasisAssessment.patientId,
        subjective: soapContent.subjective,
        objective: soapContent.objective,
        assessmentContent: soapContent.assessment,
        plan: soapContent.plan,
        status: SoapNoteStatus.DRAFT,
        generatedById: req.user.id,
        aiModelUsed,
        version: 1,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        assessment: {
          select: { id: true, assessmentType: true, status: true },
        },
        generatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.CREATE,
      req.user.id,
      req.user.email,
      req.user.role,
      soapNote.id,
      oasisAssessment.patientId,
      true,
      req,
      {
        description: `Created SOAP note for patient ${oasisAssessment.patient.lastName}, ${oasisAssessment.patient.firstName}`,
        newValues: {
          assessmentId,
          status: soapNote.status,
          aiGenerated: !!aiModelUsed,
        },
      }
    );

    return res.status(201).json({
      message: 'SOAP note created successfully',
      soapNote: {
        id: soapNote.id,
        assessmentId: soapNote.assessmentId,
        patientId: soapNote.patientId,
        subjective: soapNote.subjective,
        objective: soapNote.objective,
        assessmentContent: soapNote.assessmentContent,
        plan: soapNote.plan,
        status: soapNote.status,
        version: soapNote.version,
        aiModelUsed: soapNote.aiModelUsed,
        patient: soapNote.patient,
        oasisAssessment: soapNote.assessment,
        generatedBy: soapNote.generatedBy,
        generatedAt: soapNote.generatedAt,
        createdAt: soapNote.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get SOAP note for an assessment
 * GET /api/assessments/:assessmentId/soap-notes
 */
export async function getSoapNoteByAssessment(
  req: AuthenticatedRequest & { params: { assessmentId: string } },
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

    const assessmentId = req.params['assessmentId'];

    // Validate assessment exists
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, patientId: true, deletedAt: true },
    });

    if (!assessment || assessment.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, assessment.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view SOAP notes for this patient',
      });
    }

    const soapNote = await prisma.soapNote.findFirst({
      where: {
        assessmentId,
        deletedAt: null,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        assessment: {
          select: { id: true, assessmentType: true, status: true },
        },
        generatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        finalizedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!soapNote) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No SOAP note found for this assessment',
      });
    }

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      soapNote.id,
      assessment.patientId,
      true,
      req,
      {
        description: `Viewed SOAP note for assessment ${assessmentId}`,
      }
    );

    return res.status(200).json({
      id: soapNote.id,
      assessmentId: soapNote.assessmentId,
      patientId: soapNote.patientId,
      subjective: soapNote.subjective,
      objective: soapNote.objective,
      assessment: soapNote.assessmentContent,
      plan: soapNote.plan,
      status: soapNote.status,
      version: soapNote.version,
      aiModelUsed: soapNote.aiModelUsed,
      reviewNotes: soapNote.reviewNotes,
      amendmentReason: soapNote.amendmentReason,
      patient: soapNote.patient,
      generatedBy: soapNote.generatedBy,
      generatedAt: soapNote.generatedAt,
      reviewedBy: soapNote.reviewedBy,
      reviewedAt: soapNote.reviewedAt,
      finalizedBy: soapNote.finalizedBy,
      finalizedAt: soapNote.finalizedAt,
      createdAt: soapNote.createdAt,
      updatedAt: soapNote.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update/edit SOAP note sections
 * PATCH /api/soap-notes/:id
 */
export async function updateSoapNote(
  req: UpdateSoapNoteRequest,
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

    const { id } = req.params;
    const body = req.body;

    const soapNote = await prisma.soapNote.findUnique({
      where: { id },
    });

    if (!soapNote || soapNote.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SOAP note not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, soapNote.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this SOAP note',
      });
    }

    // Cannot edit finalized notes (must create amendment)
    if (soapNote.status === SoapNoteStatus.FINALIZED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot edit a finalized SOAP note. Create an amendment instead.',
      });
    }

    // Build update data
    const updateData: Prisma.SoapNoteUpdateInput = {};

    if (body.subjective !== undefined) updateData.subjective = body.subjective;
    if (body.objective !== undefined) updateData.objective = body.objective;
    if (body.assessment !== undefined) updateData.assessmentContent = body.assessment;
    if (body.plan !== undefined) updateData.plan = body.plan;

    const updatedNote = await prisma.soapNote.update({
      where: { id },
      data: updateData,
    });

    // Validate completeness
    const validation = await validateSoapNote({
      subjective: updatedNote.subjective || '',
      objective: updatedNote.objective || '',
      assessment: updatedNote.assessmentContent || '',
      plan: updatedNote.plan || '',
    });

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      soapNote.patientId,
      true,
      req,
      {
        description: `Updated SOAP note sections`,
        previousValues: {
          subjective: soapNote.subjective?.substring(0, 100),
          objective: soapNote.objective?.substring(0, 100),
        },
        newValues: {
          subjective: updatedNote.subjective?.substring(0, 100),
          objective: updatedNote.objective?.substring(0, 100),
        },
      }
    );

    return res.status(200).json({
      message: 'SOAP note updated successfully',
      soapNote: {
        id: updatedNote.id,
        subjective: updatedNote.subjective,
        objective: updatedNote.objective,
        assessment: updatedNote.assessmentContent,
        plan: updatedNote.plan,
        status: updatedNote.status,
        version: updatedNote.version,
        updatedAt: updatedNote.updatedAt,
      },
      validation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change SOAP note status (draft -> reviewed -> finalized)
 * PATCH /api/soap-notes/:id/status
 */
export async function updateSoapNoteStatus(
  req: UpdateStatusRequest,
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

    const { id } = req.params;
    const { status, reviewNotes, amendmentReason } = req.body;

    const soapNote = await prisma.soapNote.findUnique({
      where: { id },
    });

    if (!soapNote || soapNote.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SOAP note not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, soapNote.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this SOAP note',
      });
    }

    // Validate status transitions
    const validTransitions: Record<SoapNoteStatus, SoapNoteStatus[]> = {
      [SoapNoteStatus.DRAFT]: [SoapNoteStatus.REVIEWED],
      [SoapNoteStatus.REVIEWED]: [SoapNoteStatus.DRAFT, SoapNoteStatus.FINALIZED],
      [SoapNoteStatus.FINALIZED]: [SoapNoteStatus.AMENDED],
      [SoapNoteStatus.AMENDED]: [],
    };

    if (!validTransitions[soapNote.status].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot transition from ${soapNote.status} to ${status}`,
        validTransitions: validTransitions[soapNote.status],
      });
    }

    // Only supervisors/admins can finalize
    if (status === SoapNoteStatus.FINALIZED) {
      if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPERVISOR) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only supervisors can finalize SOAP notes',
        });
      }
    }

    // Require amendment reason for amending
    if (status === SoapNoteStatus.AMENDED && !amendmentReason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Amendment reason is required when amending a finalized note',
      });
    }

    // Build update data
    const updateData: Prisma.SoapNoteUpdateInput = {
      status,
    };

    if (status === SoapNoteStatus.REVIEWED) {
      updateData.reviewedBy = { connect: { id: req.user.id } };
      updateData.reviewedAt = new Date();
      if (reviewNotes) updateData.reviewNotes = reviewNotes;
    }

    if (status === SoapNoteStatus.FINALIZED) {
      updateData.finalizedBy = { connect: { id: req.user.id } };
      updateData.finalizedAt = new Date();
    }

    if (status === SoapNoteStatus.AMENDED) {
      updateData.amendmentReason = amendmentReason;
      updateData.version = soapNote.version + 1;
    }

    const updatedNote = await prisma.soapNote.update({
      where: { id },
      data: updateData,
      include: {
        generatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        finalizedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      soapNote.patientId,
      true,
      req,
      {
        description: `Changed SOAP note status from ${soapNote.status} to ${status}`,
        previousValues: { status: soapNote.status },
        newValues: { status: updatedNote.status },
      }
    );

    return res.status(200).json({
      message: `SOAP note ${status.toLowerCase()} successfully`,
      soapNote: {
        id: updatedNote.id,
        status: updatedNote.status,
        version: updatedNote.version,
        reviewNotes: updatedNote.reviewNotes,
        amendmentReason: updatedNote.amendmentReason,
        generatedBy: updatedNote.generatedBy,
        reviewedBy: updatedNote.reviewedBy,
        reviewedAt: updatedNote.reviewedAt,
        finalizedBy: updatedNote.finalizedBy,
        finalizedAt: updatedNote.finalizedAt,
        updatedAt: updatedNote.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all SOAP notes for a patient
 * GET /api/patients/:patientId/soap-notes
 */
export async function listSoapNotesByPatient(
  req: AuthenticatedRequest & { params: { patientId: string }; query: ListSoapNotesQuery },
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

    const patientId = req.params['patientId'];
    const {
      page = '1',
      limit = '20',
      status,
      startDate,
      endDate,
    } = req.query;

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, deletedAt: true },
    });

    if (!patient || patient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view SOAP notes for this patient',
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.SoapNoteWhereInput = {
      patientId,
      deletedAt: null,
    };

    if (status) where.status = status;

    if (startDate || endDate) {
      where.generatedAt = {};
      if (startDate) where.generatedAt.gte = new Date(startDate);
      if (endDate) where.generatedAt.lte = new Date(endDate);
    }

    const [soapNotes, total] = await Promise.all([
      prisma.soapNote.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          assessmentId: true,
          patientId: true,
          status: true,
          version: true,
          generatedAt: true,
          reviewedAt: true,
          finalizedAt: true,
          createdAt: true,
          assessment: {
            select: { id: true, assessmentType: true, status: true },
          },
          generatedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          finalizedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.soapNote.count({ where }),
    ]);

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      patientId,
      true,
      req,
      {
        description: `Listed ${soapNotes.length} SOAP notes for patient`,
      }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: soapNotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single SOAP note by ID
 * GET /api/soap-notes/:id
 */
export async function getSoapNote(
  req: AuthenticatedRequest & { params: { id: string } },
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

    const { id } = req.params;

    const soapNote = await prisma.soapNote.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        assessment: {
          select: { id: true, assessmentType: true, status: true },
        },
        generatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        finalizedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!soapNote || soapNote.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'SOAP note not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, soapNote.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view this SOAP note',
      });
    }

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      soapNote.patientId,
      true,
      req,
      {
        description: `Viewed SOAP note`,
      }
    );

    return res.status(200).json({
      id: soapNote.id,
      assessmentId: soapNote.assessmentId,
      patientId: soapNote.patientId,
      subjective: soapNote.subjective,
      objective: soapNote.objective,
      assessment: soapNote.assessmentContent,
      plan: soapNote.plan,
      status: soapNote.status,
      version: soapNote.version,
      aiModelUsed: soapNote.aiModelUsed,
      reviewNotes: soapNote.reviewNotes,
      amendmentReason: soapNote.amendmentReason,
      patient: soapNote.patient,
      generatedBy: soapNote.generatedBy,
      generatedAt: soapNote.generatedAt,
      reviewedBy: soapNote.reviewedBy,
      reviewedAt: soapNote.reviewedAt,
      finalizedBy: soapNote.finalizedBy,
      finalizedAt: soapNote.finalizedAt,
      createdAt: soapNote.createdAt,
      updatedAt: soapNote.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  createSoapNote,
  getSoapNoteByAssessment,
  updateSoapNote,
  updateSoapNoteStatus,
  listSoapNotesByPatient,
  getSoapNote,
};
