import { v4 as uuidv4 } from 'uuid';
import {
  AssessmentType,
  AssessmentStatus,
  Prisma,
  OasisAssessment,
  OasisResponse,
  OasisQuestion,
} from '../generated/prisma';
import prisma from '../config/prisma';

// ===========================================
// CONFIGURATION
// ===========================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Assessment type to CMS reason code mapping
export const ASSESSMENT_TYPE_TO_REASON: Record<AssessmentType, string> = {
  START_OF_CARE: '01',
  RESUMPTION_OF_CARE: '03',
  RECERTIFICATION: '04',
  FOLLOW_UP: '05',
  TRANSFER_TO_INPATIENT: '06',
  DISCHARGE_FROM_AGENCY: '08',
  DEATH_AT_HOME: '09',
};

// OASIS sections with metadata
export const OASIS_SECTIONS = {
  clinical_record: { name: 'Clinical Record Items', itemPrefix: 'M00', requiredItems: 12 },
  patient_tracking: { name: 'Patient Tracking', itemPrefix: 'M00', requiredItems: 8 },
  patient_history: { name: 'Patient History & Diagnoses', itemPrefix: 'M10', requiredItems: 15 },
  living_situation: { name: 'Living Situation', itemPrefix: 'M11', requiredItems: 6 },
  sensory_status: { name: 'Sensory Status', itemPrefix: 'M12', requiredItems: 6 },
  pain_assessment: { name: 'Pain Assessment', itemPrefix: 'M12', requiredItems: 4 },
  integumentary_status: { name: 'Integumentary Status', itemPrefix: 'M13', requiredItems: 14 },
  respiratory_status: { name: 'Respiratory Status', itemPrefix: 'M14', requiredItems: 3 },
  cardiac_status: { name: 'Cardiac Status', itemPrefix: 'M15', requiredItems: 2 },
  elimination_status: { name: 'Elimination Status', itemPrefix: 'M16', requiredItems: 5 },
  neuro_emotional: { name: 'Neuro/Emotional/Behavioral', itemPrefix: 'M17', requiredItems: 8 },
  functional_abilities: { name: 'Functional Abilities (GG)', itemPrefix: 'GG', requiredItems: 24 },
  medication_management: { name: 'Medication Management', itemPrefix: 'M20', requiredItems: 8 },
  care_management: { name: 'Care Management', itemPrefix: 'M21', requiredItems: 4 },
  therapy_need: { name: 'Therapy Need', itemPrefix: 'M22', requiredItems: 3 },
} as const;

export type OasisSectionCode = keyof typeof OASIS_SECTIONS;

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CreateAssessmentInput {
  patientId: string;
  episodeId: string;
  assessmentType: AssessmentType;
  clinicianId: string;
  visitId?: string;
  startOfCareDate?: Date;
  resumptionOfCareDate?: Date;
  copyFromAssessmentId?: string;
}

export interface UpdateAssessmentInput {
  section?: string;
  items?: OasisItemInput[];
  status?: AssessmentStatus;
  completionDate?: Date;
}

export interface OasisItemInput {
  itemCode: string;
  responseValue?: string;
  responseCode?: string;
  responseText?: string;
  responseNumeric?: number;
  responseDate?: Date;
  responseJson?: object;
  confidence?: number;
  sourceType?: 'manual' | 'voice' | 'ocr' | 'emr';
  sourceTranscriptionId?: string;
  sourceText?: string;
}

export interface SubmitForReviewInput {
  supervisorId?: string;
  notes?: string;
}

export interface ReviewAssessmentInput {
  approved: boolean;
  notes?: string;
  correctionReason?: string;
}

export interface ListAssessmentsInput {
  page?: number;
  limit?: number;
  patientId?: string;
  episodeId?: string;
  assessmentType?: AssessmentType;
  status?: AssessmentStatus;
  clinicianId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'completionDate' | 'status';
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface QuestionLibraryInput {
  section?: string;
  assessmentType?: AssessmentType;
  search?: string;
  includeRetired?: boolean;
}

export interface ValidationError {
  itemCode: string;
  itemName: string;
  errorType: 'required' | 'invalid' | 'consistency' | 'range' | 'skip_violation';
  message: string;
  severity: 'error' | 'warning';
}

export interface ScoringResult {
  hippsCode: string;
  clinicalGrouping: string;
  functionalLevel: string;
  comorbidityAdjustment: string;
  caseMixWeight: number;
  functionalScore: number;
  clinicalScore: number;
  serviceUtilizationScore: number;
  calculatedAt: Date;
  calculationVersion: string;
}

// ===========================================
// ASSESSMENT CRUD OPERATIONS
// ===========================================

/**
 * Create a new OASIS assessment
 */
export async function createAssessment(
  input: CreateAssessmentInput
): Promise<OasisAssessment> {
  const {
    patientId,
    episodeId,
    assessmentType,
    clinicianId,
    visitId,
    startOfCareDate,
    resumptionOfCareDate,
    copyFromAssessmentId,
  } = input;

  // Verify patient exists and is active
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, deletedAt: null },
  });

  if (!patient) {
    throw new Error('Patient not found');
  }

  // Verify episode exists
  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, patientId },
  });

  if (!episode) {
    throw new Error('Episode not found');
  }

  // If copying from previous assessment, fetch it
  let previousResponses: OasisResponse[] = [];
  if (copyFromAssessmentId) {
    const previousAssessment = await prisma.oasisAssessment.findFirst({
      where: { id: copyFromAssessmentId, patientId },
      include: { responses: true },
    });

    if (previousAssessment) {
      previousResponses = previousAssessment.responses;
    }
  }

  // Create the assessment
  const assessment = await prisma.oasisAssessment.create({
    data: {
      patientId,
      episodeId,
      clinicianId,
      visitId,
      assessmentType,
      status: AssessmentStatus.DRAFT,
      m0030_startOfCareDate: startOfCareDate,
      m0032_resumptionOfCareDate: resumptionOfCareDate,
      completionPercentage: 0,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      episode: { select: { id: true, startDate: true } },
      clinician: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Copy responses from previous assessment if requested
  if (previousResponses.length > 0) {
    const responsesToCopy = previousResponses.map((r) => ({
      assessmentId: assessment.id,
      itemCode: r.itemCode,
      section: r.section,
      responseValue: r.responseValue,
      responseCode: r.responseCode,
      responseText: r.responseText,
      responseNumeric: r.responseNumeric,
      responseDate: r.responseDate,
      responseJson: r.responseJson,
      sourceType: 'manual',
      requiresReview: true,
      reviewReason: 'Copied from previous assessment - please verify',
    }));

    await prisma.oasisResponse.createMany({
      data: responsesToCopy,
    });

    // Update completion percentage
    await updateCompletionPercentage(assessment.id);
  }

  return assessment;
}

/**
 * Get assessment by ID with full details
 */
export async function getAssessment(
  assessmentId: string,
  includeResponses = true
): Promise<OasisAssessment | null> {
  return prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          dateOfBirth: true,
        },
      },
      episode: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
      clinician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      approver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      responses: includeResponses,
    },
  });
}

/**
 * List assessments with filtering and pagination
 */
export async function listAssessments(input: ListAssessmentsInput): Promise<{
  assessments: OasisAssessment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    patientId,
    episodeId,
    assessmentType,
    status,
    clinicianId,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    includeDeleted = false,
  } = input;

  const effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * effectiveLimit;

  // Build where clause
  const where: Prisma.OasisAssessmentWhereInput = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (patientId) where.patientId = patientId;
  if (episodeId) where.episodeId = episodeId;
  if (assessmentType) where.assessmentType = assessmentType;
  if (status) where.status = status;
  if (clinicianId) where.clinicianId = clinicianId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  // Build orderBy
  const orderBy: Prisma.OasisAssessmentOrderByWithRelationInput = {};
  if (sortBy === 'completionDate') {
    orderBy.m0090_completionDate = sortOrder;
  } else {
    orderBy[sortBy] = sortOrder;
  }

  const [assessments, total] = await Promise.all([
    prisma.oasisAssessment.findMany({
      where,
      orderBy,
      skip,
      take: effectiveLimit,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        clinician: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.oasisAssessment.count({ where }),
  ]);

  return {
    assessments,
    total,
    page,
    limit: effectiveLimit,
    totalPages: Math.ceil(total / effectiveLimit),
  };
}

/**
 * Update assessment responses
 */
export async function updateAssessment(
  assessmentId: string,
  input: UpdateAssessmentInput,
  userId: string
): Promise<OasisAssessment> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  // Check if assessment can be modified
  if (assessment.status === AssessmentStatus.LOCKED) {
    throw new Error('Assessment is locked and cannot be modified');
  }

  if (assessment.status === AssessmentStatus.SUBMITTED) {
    throw new Error('Assessment has been submitted and cannot be modified');
  }

  const { section, items, status, completionDate } = input;

  // Update responses if provided
  if (items && items.length > 0) {
    for (const item of items) {
      await prisma.oasisResponse.upsert({
        where: {
          assessmentId_itemCode: {
            assessmentId,
            itemCode: item.itemCode,
          },
        },
        create: {
          assessmentId,
          itemCode: item.itemCode,
          section: section || getItemSection(item.itemCode),
          responseValue: item.responseValue,
          responseCode: item.responseCode,
          responseText: item.responseText,
          responseNumeric: item.responseNumeric ? new Prisma.Decimal(item.responseNumeric) : null,
          responseDate: item.responseDate,
          responseJson: item.responseJson || Prisma.JsonNull,
          confidence: item.confidence ? new Prisma.Decimal(item.confidence) : null,
          sourceType: item.sourceType || 'manual',
          sourceTranscriptionId: item.sourceTranscriptionId,
          sourceText: item.sourceText,
        },
        update: {
          responseValue: item.responseValue,
          responseCode: item.responseCode,
          responseText: item.responseText,
          responseNumeric: item.responseNumeric ? new Prisma.Decimal(item.responseNumeric) : null,
          responseDate: item.responseDate,
          responseJson: item.responseJson || Prisma.JsonNull,
          confidence: item.confidence ? new Prisma.Decimal(item.confidence) : null,
          sourceType: item.sourceType || 'manual',
          sourceTranscriptionId: item.sourceTranscriptionId,
          sourceText: item.sourceText,
          updatedAt: new Date(),
        },
      });
    }
  }

  // Update assessment metadata
  const updateData: Prisma.OasisAssessmentUpdateInput = {
    updatedAt: new Date(),
  };

  if (status) {
    updateData.status = status;
  }

  if (completionDate) {
    updateData.m0090_completionDate = completionDate;
  }

  // Update completion percentage
  const completionPercentage = await calculateCompletionPercentage(assessmentId, assessment.assessmentType);
  updateData.completionPercentage = completionPercentage;

  // Auto-progress status from DRAFT to IN_PROGRESS
  if (assessment.status === AssessmentStatus.DRAFT && completionPercentage > 0) {
    updateData.status = AssessmentStatus.IN_PROGRESS;
  }

  const updatedAssessment = await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: updateData,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      clinician: { select: { id: true, firstName: true, lastName: true } },
      responses: true,
    },
  });

  return updatedAssessment;
}

/**
 * Soft delete an assessment
 */
export async function deleteAssessment(
  assessmentId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  if (assessment.status === AssessmentStatus.LOCKED) {
    throw new Error('Locked assessments cannot be deleted');
  }

  if (assessment.status === AssessmentStatus.SUBMITTED) {
    throw new Error('Submitted assessments cannot be deleted');
  }

  await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      deletedAt: new Date(),
      status: AssessmentStatus.DRAFT, // Reset status
    },
  });
}

// ===========================================
// WORKFLOW OPERATIONS
// ===========================================

/**
 * Submit assessment for review
 */
export async function submitForReview(
  assessmentId: string,
  clinicianId: string,
  input: SubmitForReviewInput
): Promise<OasisAssessment> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: { responses: true },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  // Verify clinician is the assessment owner
  if (assessment.clinicianId !== clinicianId) {
    throw new Error('Only the assessment owner can submit for review');
  }

  // Check current status allows submission
  const allowedStatuses = [
    AssessmentStatus.IN_PROGRESS,
    AssessmentStatus.NEEDS_CORRECTION,
  ];

  if (!allowedStatuses.includes(assessment.status)) {
    throw new Error(`Cannot submit assessment in ${assessment.status} status`);
  }

  // Validate assessment is complete enough for submission
  const validationErrors = await validateAssessment(assessment.id, assessment.assessmentType);
  const criticalErrors = validationErrors.filter((e) => e.severity === 'error');

  if (criticalErrors.length > 0) {
    throw new Error(`Assessment has ${criticalErrors.length} validation error(s) that must be resolved`);
  }

  const updatedAssessment = await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      status: AssessmentStatus.PENDING_REVIEW,
      reviewerId: input.supervisorId,
      submittedAt: new Date(),
      reviewNotes: input.notes,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      clinician: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return updatedAssessment;
}

/**
 * Review (approve/reject) an assessment
 */
export async function reviewAssessment(
  assessmentId: string,
  reviewerId: string,
  input: ReviewAssessmentInput
): Promise<OasisAssessment> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  if (assessment.status !== AssessmentStatus.PENDING_REVIEW) {
    throw new Error('Assessment is not pending review');
  }

  const newStatus = input.approved
    ? AssessmentStatus.APPROVED
    : AssessmentStatus.NEEDS_CORRECTION;

  const updatedAssessment = await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      status: newStatus,
      reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.notes,
      correctionReason: input.approved ? null : input.correctionReason,
      approvedAt: input.approved ? new Date() : null,
      approverId: input.approved ? reviewerId : null,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      clinician: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return updatedAssessment;
}

/**
 * Lock assessment (final submission to CMS)
 */
export async function lockAssessment(
  assessmentId: string,
  lockerId: string
): Promise<OasisAssessment> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  if (assessment.status !== AssessmentStatus.APPROVED) {
    throw new Error('Only approved assessments can be locked');
  }

  // Final validation before locking
  const validationErrors = await validateAssessment(assessment.id, assessment.assessmentType);
  const criticalErrors = validationErrors.filter((e) => e.severity === 'error');

  if (criticalErrors.length > 0) {
    throw new Error(`Assessment has ${criticalErrors.length} validation error(s)`);
  }

  // Calculate final HIPPS code
  const scoring = await calculateHippsCode(assessmentId);

  const updatedAssessment = await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      status: AssessmentStatus.LOCKED,
      lockedAt: new Date(),
      hippsCode: scoring.hippsCode,
      clinicalGrouping: scoring.clinicalGrouping,
      functionalLevel: scoring.functionalLevel,
      comorbidityAdjustment: scoring.comorbidityAdjustment,
      caseMixWeight: new Prisma.Decimal(scoring.caseMixWeight),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      clinician: { select: { id: true, firstName: true, lastName: true } },
      responses: true,
    },
  });

  return updatedAssessment;
}

// ===========================================
// VALIDATION & SCORING
// ===========================================

/**
 * Validate assessment responses
 */
export async function validateAssessment(
  assessmentId: string,
  assessmentType: AssessmentType
): Promise<ValidationError[]> {
  const responses = await prisma.oasisResponse.findMany({
    where: { assessmentId },
  });

  const questions = await prisma.oasisQuestion.findMany({
    where: {
      assessmentTypes: { has: assessmentType },
      retiredDate: null,
    },
  });

  const errors: ValidationError[] = [];
  const responseMap = new Map(responses.map((r) => [r.itemCode, r]));

  for (const question of questions) {
    const response = responseMap.get(question.itemCode);
    const validationRules = question.validationRules as ValidationRule[] | null;

    // Check required fields
    if (validationRules) {
      for (const rule of validationRules) {
        if (rule.ruleType === 'required' && !response?.responseValue && !response?.responseCode) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            errorType: 'required',
            message: rule.errorMessage || `${question.itemName} is required`,
            severity: rule.severity,
          });
        }

        // Add more validation rule checks here
      }
    }

    // Check skip logic
    const skipLogic = question.skipLogic as SkipLogicRule | null;
    if (skipLogic && response) {
      // Evaluate skip logic conditions
      const shouldSkip = evaluateSkipLogic(skipLogic, responseMap);
      if (shouldSkip && response.responseValue) {
        errors.push({
          itemCode: question.itemCode,
          itemName: question.itemName,
          errorType: 'skip_violation',
          message: `${question.itemName} should be skipped based on skip logic`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}

/**
 * Calculate HIPPS code and scoring
 */
export async function calculateHippsCode(assessmentId: string): Promise<ScoringResult> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId },
    include: { responses: true },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const responseMap = new Map(
    assessment.responses.map((r) => [r.itemCode, r.responseCode || r.responseValue])
  );

  // Calculate functional score from GG items
  const functionalScore = calculateFunctionalScore(responseMap);

  // Calculate clinical score from diagnosis and clinical items
  const clinicalScore = calculateClinicalScore(responseMap);

  // Calculate service utilization score
  const serviceUtilizationScore = calculateServiceUtilizationScore(responseMap);

  // Determine clinical grouping based on diagnoses
  const clinicalGrouping = determineClinicalGrouping(responseMap);

  // Determine functional level (Low, Medium, High)
  const functionalLevel = determineFunctionalLevel(functionalScore);

  // Determine comorbidity adjustment
  const comorbidityAdjustment = determineComorbidityAdjustment(responseMap);

  // Generate HIPPS code: 5 characters
  // Position 1: Clinical Grouping (A-J)
  // Position 2: Functional Level (L, M, H)
  // Position 3: Comorbidity Adjustment (N, L, H)
  // Position 4-5: NRS score (01-99)
  const nrsScore = Math.min(99, Math.max(1, Math.round(functionalScore + clinicalScore)));
  const hippsCode = `${clinicalGrouping}${functionalLevel}${comorbidityAdjustment}${nrsScore.toString().padStart(2, '0')}`;

  // Calculate case mix weight
  const caseMixWeight = calculateCaseMixWeight(clinicalGrouping, functionalLevel, comorbidityAdjustment);

  // Update assessment with scoring
  await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      hippsCode,
      clinicalGrouping,
      functionalLevel,
      comorbidityAdjustment,
      caseMixWeight: new Prisma.Decimal(caseMixWeight),
    },
  });

  return {
    hippsCode,
    clinicalGrouping,
    functionalLevel,
    comorbidityAdjustment,
    caseMixWeight,
    functionalScore,
    clinicalScore,
    serviceUtilizationScore,
    calculatedAt: new Date(),
    calculationVersion: '2024.1',
  };
}

// ===========================================
// QUESTION LIBRARY
// ===========================================

/**
 * Get OASIS questions with filtering
 */
export async function getQuestionLibrary(input: QuestionLibraryInput): Promise<{
  questions: OasisQuestion[];
  sections: { code: string; name: string; itemCount: number }[];
}> {
  const { section, assessmentType, search, includeRetired } = input;

  const where: Prisma.OasisQuestionWhereInput = {};

  if (!includeRetired) {
    where.retiredDate = null;
  }

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

  const questions = await prisma.oasisQuestion.findMany({
    where,
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
  });

  // Get section counts
  const sectionCounts = await prisma.oasisQuestion.groupBy({
    by: ['section'],
    where: { retiredDate: null },
    _count: { id: true },
  });

  const sections = Object.entries(OASIS_SECTIONS).map(([code, meta]) => ({
    code,
    name: meta.name,
    itemCount: sectionCounts.find((s) => s.section === code)?._count.id || 0,
  }));

  return { questions, sections };
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

interface ValidationRule {
  ruleType: 'required' | 'conditional' | 'range' | 'consistency' | 'date';
  errorMessage: string;
  severity: 'error' | 'warning';
  condition?: string;
}

interface SkipLogicRule {
  condition: string;
  skipToItem: string;
  reason: string;
}

/**
 * Get the section for an OASIS item based on its code
 */
function getItemSection(itemCode: string): string {
  if (itemCode.startsWith('GG')) return 'functional_abilities';
  if (itemCode.startsWith('M00')) return 'clinical_record';
  if (itemCode.startsWith('M10')) return 'patient_history';
  if (itemCode.startsWith('M11')) return 'living_situation';
  if (itemCode.startsWith('M12')) return 'sensory_status';
  if (itemCode.startsWith('M13')) return 'integumentary_status';
  if (itemCode.startsWith('M14')) return 'respiratory_status';
  if (itemCode.startsWith('M15')) return 'cardiac_status';
  if (itemCode.startsWith('M16')) return 'elimination_status';
  if (itemCode.startsWith('M17')) return 'neuro_emotional';
  if (itemCode.startsWith('M20')) return 'medication_management';
  if (itemCode.startsWith('M21')) return 'care_management';
  if (itemCode.startsWith('M22')) return 'therapy_need';
  return 'unknown';
}

/**
 * Calculate completion percentage based on responses
 */
async function calculateCompletionPercentage(
  assessmentId: string,
  assessmentType: AssessmentType
): Promise<number> {
  const [responseCount, questionCount] = await Promise.all([
    prisma.oasisResponse.count({
      where: {
        assessmentId,
        OR: [
          { responseValue: { not: null } },
          { responseCode: { not: null } },
        ],
      },
    }),
    prisma.oasisQuestion.count({
      where: {
        assessmentTypes: { has: assessmentType },
        retiredDate: null,
      },
    }),
  ]);

  if (questionCount === 0) return 0;
  return Math.round((responseCount / questionCount) * 100);
}

/**
 * Update completion percentage for an assessment
 */
async function updateCompletionPercentage(assessmentId: string): Promise<void> {
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId },
  });

  if (!assessment) return;

  const percentage = await calculateCompletionPercentage(assessmentId, assessment.assessmentType);

  await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: { completionPercentage: percentage },
  });
}

/**
 * Evaluate skip logic for a question
 */
function evaluateSkipLogic(
  skipLogic: SkipLogicRule,
  responseMap: Map<string, OasisResponse>
): boolean {
  // Simple skip logic evaluation
  // In production, this would parse and evaluate complex conditions
  const condition = skipLogic.condition;

  // Example: "M1240 = 0" means skip if M1240 (pain) is No (0)
  const match = condition.match(/(\w+)\s*=\s*['"]?(\w+)['"]?/);
  if (match) {
    const [, itemCode, expectedValue] = match;
    const response = responseMap.get(itemCode);
    return response?.responseCode === expectedValue || response?.responseValue === expectedValue;
  }

  return false;
}

/**
 * Calculate functional score from GG items
 */
function calculateFunctionalScore(responseMap: Map<string, string | null>): number {
  // GG items scoring: 01 (dependent) to 06 (independent)
  // Lower scores = more impaired = higher case mix
  const ggItems = [
    'GG0130A', 'GG0130B', 'GG0130C', 'GG0130E', 'GG0130F', 'GG0130G', 'GG0130H',
    'GG0170A', 'GG0170B', 'GG0170C', 'GG0170D', 'GG0170E', 'GG0170F', 'GG0170G',
    'GG0170I', 'GG0170J', 'GG0170K', 'GG0170L', 'GG0170M', 'GG0170N', 'GG0170O',
    'GG0170P', 'GG0170R', 'GG0170S',
  ];

  let totalScore = 0;
  let itemCount = 0;

  for (const item of ggItems) {
    const value = responseMap.get(item);
    if (value && !['07', '09', '10', '88'].includes(value)) {
      // Convert to numeric (01-06)
      const score = parseInt(value, 10);
      if (!isNaN(score)) {
        // Invert score so lower functional ability = higher score for case mix
        totalScore += 7 - score;
        itemCount++;
      }
    }
  }

  return itemCount > 0 ? totalScore / itemCount * 10 : 0;
}

/**
 * Calculate clinical score from diagnosis and clinical items
 */
function calculateClinicalScore(responseMap: Map<string, string | null>): number {
  let score = 0;

  // Add points for comorbidities and clinical factors
  // M1021: Primary diagnosis severity
  const diagnosisSeverity = responseMap.get('M1021');
  if (diagnosisSeverity) {
    score += parseInt(diagnosisSeverity, 10) * 5;
  }

  // M1033: Risk for hospitalization
  const hospRisk = responseMap.get('M1033');
  if (hospRisk) {
    score += parseInt(hospRisk, 10) * 3;
  }

  // M1300: Skin integrity
  const skinIntegrity = responseMap.get('M1300');
  if (skinIntegrity && skinIntegrity !== '0') {
    score += parseInt(skinIntegrity, 10) * 4;
  }

  // M1400: Dyspnea
  const dyspnea = responseMap.get('M1400');
  if (dyspnea && dyspnea !== '0') {
    score += parseInt(dyspnea, 10) * 3;
  }

  return score;
}

/**
 * Calculate service utilization score
 */
function calculateServiceUtilizationScore(responseMap: Map<string, string | null>): number {
  let score = 0;

  // M2200: Therapy need
  const therapyNeed = responseMap.get('M2200');
  if (therapyNeed === '1') {
    score += 10;
  }

  return score;
}

/**
 * Determine clinical grouping based on primary diagnosis
 */
function determineClinicalGrouping(responseMap: Map<string, string | null>): string {
  // This is a simplified version - actual PDGM logic is more complex
  // Based on primary diagnosis ICD-10 codes

  // Default to group B (MMTA - Other)
  return 'B';
}

/**
 * Determine functional level based on functional score
 */
function determineFunctionalLevel(functionalScore: number): string {
  if (functionalScore >= 40) return 'H'; // High impairment
  if (functionalScore >= 20) return 'M'; // Medium impairment
  return 'L'; // Low impairment
}

/**
 * Determine comorbidity adjustment
 */
function determineComorbidityAdjustment(responseMap: Map<string, string | null>): string {
  // Based on secondary diagnoses and comorbidity interactions
  // This is simplified - actual logic involves specific diagnosis combinations

  return 'N'; // None (default)
}

/**
 * Calculate case mix weight
 */
function calculateCaseMixWeight(
  clinicalGrouping: string,
  functionalLevel: string,
  comorbidityAdjustment: string
): number {
  // Case mix weights are published by CMS annually
  // This is a simplified placeholder
  const baseWeights: Record<string, number> = {
    A: 1.0, B: 0.9, C: 1.1, D: 1.2, E: 1.3,
    F: 1.4, G: 1.5, H: 1.6, I: 1.7, J: 1.8,
  };

  const functionalMultipliers: Record<string, number> = {
    L: 0.8, M: 1.0, H: 1.3,
  };

  const comorbidityMultipliers: Record<string, number> = {
    N: 1.0, L: 1.1, H: 1.2,
  };

  const baseWeight = baseWeights[clinicalGrouping] || 1.0;
  const funcMult = functionalMultipliers[functionalLevel] || 1.0;
  const comorbMult = comorbidityMultipliers[comorbidityAdjustment] || 1.0;

  return Math.round(baseWeight * funcMult * comorbMult * 1000) / 1000;
}

export default {
  createAssessment,
  getAssessment,
  listAssessments,
  updateAssessment,
  deleteAssessment,
  submitForReview,
  reviewAssessment,
  lockAssessment,
  validateAssessment,
  calculateHippsCode,
  getQuestionLibrary,
};
