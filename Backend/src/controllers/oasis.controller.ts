import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole,
  AssessmentType,
  AssessmentStatus,
  AuditAction,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ===========================================
// CONFIGURATION
// ===========================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Assessment type to reason code mapping
const ASSESSMENT_TYPE_TO_REASON: Record<AssessmentType, string> = {
  START_OF_CARE: '01',
  RESUMPTION_OF_CARE: '03',
  RECERTIFICATION: '04',
  FOLLOW_UP: '05',
  TRANSFER_TO_INPATIENT: '06',
  DISCHARGE_FROM_AGENCY: '08',
  DEATH_AT_HOME: '09',
};

// OASIS sections with required items count
const OASIS_SECTIONS = {
  clinical_record: { name: 'Clinical Record Items', requiredItems: 12 },
  patient_tracking: { name: 'Patient Tracking', requiredItems: 8 },
  patient_history: { name: 'Patient History & Diagnoses', requiredItems: 15 },
  living_situation: { name: 'Living Situation', requiredItems: 6 },
  sensory_status: { name: 'Sensory Status', requiredItems: 6 },
  pain_assessment: { name: 'Pain Assessment', requiredItems: 4 },
  integumentary_status: { name: 'Integumentary Status', requiredItems: 14 },
  respiratory_status: { name: 'Respiratory Status', requiredItems: 3 },
  cardiac_status: { name: 'Cardiac Status', requiredItems: 2 },
  elimination_status: { name: 'Elimination Status', requiredItems: 5 },
  neuro_emotional: { name: 'Neuro/Emotional/Behavioral', requiredItems: 8 },
  functional_abilities: { name: 'Functional Abilities (GG)', requiredItems: 24 },
  medication_management: { name: 'Medication Management', requiredItems: 8 },
  care_management: { name: 'Care Management', requiredItems: 4 },
  therapy_need: { name: 'Therapy Need', requiredItems: 3 },
};

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CreateAssessmentRequestBody {
  patientId: string;
  episodeId: string;
  assessmentType: AssessmentType;
  assessmentReason?: string;
  startOfCareDate?: string;
  resumptionOfCareDate?: string;
  visitId?: string;
  copyFromAssessmentId?: string;
}

export interface UpdateAssessmentRequestBody {
  section?: string;
  items?: Record<string, OasisItemResponse>;
  status?: AssessmentStatus;
  assessmentCompletionDate?: string;
}

export interface OasisItemResponse {
  responseValue?: string;
  responseCode?: string;
  responseText?: string;
  responseNumeric?: number;
  responseDate?: string;
  responseJson?: object;
  confidence?: number;
  sourceType?: 'manual' | 'voice' | 'ocr' | 'emr';
  sourceTranscriptionId?: string;
  sourceText?: string;
}

export interface SubmitAssessmentRequestBody {
  supervisorId?: string;
  notes?: string;
  attestation: boolean;
}

export interface ApproveAssessmentRequestBody {
  approved: boolean;
  notes?: string;
  correctionReason?: string;
}

export interface ListAssessmentsQuery {
  page?: string;
  limit?: string;
  patientId?: string;
  episodeId?: string;
  assessmentType?: AssessmentType;
  status?: AssessmentStatus;
  clinicianId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'assessmentDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface QuestionLibraryQuery {
  section?: string;
  assessmentType?: AssessmentType;
  search?: string;
  includeRetired?: string;
}

export interface ValidationError {
  itemCode: string;
  itemName: string;
  errorType: 'required' | 'invalid' | 'consistency' | 'range' | 'skip_violation';
  message: string;
  severity: 'error' | 'warning';
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create audit log for OASIS assessment access
 */
async function createOasisAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  patientId: string,
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
        resourceType: 'oasis_assessment',
        resourceId,
        description: options.description,
        previousValues: options.previousValues ? JSON.parse(JSON.stringify(options.previousValues)) : null,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : null,
        phiAccessed: true,
        phiFields: ['assessment_data', 'diagnoses', 'functional_status'],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[OASIS Audit Log Error]', error);
  }
}

/**
 * Check if user has access to assessment
 */
async function checkAssessmentAccess(
  userId: string,
  userRole: UserRole,
  assessment: { clinicianId: string; patientId: string; reviewerId?: string | null }
): Promise<boolean> {
  // Admins and supervisors have full access
  if ([UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole)) {
    return true;
  }

  // Clinician who created it has access
  if (assessment.clinicianId === userId) {
    return true;
  }

  // Assigned reviewer has access
  if (assessment.reviewerId === userId) {
    return true;
  }

  // Check patient assignment
  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      patientId: assessment.patientId,
      userId,
      endDate: null,
    },
  });

  return !!assignment;
}

/**
 * Calculate completion percentage based on responses
 */
async function calculateCompletionPercentage(assessmentId: string): Promise<number> {
  const responses = await prisma.oasisResponse.findMany({
    where: { assessmentId },
    select: { itemCode: true, responseValue: true, responseCode: true },
  });

  const completedItems = responses.filter(r => r.responseValue || r.responseCode).length;
  const totalRequiredItems = Object.values(OASIS_SECTIONS).reduce((sum, s) => sum + s.requiredItems, 0);

  return Math.min(100, Math.round((completedItems / totalRequiredItems) * 100));
}

/**
 * Validate assessment responses
 */
async function validateAssessmentResponses(assessmentId: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: { responses: true },
  });

  if (!assessment) return errors;

  // Get required items from question library
  const requiredQuestions = await prisma.oasisQuestion.findMany({
    where: {
      assessmentTypes: { has: assessment.assessmentType },
      retiredDate: null,
    },
    select: { itemCode: true, itemName: true, responseType: true, validationRules: true },
  });

  const responseMap = new Map(assessment.responses.map(r => [r.itemCode, r]));

  // Check required items
  for (const question of requiredQuestions) {
    const response = responseMap.get(question.itemCode);
    const rules = question.validationRules as Array<{ ruleType: string; errorMessage: string; severity: string }> | null;

    if (rules) {
      const requiredRule = rules.find(r => r.ruleType === 'required');
      if (requiredRule && (!response || (!response.responseValue && !response.responseCode))) {
        errors.push({
          itemCode: question.itemCode,
          itemName: question.itemName,
          errorType: 'required',
          message: requiredRule.errorMessage || `${question.itemName} is required`,
          severity: (requiredRule.severity as 'error' | 'warning') || 'error',
        });
      }
    }
  }

  return errors;
}

/**
 * Calculate HIPPS code (placeholder - real calculation requires CMS algorithm)
 */
function calculateHippsCode(assessment: {
  responses: Array<{ itemCode: string; responseCode: string | null }>;
}): {
  hippsCode: string;
  clinicalGrouping: string;
  functionalLevel: string;
  comorbidityAdjustment: string;
  caseMixWeight: number;
} {
  // TODO: Implement actual CMS PDGM calculation
  // This is a placeholder that returns sample values
  return {
    hippsCode: '1ABC1',
    clinicalGrouping: 'B',
    functionalLevel: 'M',
    comorbidityAdjustment: 'L',
    caseMixWeight: 1.0234,
  };
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * List OASIS assessments with filtering and pagination
 * GET /api/oasis/assessments
 */
export async function listAssessments(
  req: AuthenticatedRequest & { query: ListAssessmentsQuery },
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

    const {
      page = '1',
      limit = String(DEFAULT_PAGE_SIZE),
      patientId,
      episodeId,
      assessmentType,
      status,
      clinicianId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.OasisAssessmentWhereInput = {
      deletedAt: null,
    };

    // Role-based filtering
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      where.OR = [
        { clinicianId: req.user.id },
        { reviewerId: req.user.id },
        {
          patient: {
            assignments: {
              some: {
                userId: req.user.id,
                endDate: null,
              },
            },
          },
        },
      ];
    }

    if (patientId) where.patientId = patientId;
    if (episodeId) where.episodeId = episodeId;
    if (assessmentType) where.assessmentType = assessmentType;
    if (status) where.status = status;
    if (clinicianId) where.clinicianId = clinicianId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Build order by
    const orderBy: Prisma.OasisAssessmentOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') orderBy.createdAt = sortOrder;
    else if (sortBy === 'assessmentDate') orderBy.m0090_completionDate = sortOrder;
    else if (sortBy === 'status') orderBy.status = sortOrder;

    const [assessments, total] = await Promise.all([
      prisma.oasisAssessment.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          patientId: true,
          episodeId: true,
          assessmentType: true,
          status: true,
          m0030_startOfCareDate: true,
          m0090_completionDate: true,
          completionPercentage: true,
          hippsCode: true,
          clinicianId: true,
          reviewerId: true,
          submittedAt: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: { id: true, firstName: true, lastName: true, mrn: true },
          },
          clinician: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { responses: true },
          },
        },
      }),
      prisma.oasisAssessment.count({ where }),
    ]);

    // Audit log
    await createOasisAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      patientId || 'multiple',
      true,
      req,
      { description: `Listed ${assessments.length} OASIS assessments` }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: assessments,
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
 * Get a single OASIS assessment by ID
 * GET /api/oasis/assessments/:id
 */
export async function getAssessment(
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

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            dateOfBirth: true,
            gender: true,
            addressState: true,
            addressZipCode: true,
          },
        },
        episode: {
          select: { id: true, episodeNumber: true, startDate: true, endDate: true },
        },
        clinician: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true },
        },
        responses: {
          orderBy: { itemCode: 'asc' },
        },
      },
    });

    if (!assessment || assessment.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Check access
    const hasAccess = await checkAssessmentAccess(
      req.user.id,
      req.user.role,
      { clinicianId: assessment.clinicianId, patientId: assessment.patientId, reviewerId: assessment.reviewerId }
    );

    if (!hasAccess) {
      await createOasisAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        assessment.patientId,
        false,
        req,
        { errorMessage: 'Access denied' }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this assessment',
      });
    }

    // Get validation errors
    const validationErrors = await validateAssessmentResponses(id);

    // Group responses by section
    const responsesBySection: Record<string, Array<typeof assessment.responses[0]>> = {};
    for (const response of assessment.responses) {
      if (!responsesBySection[response.section]) {
        responsesBySection[response.section] = [];
      }
      responsesBySection[response.section].push(response);
    }

    // Audit log
    await createOasisAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      { description: `Viewed OASIS assessment for patient ${assessment.patient.lastName}` }
    );

    return res.status(200).json({
      id: assessment.id,
      patientId: assessment.patientId,
      episodeId: assessment.episodeId,
      visitId: assessment.visitId,
      assessmentType: assessment.assessmentType,
      status: assessment.status,
      dates: {
        m0030_startOfCareDate: assessment.m0030_startOfCareDate,
        m0032_resumptionOfCareDate: assessment.m0032_resumptionOfCareDate,
        m0090_completionDate: assessment.m0090_completionDate,
        m0906_dischargeDate: assessment.m0906_dischargeDate,
      },
      scoring: {
        hippsCode: assessment.hippsCode,
        clinicalGrouping: assessment.clinicalGrouping,
        functionalLevel: assessment.functionalLevel,
        comorbidityAdjustment: assessment.comorbidityAdjustment,
        caseMixWeight: assessment.caseMixWeight,
      },
      completionPercentage: assessment.completionPercentage,
      voicePopulatedFields: assessment.voicePopulatedFields,
      responses: responsesBySection,
      validationErrors,
      workflow: {
        submittedAt: assessment.submittedAt,
        reviewedAt: assessment.reviewedAt,
        reviewNotes: assessment.reviewNotes,
        approvedAt: assessment.approvedAt,
        lockedAt: assessment.lockedAt,
        correctionReason: assessment.correctionReason,
        version: assessment.version,
      },
      patient: assessment.patient,
      episode: assessment.episode,
      clinician: assessment.clinician,
      reviewer: assessment.reviewer,
      approver: assessment.approver,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new OASIS assessment
 * POST /api/oasis/assessments
 */
export async function createAssessment(
  req: AuthenticatedRequest & { body: CreateAssessmentRequestBody },
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

    // Only clinical staff can create assessments
    const allowedRoles = [
      UserRole.ADMIN,
      UserRole.SUPERVISOR,
      UserRole.NURSE,
      UserRole.THERAPIST_PT,
      UserRole.THERAPIST_OT,
      UserRole.THERAPIST_ST,
    ];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create OASIS assessments',
      });
    }

    const {
      patientId,
      episodeId,
      assessmentType,
      startOfCareDate,
      resumptionOfCareDate,
      visitId,
      copyFromAssessmentId,
    } = req.body;

    // Validate required fields
    if (!patientId || !episodeId || !assessmentType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Patient ID, episode ID, and assessment type are required',
      });
    }

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    });

    if (!patient || patient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Validate episode exists and belongs to patient
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, patientId: true, deletedAt: true },
    });

    if (!episode || episode.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Episode not found',
      });
    }

    if (episode.patientId !== patientId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Episode does not belong to the specified patient',
      });
    }

    // Create assessment
    const assessmentId = uuidv4();
    const assessment = await prisma.oasisAssessment.create({
      data: {
        id: assessmentId,
        patientId,
        episodeId,
        visitId: visitId || null,
        clinicianId: req.user.id,
        assessmentType,
        status: AssessmentStatus.DRAFT,
        m0030_startOfCareDate: startOfCareDate ? new Date(startOfCareDate) : null,
        m0032_resumptionOfCareDate: resumptionOfCareDate ? new Date(resumptionOfCareDate) : null,
        m0090_completionDate: new Date(),
        completionPercentage: 0,
        version: 1,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        clinician: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Copy responses from previous assessment if specified
    if (copyFromAssessmentId) {
      const previousResponses = await prisma.oasisResponse.findMany({
        where: { assessmentId: copyFromAssessmentId },
      });

      if (previousResponses.length > 0) {
        await prisma.oasisResponse.createMany({
          data: previousResponses.map(r => ({
            id: uuidv4(),
            assessmentId: assessmentId,
            itemCode: r.itemCode,
            section: r.section,
            responseValue: r.responseValue,
            responseCode: r.responseCode,
            responseText: r.responseText,
            responseNumeric: r.responseNumeric,
            responseDate: r.responseDate,
            responseJson: r.responseJson,
            sourceType: 'manual',
          })),
        });

        // Recalculate completion
        const completion = await calculateCompletionPercentage(assessmentId);
        await prisma.oasisAssessment.update({
          where: { id: assessmentId },
          data: { completionPercentage: completion },
        });
      }
    }

    // Audit log
    await createOasisAuditLog(
      AuditAction.CREATE,
      req.user.id,
      req.user.email,
      req.user.role,
      assessmentId,
      patientId,
      true,
      req,
      {
        description: `Created ${assessmentType} assessment for patient ${patient.lastName}, ${patient.firstName}`,
        newValues: { assessmentType, patientId, episodeId },
      }
    );

    return res.status(201).json({
      message: 'OASIS assessment created successfully',
      assessment: {
        id: assessment.id,
        patientId: assessment.patientId,
        episodeId: assessment.episodeId,
        assessmentType: assessment.assessmentType,
        status: assessment.status,
        completionPercentage: assessment.completionPercentage,
        patient: assessment.patient,
        clinician: assessment.clinician,
        createdAt: assessment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an OASIS assessment
 * PUT /api/oasis/assessments/:id
 */
export async function updateAssessment(
  req: AuthenticatedRequest & { params: { id: string }; body: UpdateAssessmentRequestBody },
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
    const { section, items, status, assessmentCompletionDate } = req.body;

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        clinicianId: true,
        reviewerId: true,
        status: true,
        lockedAt: true,
      },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Check if assessment is locked
    if (assessment.lockedAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assessment is locked and cannot be modified',
      });
    }

    // Check access
    const hasAccess = await checkAssessmentAccess(
      req.user.id,
      req.user.role,
      { clinicianId: assessment.clinicianId, patientId: assessment.patientId, reviewerId: assessment.reviewerId }
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this assessment',
      });
    }

    // Update responses if provided
    if (items && section) {
      for (const [itemCode, response] of Object.entries(items)) {
        await prisma.oasisResponse.upsert({
          where: {
            assessmentId_itemCode: {
              assessmentId: id,
              itemCode,
            },
          },
          create: {
            id: uuidv4(),
            assessmentId: id,
            itemCode,
            section,
            responseValue: response.responseValue || null,
            responseCode: response.responseCode || null,
            responseText: response.responseText || null,
            responseNumeric: response.responseNumeric || null,
            responseDate: response.responseDate ? new Date(response.responseDate) : null,
            responseJson: response.responseJson as Prisma.InputJsonValue || null,
            confidence: response.confidence || null,
            sourceType: response.sourceType || 'manual',
            sourceTranscriptionId: response.sourceTranscriptionId || null,
            sourceText: response.sourceText || null,
          },
          update: {
            responseValue: response.responseValue || null,
            responseCode: response.responseCode || null,
            responseText: response.responseText || null,
            responseNumeric: response.responseNumeric || null,
            responseDate: response.responseDate ? new Date(response.responseDate) : null,
            responseJson: response.responseJson as Prisma.InputJsonValue || null,
            confidence: response.confidence || null,
            sourceType: response.sourceType || 'manual',
            sourceTranscriptionId: response.sourceTranscriptionId || null,
            sourceText: response.sourceText || null,
          },
        });
      }
    }

    // Calculate new completion percentage
    const completionPercentage = await calculateCompletionPercentage(id);

    // Update assessment
    const updateData: Prisma.OasisAssessmentUpdateInput = {
      completionPercentage,
    };

    if (status && status !== assessment.status) {
      // Only allow certain status transitions
      const allowedTransitions: Record<AssessmentStatus, AssessmentStatus[]> = {
        DRAFT: [AssessmentStatus.IN_PROGRESS],
        IN_PROGRESS: [AssessmentStatus.PENDING_REVIEW, AssessmentStatus.DRAFT],
        PENDING_REVIEW: [AssessmentStatus.NEEDS_CORRECTION, AssessmentStatus.APPROVED, AssessmentStatus.IN_PROGRESS],
        NEEDS_CORRECTION: [AssessmentStatus.IN_PROGRESS],
        APPROVED: [AssessmentStatus.SUBMITTED, AssessmentStatus.NEEDS_CORRECTION],
        SUBMITTED: [AssessmentStatus.LOCKED],
        LOCKED: [],
      };

      if (!allowedTransitions[assessment.status]?.includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Cannot transition from ${assessment.status} to ${status}`,
        });
      }
      updateData.status = status;
    }

    if (assessmentCompletionDate) {
      updateData.m0090_completionDate = new Date(assessmentCompletionDate);
    }

    // Auto-transition to IN_PROGRESS if still DRAFT and items were updated
    if (items && assessment.status === AssessmentStatus.DRAFT) {
      updateData.status = AssessmentStatus.IN_PROGRESS;
    }

    const updatedAssessment = await prisma.oasisAssessment.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        status: true,
        completionPercentage: true,
        updatedAt: true,
      },
    });

    // Audit log
    await createOasisAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      {
        description: `Updated OASIS assessment${section ? ` (section: ${section})` : ''}`,
        newValues: { section, itemCount: items ? Object.keys(items).length : 0, status: updatedAssessment.status },
      }
    );

    return res.status(200).json({
      message: 'OASIS assessment updated successfully',
      assessment: {
        id: updatedAssessment.id,
        status: updatedAssessment.status,
        completionPercentage: updatedAssessment.completionPercentage,
        updatedAt: updatedAssessment.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit assessment for review
 * POST /api/oasis/assessments/:id/submit
 */
export async function submitForReview(
  req: AuthenticatedRequest & { params: { id: string }; body: SubmitAssessmentRequestBody },
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
    const { supervisorId, notes, attestation } = req.body;

    if (!attestation) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Clinician attestation is required to submit assessment',
      });
    }

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Only the clinician who created it can submit
    if (assessment.clinicianId !== req.user.id && ![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the clinician who created the assessment can submit it',
      });
    }

    // Check status
    if (![AssessmentStatus.IN_PROGRESS, AssessmentStatus.NEEDS_CORRECTION].includes(assessment.status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot submit assessment with status: ${assessment.status}`,
      });
    }

    // Validate before submission
    const validationErrors = await validateAssessmentResponses(id);
    const criticalErrors = validationErrors.filter(e => e.severity === 'error');

    if (criticalErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation Failed',
        message: 'Assessment has validation errors that must be corrected before submission',
        errors: criticalErrors,
      });
    }

    // Calculate scoring
    const responses = await prisma.oasisResponse.findMany({
      where: { assessmentId: id },
      select: { itemCode: true, responseCode: true },
    });
    const scoring = calculateHippsCode({ responses });

    // Update assessment
    const updatedAssessment = await prisma.oasisAssessment.update({
      where: { id },
      data: {
        status: AssessmentStatus.PENDING_REVIEW,
        reviewerId: supervisorId || null,
        submittedAt: new Date(),
        reviewNotes: notes || null,
        hippsCode: scoring.hippsCode,
        clinicalGrouping: scoring.clinicalGrouping,
        functionalLevel: scoring.functionalLevel,
        comorbidityAdjustment: scoring.comorbidityAdjustment,
        caseMixWeight: scoring.caseMixWeight,
      },
    });

    // Audit log
    await createOasisAuditLog(
      AuditAction.SUBMIT,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      {
        description: `Submitted OASIS assessment for review (patient: ${assessment.patient.lastName})`,
        newValues: { status: updatedAssessment.status, hippsCode: scoring.hippsCode },
      }
    );

    return res.status(200).json({
      message: 'OASIS assessment submitted for review',
      assessment: {
        id: updatedAssessment.id,
        status: updatedAssessment.status,
        submittedAt: updatedAssessment.submittedAt,
        reviewerId: updatedAssessment.reviewerId,
        scoring: {
          hippsCode: scoring.hippsCode,
          clinicalGrouping: scoring.clinicalGrouping,
          functionalLevel: scoring.functionalLevel,
          caseMixWeight: scoring.caseMixWeight,
        },
        validationWarnings: validationErrors.filter(e => e.severity === 'warning'),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve or reject assessment (supervisor only)
 * POST /api/oasis/assessments/:id/review
 */
export async function reviewAssessment(
  req: AuthenticatedRequest & { params: { id: string }; body: ApproveAssessmentRequestBody },
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

    // Only supervisors and admins can review
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only supervisors can review assessments',
      });
    }

    const { id } = req.params;
    const { approved, notes, correctionReason } = req.body;

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    if (assessment.status !== AssessmentStatus.PENDING_REVIEW) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assessment is not pending review',
      });
    }

    const updateData: Prisma.OasisAssessmentUpdateInput = {
      reviewerId: req.user.id,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    };

    if (approved) {
      updateData.status = AssessmentStatus.APPROVED;
      updateData.approverId = req.user.id;
      updateData.approvedAt = new Date();
    } else {
      updateData.status = AssessmentStatus.NEEDS_CORRECTION;
      updateData.correctionReason = correctionReason || 'Corrections needed';
    }

    const updatedAssessment = await prisma.oasisAssessment.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await createOasisAuditLog(
      approved ? AuditAction.APPROVE : AuditAction.REJECT,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      {
        description: `${approved ? 'Approved' : 'Rejected'} OASIS assessment (patient: ${assessment.patient.lastName})`,
        newValues: { status: updatedAssessment.status, correctionReason },
      }
    );

    return res.status(200).json({
      message: `OASIS assessment ${approved ? 'approved' : 'returned for corrections'}`,
      assessment: {
        id: updatedAssessment.id,
        status: updatedAssessment.status,
        reviewedAt: updatedAssessment.reviewedAt,
        approvedAt: updatedAssessment.approvedAt,
        correctionReason: updatedAssessment.correctionReason,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lock an approved assessment
 * POST /api/oasis/assessments/:id/lock
 */
export async function lockAssessment(
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

    // Only supervisors and admins can lock
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only supervisors can lock assessments',
      });
    }

    const { id } = req.params;

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    if (assessment.status !== AssessmentStatus.APPROVED && assessment.status !== AssessmentStatus.SUBMITTED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only approved or submitted assessments can be locked',
      });
    }

    const updatedAssessment = await prisma.oasisAssessment.update({
      where: { id },
      data: {
        status: AssessmentStatus.LOCKED,
        lockedAt: new Date(),
      },
    });

    // Audit log
    await createOasisAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      { description: 'Locked OASIS assessment' }
    );

    return res.status(200).json({
      message: 'OASIS assessment locked successfully',
      assessment: {
        id: updatedAssessment.id,
        status: updatedAssessment.status,
        lockedAt: updatedAssessment.lockedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get OASIS question library
 * GET /api/oasis/questions
 */
export async function getQuestionLibrary(
  req: AuthenticatedRequest & { query: QuestionLibraryQuery },
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

    const { section, assessmentType, search, includeRetired } = req.query;

    const where: Prisma.OasisQuestionWhereInput = {};

    if (section) {
      where.section = section;
    }

    if (assessmentType) {
      where.assessmentTypes = { has: assessmentType };
    }

    if (search) {
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { itemName: { contains: search, mode: 'insensitive' } },
        { questionText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (includeRetired !== 'true') {
      where.retiredDate = null;
    }

    const questions = await prisma.oasisQuestion.findMany({
      where,
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { itemCode: 'asc' }],
    });

    // Get section summary
    const sections = Object.entries(OASIS_SECTIONS).map(([code, info]) => ({
      code,
      name: info.name,
      itemCount: questions.filter(q => q.section === code).length,
    }));

    return res.status(200).json({
      questions,
      totalCount: questions.length,
      sections,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculate/recalculate HIPPS score for an assessment
 * POST /api/oasis/assessments/:id/calculate-score
 */
export async function calculateScore(
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

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
      include: {
        responses: {
          select: { itemCode: true, responseCode: true },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Calculate scoring
    const scoring = calculateHippsCode({ responses: assessment.responses });

    // Update assessment with scoring
    await prisma.oasisAssessment.update({
      where: { id },
      data: {
        hippsCode: scoring.hippsCode,
        clinicalGrouping: scoring.clinicalGrouping,
        functionalLevel: scoring.functionalLevel,
        comorbidityAdjustment: scoring.comorbidityAdjustment,
        caseMixWeight: scoring.caseMixWeight,
      },
    });

    return res.status(200).json({
      message: 'HIPPS score calculated successfully',
      scoring,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an OASIS assessment (soft delete, draft only)
 * DELETE /api/oasis/assessments/:id
 */
export async function deleteAssessment(
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

    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Only drafts can be deleted, and only by creator or admin
    if (assessment.status !== AssessmentStatus.DRAFT) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only draft assessments can be deleted',
      });
    }

    const canDelete =
      assessment.clinicianId === req.user.id ||
      [UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this assessment',
      });
    }

    // Soft delete
    await prisma.oasisAssessment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await createOasisAuditLog(
      AuditAction.DELETE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      assessment.patientId,
      true,
      req,
      { description: 'Deleted draft OASIS assessment' }
    );

    return res.status(200).json({
      message: 'OASIS assessment deleted successfully',
      assessmentId: id,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  submitForReview,
  reviewAssessment,
  lockAssessment,
  getQuestionLibrary,
  calculateScore,
  deleteAssessment,
};
