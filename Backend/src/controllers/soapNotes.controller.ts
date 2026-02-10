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
import { generateSoapNote, regenerateSection, validateSoapNote } from '../services/soapNoteGeneration.service';

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

export interface RegenerateSectionRequest extends AuthenticatedRequest {
  params: { id: string };
  body: {
    section: 'subjective' | 'objective' | 'assessment' | 'plan';
    instructions?: string;
  };
}

export interface GenerateSoapNoteRequest extends AuthenticatedRequest {
  params: { assessmentId: string };
  body: {
    additionalContext?: string;
  };
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

/**
 * Trigger AI generation for a SOAP note
 * POST /api/assessments/:assessmentId/soap-notes/generate
 */
export async function triggerGeneration(
  req: GenerateSoapNoteRequest,
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
    const { additionalContext } = req.body;

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
        message: 'You do not have permission to generate SOAP notes for this patient',
      });
    }

    // Check if we have enough data to generate
    if (oasisAssessment.responses.length < 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Not enough assessment data to generate a meaningful SOAP note. Please complete more of the assessment first.',
        responsesCount: oasisAssessment.responses.length,
        minimumRequired: 10,
      });
    }

    // Check if SOAP note already exists
    const existingSoapNote = await prisma.soapNote.findFirst({
      where: {
        assessmentId,
        deletedAt: null,
      },
    });

    // Generate the SOAP note content
    const generationResult = await generateSoapNote({
      assessmentId,
      patientId: oasisAssessment.patientId,
      additionalContext,
    });

    if (!generationResult.success) {
      return res.status(500).json({
        error: 'Generation Failed',
        message: generationResult.error || 'Failed to generate SOAP note',
        generationTimeMs: generationResult.generationTimeMs,
      });
    }

    // Define the include for the result
    const soapNoteInclude = {
      patient: {
        select: { id: true, firstName: true, lastName: true, mrn: true },
      },
      assessment: {
        select: { id: true, assessmentType: true, status: true },
      },
      generatedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    } as const;

    // Create or update the SOAP note
    let resultSoapNote;
    if (existingSoapNote) {
      // Update existing note (only if still draft)
      if (existingSoapNote.status !== SoapNoteStatus.DRAFT) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot regenerate a non-draft SOAP note. Create a new version instead.',
          currentStatus: existingSoapNote.status,
        });
      }

      resultSoapNote = await prisma.soapNote.update({
        where: { id: existingSoapNote.id },
        data: {
          subjective: generationResult.content.subjective,
          objective: generationResult.content.objective,
          assessmentContent: generationResult.content.assessment,
          plan: generationResult.content.plan,
          aiModelUsed: generationResult.aiModelUsed,
          generatedAt: new Date(),
        },
        include: soapNoteInclude,
      });
    } else {
      // Create new note
      resultSoapNote = await prisma.soapNote.create({
        data: {
          assessmentId,
          patientId: oasisAssessment.patientId,
          subjective: generationResult.content.subjective,
          objective: generationResult.content.objective,
          assessmentContent: generationResult.content.assessment,
          plan: generationResult.content.plan,
          status: SoapNoteStatus.DRAFT,
          generatedById: req.user.id,
          aiModelUsed: generationResult.aiModelUsed,
          version: 1,
        },
        include: soapNoteInclude,
      });
    }

    // Audit log
    await createSoapNoteAuditLog(
      AuditAction.CREATE,
      req.user.id,
      req.user.email,
      req.user.role,
      resultSoapNote.id,
      oasisAssessment.patientId,
      true,
      req,
      {
        description: `AI-generated SOAP note for patient ${oasisAssessment.patient.lastName}, ${oasisAssessment.patient.firstName}`,
        newValues: {
          assessmentId,
          aiModelUsed: generationResult.aiModelUsed,
          generationTimeMs: generationResult.generationTimeMs,
        },
      }
    );

    return res.status(201).json({
      message: 'SOAP note generated successfully',
      soapNote: {
        id: resultSoapNote.id,
        assessmentId: resultSoapNote.assessmentId,
        patientId: resultSoapNote.patientId,
        subjective: resultSoapNote.subjective,
        objective: resultSoapNote.objective,
        assessment: resultSoapNote.assessmentContent,
        plan: resultSoapNote.plan,
        status: resultSoapNote.status,
        version: resultSoapNote.version,
        aiModelUsed: resultSoapNote.aiModelUsed,
        patient: resultSoapNote.patient,
        generatedBy: resultSoapNote.generatedBy,
        generatedAt: resultSoapNote.generatedAt,
        createdAt: resultSoapNote.createdAt,
      },
      generation: {
        timeMs: generationResult.generationTimeMs,
        modelUsed: generationResult.aiModelUsed,
        confidence: generationResult.confidence,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate a specific section of a SOAP note
 * POST /api/soap-notes/:id/regenerate
 */
export async function regenerateSoapNoteSection(
  req: RegenerateSectionRequest,
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
    const { section, instructions } = req.body;

    // Validate section
    const validSections = ['subjective', 'objective', 'assessment', 'plan'];
    if (!validSections.includes(section)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid section: ${section}. Must be one of: ${validSections.join(', ')}`,
      });
    }

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

    // Cannot regenerate finalized notes
    if (soapNote.status === SoapNoteStatus.FINALIZED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot regenerate sections of a finalized SOAP note.',
      });
    }

    // Call the regenerate function
    const result = await regenerateSection(
      id,
      section as 'subjective' | 'objective' | 'assessment' | 'plan',
      instructions
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Regeneration Failed',
        message: result.error || 'Failed to regenerate section',
        generationTimeMs: result.generationTimeMs,
      });
    }

    // Update the specific section
    const updateData: Prisma.SoapNoteUpdateInput = {};
    if (section === 'subjective') updateData.subjective = result.content;
    else if (section === 'objective') updateData.objective = result.content;
    else if (section === 'assessment') updateData.assessmentContent = result.content;
    else if (section === 'plan') updateData.plan = result.content;

    const updatedNote = await prisma.soapNote.update({
      where: { id },
      data: updateData,
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
        description: `AI-regenerated ${section} section${instructions ? ' with custom instructions' : ''}`,
        newValues: {
          section,
          contentLength: result.content.length,
          generationTimeMs: result.generationTimeMs,
        },
      }
    );

    return res.status(200).json({
      message: `${section} section regenerated successfully`,
      section,
      content: result.content,
      soapNote: {
        id: updatedNote.id,
        subjective: updatedNote.subjective,
        objective: updatedNote.objective,
        assessment: updatedNote.assessmentContent,
        plan: updatedNote.plan,
        status: updatedNote.status,
        updatedAt: updatedNote.updatedAt,
      },
      generation: {
        timeMs: result.generationTimeMs,
        modelUsed: result.aiModelUsed,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Export SOAP note as PDF
 * GET /api/soap-notes/:id/pdf
 */
export async function exportPdf(
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
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
            dateOfBirth: true,
          },
        },
        assessment: {
          select: {
            assessmentType: true,
            m0030_startOfCareDate: true,
          },
        },
        generatedBy: {
          select: { firstName: true, lastName: true, licenseNumber: true },
        },
        finalizedBy: {
          select: { firstName: true, lastName: true, licenseNumber: true },
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
        message: 'You do not have permission to export this SOAP note',
      });
    }

    // Build PDF content as HTML for now (can be enhanced with pdfkit/puppeteer)
    const agencyName = process.env['AGENCY_NAME'] || 'Home Health Care Agency';
    const assessmentDate = soapNote.assessment.m0030_startOfCareDate
      ? new Date(soapNote.assessment.m0030_startOfCareDate).toLocaleDateString()
      : 'N/A';
    const generatedDate = new Date(soapNote.generatedAt).toLocaleDateString();
    const clinicianName = soapNote.generatedBy
      ? `${soapNote.generatedBy.firstName} ${soapNote.generatedBy.lastName}${soapNote.generatedBy.licenseNumber ? `, ${soapNote.generatedBy.licenseNumber}` : ''}`
      : 'Unknown';

    // Generate simple HTML that can be printed to PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SOAP Note - ${soapNote.patient.lastName}, ${soapNote.patient.firstName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; margin: 40px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .header p { margin: 5px 0; color: #666; }
    .patient-info { background: #f5f5f5; padding: 10px; margin-bottom: 20px; }
    .patient-info table { width: 100%; }
    .patient-info td { padding: 3px 10px 3px 0; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 14px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
    .section-content { white-space: pre-wrap; }
    .footer { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 30px; font-size: 10px; color: #666; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .status-DRAFT { background: #fef3c7; color: #92400e; }
    .status-REVIEWED { background: #dbeafe; color: #1e40af; }
    .status-FINALIZED { background: #d1fae5; color: #065f46; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${agencyName}</h1>
    <p>SOAP Note Documentation</p>
  </div>

  <div class="patient-info">
    <table>
      <tr>
        <td><strong>Patient:</strong> ${soapNote.patient.lastName}, ${soapNote.patient.firstName}</td>
        <td><strong>MRN:</strong> ${soapNote.patient.mrn}</td>
        <td><strong>DOB:</strong> ${new Date(soapNote.patient.dateOfBirth).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td><strong>Assessment Type:</strong> ${soapNote.assessment.assessmentType.replace(/_/g, ' ')}</td>
        <td><strong>Assessment Date:</strong> ${assessmentDate}</td>
        <td><strong>Status:</strong> <span class="status-badge status-${soapNote.status}">${soapNote.status}</span></td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>SUBJECTIVE</h2>
    <div class="section-content">${soapNote.subjective || 'Not documented'}</div>
  </div>

  <div class="section">
    <h2>OBJECTIVE</h2>
    <div class="section-content">${soapNote.objective || 'Not documented'}</div>
  </div>

  <div class="section">
    <h2>ASSESSMENT</h2>
    <div class="section-content">${soapNote.assessmentContent || 'Not documented'}</div>
  </div>

  <div class="section">
    <h2>PLAN</h2>
    <div class="section-content">${soapNote.plan || 'Not documented'}</div>
  </div>

  <div class="footer">
    <p>
      <strong>Generated:</strong> ${generatedDate} by ${clinicianName}<br>
      ${soapNote.finalizedBy ? `<strong>Finalized:</strong> ${soapNote.finalizedAt ? new Date(soapNote.finalizedAt).toLocaleDateString() : ''} by ${soapNote.finalizedBy.firstName} ${soapNote.finalizedBy.lastName}${soapNote.finalizedBy.licenseNumber ? `, ${soapNote.finalizedBy.licenseNumber}` : ''}<br>` : ''}
      <strong>Version:</strong> ${soapNote.version} | <strong>Document ID:</strong> ${soapNote.id}
    </p>
  </div>
</body>
</html>`;

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
        description: 'Exported SOAP note as PDF/HTML',
      }
    );

    // Return HTML content (can be converted to PDF by client or enhanced with server-side PDF generation)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="SOAP_Note_${soapNote.patient.lastName}_${soapNote.patient.firstName}_${new Date().toISOString().split('T')[0]}.html"`
    );

    return res.send(htmlContent);
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
  triggerGeneration,
  regenerateSoapNoteSection,
  exportPdf,
};
