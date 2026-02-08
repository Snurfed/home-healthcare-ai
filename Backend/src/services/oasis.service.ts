import {
  AssessmentType,
  AssessmentStatus,
  Prisma,
  OasisAssessment,
  OasisResponse,
  OasisQuestion,
} from '../generated/prisma';
import prisma from '../config/prisma';
import {
  CLINICAL_GROUPING_MAPPINGS,
  CLINICAL_GROUP_DESCRIPTIONS,
  FUNCTIONAL_LEVEL_DESCRIPTIONS,
  COMORBIDITY_PAIRS,
  COMORBIDITY_DESCRIPTIONS,
  SERVICE_UTILIZATION_LEVELS,
  ADMISSION_SOURCES,
  OPTIMIZATION_RULES,
  lookupCaseMixWeight,
  calculateEstimatedReimbursement,
  NATIONAL_STANDARDIZED_PAYMENT_30DAY,
  DEFAULT_WAGE_INDEX,
  type OptimizationContext,
} from '../constants/hipps.constants';

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

export interface HIPPSCodeBreakdown {
  position1: { code: string; label: string; description: string };
  position2: { code: string; label: string; description: string };
  position3: { code: string; label: string; description: string };
  position4: { code: string; label: string; description: string };
  position5: { code: string; label: string; description: string };
}

export interface ReimbursementEstimate {
  baseAmount: number;
  wageAdjustedAmount: number;
  totalEstimate: number;
  periodDays: 30 | 60;
  wageIndex: number;
  disclaimer: string;
}

export interface OptimizationSuggestion {
  id: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  category: 'documentation' | 'clinical' | 'coding';
  potentialImpact: string;
}

export interface ClinicalGroupingResult {
  code: string;
  category: string;
  description: string;
  matchedDiagnosis?: string;
  isEarlyTiming: boolean;
  admissionSource: 'institutional' | 'community';
}

export interface ComorbidityResult {
  adjustment: 'N' | 'L' | 'H';
  description: string;
  triggeringDiagnoses?: string[];
  matchedPairDescription?: string;
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

export interface EnhancedScoringResult extends ScoringResult {
  hippsBreakdown: HIPPSCodeBreakdown;
  clinicalGroupingDetails: ClinicalGroupingResult;
  comorbidityDetails: ComorbidityResult;
  estimatedReimbursement: ReimbursementEstimate;
  optimizationSuggestions?: OptimizationSuggestion[];
  validationWarnings?: string[];
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
 * Calculate HIPPS code and scoring (basic version for compatibility)
 */
export async function calculateHippsCode(assessmentId: string): Promise<ScoringResult> {
  const result = await calculateEnhancedHippsCode(assessmentId);
  return {
    hippsCode: result.hippsCode,
    clinicalGrouping: result.clinicalGrouping,
    functionalLevel: result.functionalLevel,
    comorbidityAdjustment: result.comorbidityAdjustment,
    caseMixWeight: result.caseMixWeight,
    functionalScore: result.functionalScore,
    clinicalScore: result.clinicalScore,
    serviceUtilizationScore: result.serviceUtilizationScore,
    calculatedAt: result.calculatedAt,
    calculationVersion: result.calculationVersion,
  };
}

/**
 * Calculate enhanced HIPPS code with full breakdown and reimbursement estimate
 */
export async function calculateEnhancedHippsCode(
  assessmentId: string,
  options: {
    includeOptimizations?: boolean;
    wageIndex?: number;
  } = {}
): Promise<EnhancedScoringResult> {
  const { includeOptimizations = false, wageIndex = DEFAULT_WAGE_INDEX } = options;

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

  // Calculate component scores
  const functionalScore = calculateFunctionalScore(responseMap);
  const clinicalScore = calculateClinicalScore(responseMap);
  const serviceUtilizationScore = calculateServiceUtilizationScore(responseMap);

  // Determine clinical grouping with full details
  const clinicalGroupingDetails = determineClinicalGrouping(responseMap);

  // Determine functional level
  const functionalLevel = determineFunctionalLevel(functionalScore);

  // Determine comorbidity adjustment with full details
  const comorbidityDetails = determineComorbidityAdjustment(responseMap);

  // Determine service utilization level
  const serviceUtilizationLevel = determineServiceUtilizationLevel(serviceUtilizationScore);

  // Determine admission/timing code
  const admissionTimingCode = determineAdmissionTimingCode(
    clinicalGroupingDetails.admissionSource,
    clinicalGroupingDetails.isEarlyTiming
  );

  // Generate the 5-character HIPPS code
  const hippsCode = generateHIPPSCode(
    clinicalGroupingDetails.code,
    functionalLevel,
    comorbidityDetails.adjustment,
    serviceUtilizationLevel,
    admissionTimingCode
  );

  // Generate HIPPS code breakdown
  const hippsBreakdown = generateHIPPSBreakdown(
    clinicalGroupingDetails.code,
    functionalLevel,
    comorbidityDetails.adjustment,
    serviceUtilizationLevel,
    admissionTimingCode
  );

  // Calculate case mix weight using lookup table
  const caseMixWeight = lookupCaseMixWeight(
    clinicalGroupingDetails.code,
    functionalLevel,
    comorbidityDetails.adjustment,
    clinicalGroupingDetails.admissionSource
  );

  // Calculate reimbursement estimate
  const totalEstimate = calculateEstimatedReimbursement(caseMixWeight, wageIndex, 30);
  const estimatedReimbursement: ReimbursementEstimate = {
    baseAmount: NATIONAL_STANDARDIZED_PAYMENT_30DAY,
    wageAdjustedAmount: Math.round(NATIONAL_STANDARDIZED_PAYMENT_30DAY * wageIndex * 100) / 100,
    totalEstimate,
    periodDays: 30,
    wageIndex,
    disclaimer: 'Estimate based on FY2024 rates. Actual payment may vary based on LUPA, outlier adjustments, and other factors.',
  };

  // Generate optimization suggestions if requested
  let optimizationSuggestions: OptimizationSuggestion[] | undefined;
  if (includeOptimizations) {
    optimizationSuggestions = generateOptimizationSuggestions(
      responseMap,
      clinicalGroupingDetails.code,
      functionalLevel,
      comorbidityDetails.adjustment,
      functionalScore
    );
  }

  // Collect validation warnings
  const validationWarnings: string[] = [];
  if (!clinicalGroupingDetails.matchedDiagnosis) {
    validationWarnings.push('No primary diagnosis found - defaulting to MMTA-Other grouping');
  }
  if (functionalScore === 0) {
    validationWarnings.push('No functional items responded - functional score is 0');
  }

  // Update assessment with scoring
  await prisma.oasisAssessment.update({
    where: { id: assessmentId },
    data: {
      hippsCode,
      clinicalGrouping: clinicalGroupingDetails.code,
      functionalLevel,
      comorbidityAdjustment: comorbidityDetails.adjustment,
      caseMixWeight: new Prisma.Decimal(caseMixWeight),
    },
  });

  return {
    hippsCode,
    clinicalGrouping: clinicalGroupingDetails.code,
    functionalLevel,
    comorbidityAdjustment: comorbidityDetails.adjustment,
    caseMixWeight,
    functionalScore,
    clinicalScore,
    serviceUtilizationScore,
    calculatedAt: new Date(),
    calculationVersion: 'PDGM-2024.1',
    hippsBreakdown,
    clinicalGroupingDetails,
    comorbidityDetails,
    estimatedReimbursement,
    optimizationSuggestions,
    validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
  };
}

/**
 * Get HIPPS details for an existing assessment (without recalculating)
 */
export async function getHippsDetails(
  assessmentId: string,
  options: {
    includeOptimizations?: boolean;
    wageIndex?: number;
    recalculate?: boolean;
  } = {}
): Promise<EnhancedScoringResult | null> {
  const { recalculate = false } = options;

  // If recalculate is requested or assessment has no HIPPS code, calculate fresh
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { id: assessmentId },
    include: { responses: true },
  });

  if (!assessment) {
    return null;
  }

  if (recalculate || !assessment.hippsCode) {
    return calculateEnhancedHippsCode(assessmentId, options);
  }

  // Build result from stored data
  const responseMap = new Map(
    assessment.responses.map((r) => [r.itemCode, r.responseCode || r.responseValue])
  );

  // Recalculate component scores for the display
  const functionalScore = calculateFunctionalScore(responseMap);
  const clinicalScore = calculateClinicalScore(responseMap);
  const serviceUtilizationScore = calculateServiceUtilizationScore(responseMap);

  // Parse existing HIPPS code (we know it's 5 characters from earlier check)
  const hippsCode = assessment.hippsCode!;
  const clinicalGroup = hippsCode.charAt(0);
  const funcLevel = hippsCode.charAt(1);
  const comorbAdj = hippsCode.charAt(2) as 'N' | 'L' | 'H';
  const serviceLevel = hippsCode.charAt(3);
  const admTiming = hippsCode.charAt(4);

  // Generate breakdown from stored code
  const hippsBreakdown = generateHIPPSBreakdown(
    clinicalGroup,
    funcLevel,
    comorbAdj,
    serviceLevel,
    admTiming
  );

  // Get detailed grouping info
  const clinicalGroupingDetails = determineClinicalGrouping(responseMap);
  const comorbidityDetails = determineComorbidityAdjustment(responseMap);

  const caseMixWeight = assessment.caseMixWeight?.toNumber() || 1.0;
  const wageIndex = options.wageIndex || DEFAULT_WAGE_INDEX;

  // Calculate reimbursement estimate
  const totalEstimate = calculateEstimatedReimbursement(caseMixWeight, wageIndex, 30);
  const estimatedReimbursement: ReimbursementEstimate = {
    baseAmount: NATIONAL_STANDARDIZED_PAYMENT_30DAY,
    wageAdjustedAmount: Math.round(NATIONAL_STANDARDIZED_PAYMENT_30DAY * wageIndex * 100) / 100,
    totalEstimate,
    periodDays: 30,
    wageIndex,
    disclaimer: 'Estimate based on FY2024 rates. Actual payment may vary based on LUPA, outlier adjustments, and other factors.',
  };

  // Generate optimization suggestions if requested
  let optimizationSuggestions: OptimizationSuggestion[] | undefined;
  if (options.includeOptimizations) {
    optimizationSuggestions = generateOptimizationSuggestions(
      responseMap,
      clinicalGroup,
      funcLevel,
      comorbAdj,
      functionalScore
    );
  }

  return {
    hippsCode,
    clinicalGrouping: clinicalGroup,
    functionalLevel: funcLevel,
    comorbidityAdjustment: comorbAdj,
    caseMixWeight,
    functionalScore,
    clinicalScore,
    serviceUtilizationScore,
    calculatedAt: assessment.updatedAt,
    calculationVersion: 'PDGM-2024.1',
    hippsBreakdown,
    clinicalGroupingDetails,
    comorbidityDetails,
    estimatedReimbursement,
    optimizationSuggestions,
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
    if (!itemCode) return false;
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
 * Returns detailed grouping information for PDGM classification
 */
function determineClinicalGrouping(responseMap: Map<string, string | null>): ClinicalGroupingResult {
  // Get primary diagnosis from M1021 (or similar field storing ICD-10)
  const primaryDiagnosis = responseMap.get('M1021') || responseMap.get('M1021_PRIMARY_DIAG') || '';

  // Get admission source from M1000
  const admissionSourceCode = responseMap.get('M1000') || '01';
  const admissionSourceInfo = ADMISSION_SOURCES.find(s => s.code === admissionSourceCode);
  const isInstitutional = admissionSourceInfo?.isInstitutional ?? false;
  const admissionSource: 'institutional' | 'community' = isInstitutional ? 'institutional' : 'community';

  // "Early" is within 14 days of institutional discharge
  // For simplicity, assume early timing for institutional admissions
  // TODO: In production, calculate based on M0104 (referral) and M0030 (SOC) dates
  const isEarlyTiming = isInstitutional;

  // Match primary diagnosis against ICD-10 patterns
  let matchedGroup: { clinicalGroup: string; category: string; description: string } | null = null;

  for (const mapping of CLINICAL_GROUPING_MAPPINGS) {
    try {
      const regex = new RegExp(mapping.icd10Pattern, 'i');
      if (regex.test(primaryDiagnosis)) {
        matchedGroup = {
          clinicalGroup: mapping.clinicalGroup,
          category: mapping.category,
          description: mapping.description,
        };
        break;
      }
    } catch {
      // Invalid regex pattern, skip
      continue;
    }
  }

  // Default to MMTA-Other if no match
  if (!matchedGroup) {
    matchedGroup = {
      clinicalGroup: '6',
      category: 'MMTA-Other',
      description: 'Medication Management, Teaching, Assessment - Other',
    };
  }

  // Convert numeric group to letter code based on timing
  // Odd letters (A, C, E, G, I, K) = Early, Even letters (B, D, F, H, J, L) = Late
  const clinicalGroupLetterMap: Record<string, { early: string; late: string }> = {
    '1': { early: 'A', late: 'B' }, // Neuro/Stroke
    '2': { early: 'C', late: 'D' }, // Wounds
    '3': { early: 'E', late: 'F' }, // Complex Medical
    '4': { early: 'G', late: 'H' }, // Behavioral Health
    '5': { early: 'I', late: 'J' }, // MS/Rehab
    '6': { early: 'K', late: 'L' }, // MMTA-Other
  };

  const letterMapping = clinicalGroupLetterMap[matchedGroup.clinicalGroup] || { early: 'K', late: 'L' };
  const groupCode = isEarlyTiming ? letterMapping.early : letterMapping.late;

  return {
    code: groupCode,
    category: matchedGroup.category,
    description: CLINICAL_GROUP_DESCRIPTIONS[groupCode] || matchedGroup.description,
    matchedDiagnosis: primaryDiagnosis || undefined,
    isEarlyTiming,
    admissionSource,
  };
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
 * Determine comorbidity adjustment based on diagnosis interactions
 * Returns detailed comorbidity information including triggering diagnoses
 */
function determineComorbidityAdjustment(responseMap: Map<string, string | null>): ComorbidityResult {
  // Get primary diagnosis
  const primaryDiagnosis = responseMap.get('M1021') || responseMap.get('M1021_PRIMARY_DIAG') || '';

  // Get secondary diagnoses from M1023 (typically stored as comma-separated or in multiple fields)
  const secondaryDiagnosesRaw = responseMap.get('M1023') || responseMap.get('M1023_SECONDARY_DIAG') || '';
  const secondaryDiagnoses = secondaryDiagnosesRaw
    .split(/[,;|]/)
    .map(d => d.trim())
    .filter(d => d.length > 0);

  // Also check individual secondary diagnosis fields if they exist
  for (let i = 1; i <= 6; i++) {
    const diagCode = responseMap.get(`M1023_${i}`) || responseMap.get(`M1023${String.fromCharCode(64 + i)}`);
    if (diagCode && diagCode.trim()) {
      secondaryDiagnoses.push(diagCode.trim());
    }
  }

  // Check all diagnoses together
  const allDiagnoses = [primaryDiagnosis, ...secondaryDiagnoses].filter(d => d.length > 0);

  // Look for comorbidity pair matches
  let bestAdjustment: 'N' | 'L' | 'H' = 'N';
  let triggeringDiagnoses: string[] = [];
  let matchedPairDescription: string | undefined;

  for (const pair of COMORBIDITY_PAIRS) {
    // Check if any diagnosis matches primary pattern
    let primaryMatched = false;
    let matchedPrimary = '';
    for (const pattern of pair.primary) {
      try {
        const regex = new RegExp(pattern, 'i');
        for (const diag of allDiagnoses) {
          if (regex.test(diag)) {
            primaryMatched = true;
            matchedPrimary = diag;
            break;
          }
        }
        if (primaryMatched) break;
      } catch {
        continue;
      }
    }

    if (!primaryMatched) continue;

    // Check if any diagnosis matches secondary pattern
    let secondaryMatched = false;
    let matchedSecondary = '';
    for (const pattern of pair.secondary) {
      try {
        const regex = new RegExp(pattern, 'i');
        for (const diag of allDiagnoses) {
          if (regex.test(diag) && diag !== matchedPrimary) {
            secondaryMatched = true;
            matchedSecondary = diag;
            break;
          }
        }
        if (secondaryMatched) break;
      } catch {
        continue;
      }
    }

    if (primaryMatched && secondaryMatched) {
      // Found a comorbidity pair match
      if (pair.adjustment === 'H' || (pair.adjustment === 'L' && bestAdjustment === 'N')) {
        bestAdjustment = pair.adjustment;
        triggeringDiagnoses = [matchedPrimary, matchedSecondary];
        matchedPairDescription = pair.description;
      }
      // If we found a High adjustment, we can stop looking
      if (bestAdjustment === 'H') break;
    }
  }

  return {
    adjustment: bestAdjustment,
    description: COMORBIDITY_DESCRIPTIONS[bestAdjustment] ?? 'No Comorbidity Adjustment',
    triggeringDiagnoses: triggeringDiagnoses.length > 0 ? triggeringDiagnoses : undefined,
    matchedPairDescription,
  };
}

/**
 * Determine service utilization level for Position 4 of HIPPS code
 */
function determineServiceUtilizationLevel(serviceScore: number): string {
  // Map service utilization score to level code
  if (serviceScore >= 20) return 'E'; // Very High
  if (serviceScore >= 14) return 'D'; // High
  if (serviceScore >= 10) return 'C'; // Moderate
  if (serviceScore >= 6) return 'B'; // Low
  return 'A'; // Minimal
}

/**
 * Determine admission/timing code for Position 5 of HIPPS code
 */
function determineAdmissionTimingCode(
  admissionSource: 'institutional' | 'community',
  isEarlyTiming: boolean
): string {
  // Position 5 encodes admission source + timing
  // 1 = Community, Early
  // 2 = Community, Late
  // 3 = Institutional, Early
  // 4 = Institutional, Late
  if (admissionSource === 'community') {
    return isEarlyTiming ? '1' : '2';
  } else {
    return isEarlyTiming ? '3' : '4';
  }
}

/**
 * Generate proper 5-character HIPPS code
 */
function generateHIPPSCode(
  clinicalGroupCode: string,
  functionalLevel: string,
  comorbidityAdjustment: string,
  serviceUtilizationLevel: string,
  admissionTimingCode: string
): string {
  return `${clinicalGroupCode}${functionalLevel}${comorbidityAdjustment}${serviceUtilizationLevel}${admissionTimingCode}`;
}

/**
 * Generate HIPPS code breakdown with descriptions
 */
function generateHIPPSBreakdown(
  clinicalGroupCode: string,
  functionalLevel: string,
  comorbidityAdjustment: string,
  serviceUtilizationLevel: string,
  admissionTimingCode: string
): HIPPSCodeBreakdown {
  const serviceLevel = SERVICE_UTILIZATION_LEVELS.find(l => l.code === serviceUtilizationLevel);

  const admissionTimingDescriptions: Record<string, string> = {
    '1': 'Community admission, Early period',
    '2': 'Community admission, Late period',
    '3': 'Institutional admission, Early period (within 14 days)',
    '4': 'Institutional admission, Late period',
  };

  return {
    position1: {
      code: clinicalGroupCode,
      label: 'Clinical Group',
      description: CLINICAL_GROUP_DESCRIPTIONS[clinicalGroupCode] || 'Unknown clinical group',
    },
    position2: {
      code: functionalLevel,
      label: 'Functional Level',
      description: FUNCTIONAL_LEVEL_DESCRIPTIONS[functionalLevel] || 'Unknown functional level',
    },
    position3: {
      code: comorbidityAdjustment,
      label: 'Comorbidity',
      description: COMORBIDITY_DESCRIPTIONS[comorbidityAdjustment] || 'Unknown comorbidity adjustment',
    },
    position4: {
      code: serviceUtilizationLevel,
      label: 'Service Utilization',
      description: serviceLevel?.description || 'Unknown service utilization level',
    },
    position5: {
      code: admissionTimingCode,
      label: 'Admission/Timing',
      description: admissionTimingDescriptions[admissionTimingCode] || 'Unknown admission timing',
    },
  };
}

/**
 * Generate optimization suggestions based on assessment data
 */
function generateOptimizationSuggestions(
  responseMap: Map<string, string | null>,
  clinicalGroupCode: string,
  functionalLevel: string,
  comorbidityAdjustment: string,
  functionalScore: number
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Build context for optimization rules
  const primaryDiagnosis = responseMap.get('M1021') || responseMap.get('M1021_PRIMARY_DIAG') || undefined;
  const secondaryDiagnosesRaw = responseMap.get('M1023') || responseMap.get('M1023_SECONDARY_DIAG') || '';
  const secondaryDiagnoses = secondaryDiagnosesRaw
    .split(/[,;|]/)
    .map(d => d.trim())
    .filter(d => d.length > 0);

  const admissionSource = responseMap.get('M1000');
  const hasWoundCare = responseMap.get('M1300') !== '0' && responseMap.get('M1300') !== null;
  const hasTherapyNeed = responseMap.get('M2200') === '1';

  const context: OptimizationContext = {
    clinicalGroup: clinicalGroupCode,
    functionalLevel,
    comorbidityAdjustment,
    primaryDiagnosis,
    secondaryDiagnoses,
    functionalScore,
    admissionSource: admissionSource || undefined,
    hasWoundCare,
    hasTherapyNeed,
  };

  // Evaluate each optimization rule
  for (const rule of OPTIMIZATION_RULES) {
    try {
      if (rule.condition(context)) {
        suggestions.push({
          id: rule.id,
          suggestion: rule.suggestion,
          priority: rule.priority,
          category: rule.category,
          potentialImpact: rule.potentialImpact,
        });
      }
    } catch {
      // Skip rules that fail to evaluate
      continue;
    }
  }

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
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
  calculateEnhancedHippsCode,
  getHippsDetails,
  getQuestionLibrary,
};
