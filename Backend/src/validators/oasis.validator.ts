import { z } from 'zod';
import { AssessmentType, AssessmentStatus } from '../generated/prisma';

// ===========================================
// ENUMS
// ===========================================

export const AssessmentTypeEnum = z.enum([
  'START_OF_CARE',
  'RESUMPTION_OF_CARE',
  'RECERTIFICATION',
  'FOLLOW_UP',
  'TRANSFER_TO_INPATIENT',
  'DISCHARGE_FROM_AGENCY',
  'DEATH_AT_HOME',
]);

export const AssessmentStatusEnum = z.enum([
  'DRAFT',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'NEEDS_CORRECTION',
  'APPROVED',
  'SUBMITTED',
  'LOCKED',
]);

export const OasisSectionEnum = z.enum([
  'clinical_record',
  'patient_tracking',
  'patient_history',
  'living_situation',
  'sensory_status',
  'pain_assessment',
  'integumentary_status',
  'respiratory_status',
  'cardiac_status',
  'elimination_status',
  'neuro_emotional',
  'functional_abilities',
  'medication_management',
  'care_management',
  'therapy_need',
]);

export const SourceTypeEnum = z.enum(['manual', 'voice', 'ocr', 'emr']);

export const ResponseTypeEnum = z.enum([
  'single_select',
  'multi_select',
  'numeric',
  'date',
  'text',
  'icd10',
]);

// ===========================================
// OASIS ITEM RESPONSE SCHEMAS
// ===========================================

/**
 * Single OASIS item response
 */
export const OasisItemResponseSchema = z.object({
  itemCode: z.string()
    .min(2, 'Item code must be at least 2 characters')
    .max(10, 'Item code must be at most 10 characters')
    .regex(/^[A-Z]{1,2}\d{4}[A-Z]?$/, 'Invalid OASIS item code format (e.g., M1021, GG0130A)'),

  responseValue: z.string().max(500).optional(),
  responseCode: z.string().max(10).optional(),
  responseText: z.string().max(5000).optional(),
  responseNumeric: z.number().optional(),
  responseDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  responseJson: z.record(z.unknown()).optional(),

  // Auto-population metadata
  confidence: z.number().min(0).max(1).optional(),
  sourceType: SourceTypeEnum.optional(),
  sourceTranscriptionId: z.string().uuid().optional(),
  sourceText: z.string().max(2000).optional(),
}).refine(
  (data) => data.responseValue || data.responseCode || data.responseText ||
            data.responseNumeric !== undefined || data.responseDate || data.responseJson,
  { message: 'At least one response field must be provided' }
);

export type OasisItemResponse = z.infer<typeof OasisItemResponseSchema>;

// ===========================================
// ASSESSMENT CRUD SCHEMAS
// ===========================================

/**
 * Create assessment request
 */
export const CreateAssessmentSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  episodeId: z.string().uuid('Invalid episode ID'),
  assessmentType: AssessmentTypeEnum,
  visitId: z.string().uuid('Invalid visit ID').optional(),
  startOfCareDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  resumptionOfCareDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  copyFromAssessmentId: z.string().uuid('Invalid assessment ID').optional(),
}).refine(
  (data) => {
    // If START_OF_CARE, startOfCareDate is recommended
    if (data.assessmentType === 'START_OF_CARE' && !data.startOfCareDate) {
      return true; // Warning, not error
    }
    // If RESUMPTION_OF_CARE, resumptionOfCareDate is recommended
    if (data.assessmentType === 'RESUMPTION_OF_CARE' && !data.resumptionOfCareDate) {
      return true; // Warning, not error
    }
    return true;
  },
  { message: 'Start date or resumption date recommended for the selected assessment type' }
);

export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;

/**
 * Update assessment request
 */
export const UpdateAssessmentSchema = z.object({
  section: OasisSectionEnum.optional(),
  items: z.array(OasisItemResponseSchema).max(50, 'Cannot update more than 50 items at once').optional(),
  status: AssessmentStatusEnum.optional(),
  assessmentCompletionDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
}).refine(
  (data) => data.section || data.items || data.status || data.assessmentCompletionDate,
  { message: 'At least one field must be provided for update' }
);

export type UpdateAssessmentInput = z.infer<typeof UpdateAssessmentSchema>;

/**
 * Submit for review request
 */
export const SubmitForReviewSchema = z.object({
  supervisorId: z.string().uuid('Invalid supervisor ID').optional(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  attestation: z.boolean().refine((val) => val === true, {
    message: 'Clinician attestation is required to submit for review',
  }),
});

export type SubmitForReviewInput = z.infer<typeof SubmitForReviewSchema>;

/**
 * Review assessment request (approve/reject)
 */
export const ReviewAssessmentSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  correctionReason: z.string().max(1000, 'Correction reason cannot exceed 1000 characters').optional(),
}).refine(
  (data) => {
    // If rejecting, correction reason is required
    if (!data.approved && !data.correctionReason) {
      return false;
    }
    return true;
  },
  { message: 'Correction reason is required when rejecting an assessment' }
);

export type ReviewAssessmentInput = z.infer<typeof ReviewAssessmentSchema>;

// ===========================================
// QUERY SCHEMAS
// ===========================================

/**
 * List assessments query parameters
 */
export const ListAssessmentsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  patientId: z.string().uuid('Invalid patient ID').optional(),
  episodeId: z.string().uuid('Invalid episode ID').optional(),
  assessmentType: AssessmentTypeEnum.optional(),
  status: AssessmentStatusEnum.optional(),
  clinicianId: z.string().uuid('Invalid clinician ID').optional(),
  startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  sortBy: z.enum(['createdAt', 'completionDate', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeDeleted: z.string().transform((val) => val === 'true').optional().default('false'),
});

export type ListAssessmentsQuery = z.infer<typeof ListAssessmentsQuerySchema>;

/**
 * Question library query parameters
 */
export const QuestionLibraryQuerySchema = z.object({
  section: OasisSectionEnum.optional(),
  assessmentType: AssessmentTypeEnum.optional(),
  search: z.string().min(2, 'Search term must be at least 2 characters').max(100).optional(),
  includeRetired: z.string().transform((val) => val === 'true').optional().default('false'),
});

export type QuestionLibraryQuery = z.infer<typeof QuestionLibraryQuerySchema>;

// ===========================================
// OASIS ITEM CODE VALIDATION
// ===========================================

/**
 * Valid OASIS item code patterns
 */
const VALID_ITEM_PATTERNS = [
  /^M0[0-9]{3}[A-Z]?$/, // M0010-M0999
  /^M1[0-9]{3}[A-Z]?$/, // M1000-M1999
  /^M2[0-9]{3}[A-Z]?$/, // M2000-M2999
  /^GG0[0-9]{3}[A-Z]?$/, // GG0100-GG0999
];

export function isValidOasisItemCode(code: string): boolean {
  return VALID_ITEM_PATTERNS.some((pattern) => pattern.test(code));
}

// ===========================================
// SPECIFIC OASIS ITEM VALIDATORS
// ===========================================

/**
 * M0069 - Gender
 */
export const M0069Schema = z.object({
  itemCode: z.literal('M0069'),
  responseCode: z.enum(['1', '2'], {
    errorMap: () => ({ message: 'Gender must be 1 (Male) or 2 (Female)' }),
  }),
});

/**
 * M1021 - Primary Diagnosis Severity
 */
export const M1021Schema = z.object({
  itemCode: z.literal('M1021'),
  responseCode: z.enum(['0', '1', '2', '3', '4'], {
    errorMap: () => ({ message: 'Severity must be 0-4' }),
  }),
});

/**
 * M1240 - Pain Assessment
 */
export const M1240Schema = z.object({
  itemCode: z.literal('M1240'),
  responseCode: z.enum(['0', '1', '2', '3', '4'], {
    errorMap: () => ({ message: 'Pain frequency must be 0-4' }),
  }),
});

/**
 * GG Functional Items (GG0130, GG0170)
 */
export const GGFunctionalItemSchema = z.object({
  itemCode: z.string().regex(/^GG0(130|170)[A-Z]$/, 'Invalid GG item code'),
  responseCode: z.enum(['01', '02', '03', '04', '05', '06', '07', '09', '10', '88'], {
    errorMap: () => ({
      message: 'Functional score must be 01-06, 07 (refused), 09 (N/A), 10 (env), or 88 (medical)',
    }),
  }),
});

/**
 * M1300 - Skin Integrity
 */
export const M1300Schema = z.object({
  itemCode: z.literal('M1300'),
  responseCode: z.enum(['0', '1', '2', '3'], {
    errorMap: () => ({ message: 'Skin integrity must be 0-3' }),
  }),
});

/**
 * M1400 - Dyspnea
 */
export const M1400Schema = z.object({
  itemCode: z.literal('M1400'),
  responseCode: z.enum(['0', '1', '2', '3', '4'], {
    errorMap: () => ({ message: 'Dyspnea severity must be 0-4' }),
  }),
});

/**
 * M1700 - Cognitive Function
 */
export const M1700Schema = z.object({
  itemCode: z.literal('M1700'),
  responseCode: z.enum(['0', '1', '2', '3', '4'], {
    errorMap: () => ({ message: 'Cognitive function must be 0-4' }),
  }),
});

/**
 * M1730 - PHQ-2 Depression Screening
 */
export const M1730Schema = z.object({
  itemCode: z.literal('M1730'),
  responseJson: z.object({
    littleInterest: z.number().int().min(0).max(3),
    feelingDown: z.number().int().min(0).max(3),
    totalScore: z.number().int().min(0).max(6),
    requiresPHQ9: z.boolean(),
  }),
});

// ===========================================
// BATCH VALIDATION
// ===========================================

/**
 * Validate multiple OASIS item responses
 */
export function validateOasisResponses(
  responses: OasisItemResponse[]
): { valid: OasisItemResponse[]; errors: { itemCode: string; errors: string[] }[] } {
  const valid: OasisItemResponse[] = [];
  const errors: { itemCode: string; errors: string[] }[] = [];

  for (const response of responses) {
    // First validate against general schema
    const generalResult = OasisItemResponseSchema.safeParse(response);

    if (!generalResult.success) {
      errors.push({
        itemCode: response.itemCode,
        errors: generalResult.error.errors.map((e) => e.message),
      });
      continue;
    }

    // Then validate against item-specific schema if available
    const itemSpecificErrors = validateItemSpecific(response);

    if (itemSpecificErrors.length > 0) {
      errors.push({
        itemCode: response.itemCode,
        errors: itemSpecificErrors,
      });
      continue;
    }

    valid.push(response);
  }

  return { valid, errors };
}

/**
 * Item-specific validation
 */
function validateItemSpecific(response: OasisItemResponse): string[] {
  const errors: string[] = [];

  // Add item-specific validation based on item code
  switch (response.itemCode) {
    case 'M0069': {
      const result = M0069Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1021': {
      const result = M1021Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1240': {
      const result = M1240Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1300': {
      const result = M1300Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1400': {
      const result = M1400Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1700': {
      const result = M1700Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    case 'M1730': {
      const result = M1730Schema.safeParse(response);
      if (!result.success) {
        errors.push(...result.error.errors.map((e) => e.message));
      }
      break;
    }
    default:
      // GG items
      if (response.itemCode.match(/^GG0(130|170)[A-Z]$/)) {
        const result = GGFunctionalItemSchema.safeParse(response);
        if (!result.success) {
          errors.push(...result.error.errors.map((e) => e.message));
        }
      }
      break;
  }

  return errors;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  // Schemas
  OasisItemResponseSchema,
  CreateAssessmentSchema,
  UpdateAssessmentSchema,
  SubmitForReviewSchema,
  ReviewAssessmentSchema,
  ListAssessmentsQuerySchema,
  QuestionLibraryQuerySchema,

  // Enums
  AssessmentTypeEnum,
  AssessmentStatusEnum,
  OasisSectionEnum,
  SourceTypeEnum,
  ResponseTypeEnum,

  // Functions
  isValidOasisItemCode,
  validateOasisResponses,
};
