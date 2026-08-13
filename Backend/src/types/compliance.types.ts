/**
 * Medicare Compliance Types
 *
 * Type definitions for Medicare compliance validation, OASIS validation,
 * and billing code suggestions in home health care.
 */

// ===========================================
// SEVERITY & STATUS ENUMS
// ===========================================

export type ComplianceSeverity = 'error' | 'warning' | 'info';

export type ComplianceCategory =
  | 'homebound_status'
  | 'skilled_care'
  | 'oasis_completeness'
  | 'face_to_face'
  | 'certification_period'
  | 'documentation'
  | 'billing'
  | 'medical_necessity';

export type DenialReason =
  | 'HOMEBOUND_NOT_DOCUMENTED'
  | 'SKILLED_CARE_NOT_JUSTIFIED'
  | 'FACE_TO_FACE_MISSING'
  | 'FACE_TO_FACE_TIMING'
  | 'CERTIFICATION_EXPIRED'
  | 'OASIS_INCOMPLETE'
  | 'OASIS_INCONSISTENT'
  | 'DUPLICATE_CLAIM'
  | 'MEDICAL_NECESSITY'
  | 'INSUFFICIENT_PROGRESS'
  | 'FREQUENCY_EXCEEDS_PLAN'
  | 'SERVICE_NOT_COVERED'
  | 'PRIOR_AUTH_MISSING';

// ===========================================
// COMPLIANCE ISSUE
// ===========================================

export interface ComplianceIssue {
  /** Unique identifier for this issue */
  id: string;
  /** Field or OASIS item code this issue relates to */
  field: string;
  /** CMS or internal error code */
  code: string;
  /** Severity level: error (blocking), warning (review), info (advisory) */
  severity: ComplianceSeverity;
  /** Category of compliance concern */
  category: ComplianceCategory;
  /** Human-readable description of the issue */
  message: string;
  /** Actionable suggestion to resolve the issue */
  suggestion: string;
  /** CMS edit number if applicable */
  cmsEditNumber?: string;
  /** Related denial reason codes */
  denialRisk?: DenialReason;
  /** Additional context or documentation requirements */
  context?: string;
  /** Source of the issue (validation rule, cross-check, etc.) */
  source: string;
}

// ===========================================
// VALIDATION RESULT
// ===========================================

export interface ValidationResult {
  /** Overall validation status */
  valid: boolean;
  /** List of compliance issues found */
  issues: ComplianceIssue[];
  /** Compliance score (0-100) */
  score: number;
  /** Breakdown of issues by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  /** Timestamp of validation */
  validatedAt: string;
  /** Entity that was validated */
  entityType: 'visit' | 'assessment' | 'episode' | 'patient';
  /** ID of the validated entity */
  entityId: string;
}

// ===========================================
// BILLING CODE SUGGESTION
// ===========================================

export interface BillingCodeSuggestion {
  /** ICD-10 or HCPCS code */
  code: string;
  /** Code type */
  codeType: 'ICD10' | 'HCPCS';
  /** Human-readable description */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Rationale for suggesting this code */
  rationale: string;
  /** Whether this is the primary code */
  isPrimary?: boolean;
  /** Specificity level (more specific codes are preferred) */
  specificity: 'high' | 'medium' | 'low';
  /** Potential upcoding/downcoding flag */
  codingRisk?: {
    type: 'upcoding' | 'downcoding';
    severity: 'low' | 'medium' | 'high';
    explanation: string;
    alternativeCode?: string;
  };
  /** Supporting documentation excerpts */
  supportingEvidence?: string[];
  /** Related OASIS items that support this code */
  relatedOasisItems?: string[];
}

export interface BillingSuggestionResult {
  /** Visit or assessment ID */
  entityId: string;
  /** Suggested diagnosis codes */
  diagnosisCodes: BillingCodeSuggestion[];
  /** Suggested procedure codes */
  procedureCodes: BillingCodeSuggestion[];
  /** Overall coding confidence */
  overallConfidence: number;
  /** Warnings about coding patterns */
  codingWarnings: CodingWarning[];
  /** Timestamp of analysis */
  analyzedAt: string;
}

export interface CodingWarning {
  code: string;
  type: 'upcoding_risk' | 'downcoding_risk' | 'specificity' | 'consistency' | 'frequency';
  message: string;
  recommendation: string;
}

// ===========================================
// OASIS VALIDATION TYPES
// ===========================================

export interface OasisEditCheck {
  /** CMS edit check ID */
  editId: string;
  /** Type of edit check */
  editType: 'fatal' | 'warning' | 'soft';
  /** OASIS item(s) involved */
  items: string[];
  /** CMS edit description */
  description: string;
  /** Edit check category */
  category: 'cross_field' | 'skip_pattern' | 'date_range' | 'logical' | 'required';
}

export interface OasisValidationResult extends ValidationResult {
  /** OASIS-specific validation details */
  oasisDetails: {
    /** Assessment ID */
    assessmentId: string;
    /** Assessment type */
    assessmentType: string;
    /** Completion percentage */
    completionPercentage: number;
    /** Sections with issues */
    sectionsWithIssues: string[];
    /** CMS edit check results */
    editChecks: OasisEditCheckResult[];
    /** Skip pattern violations */
    skipPatternViolations: SkipPatternViolation[];
    /** Date range issues */
    dateRangeIssues: DateRangeIssue[];
  };
}

export interface OasisEditCheckResult {
  /** Edit check definition */
  editCheck: OasisEditCheck;
  /** Whether the check passed */
  passed: boolean;
  /** Actual values found */
  actualValues: Record<string, string | null>;
  /** Expected values or conditions */
  expectedCondition: string;
}

export interface SkipPatternViolation {
  /** The triggering item code */
  triggerItem: string;
  /** The triggered (skipped) item code */
  skippedItem: string;
  /** Expected skip condition */
  expectedCondition: string;
  /** Actual values */
  actualValues: Record<string, string | null>;
  /** CMS guideline reference */
  guideline: string;
}

export interface DateRangeIssue {
  /** Date field in question */
  dateField: string;
  /** The invalid date value */
  dateValue: string;
  /** Type of issue */
  issueType: 'future_date' | 'past_date' | 'out_of_range' | 'sequence_error';
  /** Expected date range or sequence */
  expectedRange: string;
  /** CMS guideline reference */
  guideline: string;
}

// ===========================================
// HOMEBOUND STATUS TYPES
// ===========================================

export interface HomeboundCheckInput {
  /** Patient ID */
  patientId: string;
  /** Assessment or visit ID */
  assessmentId?: string;
  visitId?: string;
  /** Documented reasons for homebound status */
  documentedReasons?: string[];
  /** Functional limitations from OASIS */
  functionalLimitations?: {
    mobility: string;
    ambulation: string;
    transferring: string;
    dme: string[];
  };
  /** Recent visit notes */
  visitNotes?: string[];
}

export interface HomeboundCheckResult {
  /** Overall homebound status validity */
  isValid: boolean;
  /** Confidence in the determination */
  confidence: number;
  /** Primary qualifying criteria met */
  qualifyingCriteria: string[];
  /** Missing documentation */
  missingDocumentation: string[];
  /** Compliance issues */
  issues: ComplianceIssue[];
  /** Recommended documentation improvements */
  recommendations: string[];
  /** Medicare Benefit Policy Manual reference */
  policyReference: string;
}

// ===========================================
// SKILLED CARE TYPES
// ===========================================

export interface SkilledCareRequirement {
  /** Type of skilled service */
  serviceType: 'nursing' | 'pt' | 'ot' | 'slp' | 'msw' | 'aide';
  /** Whether skilled care is required */
  required: boolean;
  /** Justification for requirement */
  justification: string;
  /** Supporting diagnoses */
  supportingDiagnoses: string[];
  /** Relevant OASIS findings */
  relevantFindings: string[];
}

export interface SkilledCareValidationResult {
  /** Overall skilled care necessity validated */
  isValid: boolean;
  /** Individual service requirements */
  services: SkilledCareRequirement[];
  /** Compliance issues */
  issues: ComplianceIssue[];
  /** Documentation recommendations */
  recommendations: string[];
}

// ===========================================
// FACE-TO-FACE TYPES
// ===========================================

export interface FaceToFaceRequirement {
  /** Whether F2F is required for this episode */
  required: boolean;
  /** Encounter date if documented */
  encounterDate?: string;
  /** Certifying physician NPI */
  physicianNpi?: string;
  /** Whether timing requirements are met */
  timingValid: boolean;
  /** Content requirements checklist */
  contentRequirements: {
    clinicalFindings: boolean;
    homeboundStatus: boolean;
    skilledCareNeed: boolean;
    physicianSignature: boolean;
  };
  /** Compliance issues */
  issues: ComplianceIssue[];
}

// ===========================================
// CERTIFICATION PERIOD TYPES
// ===========================================

export interface CertificationPeriodValidation {
  /** Current certification period dates */
  currentPeriod: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  /** Whether recertification is needed */
  recertificationNeeded: boolean;
  /** Recertification deadline */
  recertificationDeadline?: string;
  /** Whether period dates are valid */
  datesValid: boolean;
  /** Compliance issues */
  issues: ComplianceIssue[];
}

// ===========================================
// COMMON DENIAL REASONS
// ===========================================

export const COMMON_DENIAL_REASONS: Record<DenialReason, {
  description: string;
  preventionTips: string[];
  documentationRequired: string[];
}> = {
  HOMEBOUND_NOT_DOCUMENTED: {
    description: 'Patient homebound status not adequately documented',
    preventionTips: [
      'Document specific physical/mental conditions limiting mobility',
      'Describe effort and assistance needed to leave home',
      'Note if leaving home is medically contraindicated',
    ],
    documentationRequired: [
      'Specific functional limitations',
      'Mobility status with assistive devices',
      'Taxing effort description',
      'Medical contraindications if applicable',
    ],
  },
  SKILLED_CARE_NOT_JUSTIFIED: {
    description: 'Medical necessity for skilled services not demonstrated',
    preventionTips: [
      'Document complexity requiring skilled assessment',
      'Show why non-skilled care is insufficient',
      'Link skilled services to physician orders',
    ],
    documentationRequired: [
      'Clinical complexity justification',
      'Skilled intervention details',
      'Patient response to treatment',
      'Progress toward goals',
    ],
  },
  FACE_TO_FACE_MISSING: {
    description: 'Face-to-face encounter documentation not present',
    preventionTips: [
      'Obtain F2F within 90 days before or 30 days after SOC',
      'Ensure certifying physician documents encounter',
      'Include all required content elements',
    ],
    documentationRequired: [
      'F2F encounter date',
      'Clinical findings',
      'Homebound status attestation',
      'Skilled care need documentation',
      'Physician signature',
    ],
  },
  FACE_TO_FACE_TIMING: {
    description: 'Face-to-face encounter outside required timeframe',
    preventionTips: [
      'F2F must be within 90 days before SOC or 30 days after',
      'Track certification timeline proactively',
      'Schedule F2F encounters early in referral process',
    ],
    documentationRequired: [
      'F2F date within valid window',
      'SOC date correlation',
    ],
  },
  CERTIFICATION_EXPIRED: {
    description: 'Episode certification period has expired',
    preventionTips: [
      'Track 60-day certification periods',
      'Begin recertification process 5+ days before expiration',
      'Ensure physician signature before period ends',
    ],
    documentationRequired: [
      'Valid certification dates',
      'Recertification documentation',
      'Physician signature with date',
    ],
  },
  OASIS_INCOMPLETE: {
    description: 'OASIS assessment missing required items',
    preventionTips: [
      'Complete all required items for assessment type',
      'Validate before submission',
      'Address all edit check errors',
    ],
    documentationRequired: [
      'All required OASIS items per assessment type',
      'Skip pattern compliance',
      'Valid response values',
    ],
  },
  OASIS_INCONSISTENT: {
    description: 'OASIS responses contain logical inconsistencies',
    preventionTips: [
      'Review cross-field logic before submission',
      'Ensure functional scores align with narrative',
      'Verify diagnosis codes match assessments',
    ],
    documentationRequired: [
      'Consistent cross-field responses',
      'Matching functional assessments',
      'Aligned clinical documentation',
    ],
  },
  DUPLICATE_CLAIM: {
    description: 'Claim duplicates a previously submitted claim',
    preventionTips: [
      'Check claim status before resubmission',
      'Use unique claim identifiers',
      'Review prior claims for same period',
    ],
    documentationRequired: [
      'Unique claim submission',
      'Corrected claim if needed',
    ],
  },
  MEDICAL_NECESSITY: {
    description: 'Services not medically necessary',
    preventionTips: [
      'Document clinical justification for each service',
      'Link services to specific conditions/goals',
      'Show why services cannot be safely reduced',
    ],
    documentationRequired: [
      'Medical necessity documentation',
      'Clinical rationale',
      'Treatment goals',
    ],
  },
  INSUFFICIENT_PROGRESS: {
    description: 'Patient not making sufficient progress toward goals',
    preventionTips: [
      'Document measurable progress or reason for plateau',
      'Adjust goals if patient condition changes',
      'Explain skilled maintenance programs if applicable',
    ],
    documentationRequired: [
      'Progress notes with measurable outcomes',
      'Goal updates if needed',
      'Skilled maintenance justification',
    ],
  },
  FREQUENCY_EXCEEDS_PLAN: {
    description: 'Visit frequency exceeds plan of care authorization',
    preventionTips: [
      'Match visits to POC frequencies',
      'Update POC before increasing visits',
      'Document medical necessity for frequency changes',
    ],
    documentationRequired: [
      'Current POC with frequencies',
      'Order for frequency change if applicable',
    ],
  },
  SERVICE_NOT_COVERED: {
    description: 'Service type not covered by Medicare',
    preventionTips: [
      'Verify Medicare coverage for services',
      'Check LCD/NCD requirements',
      'Document why service is medically necessary',
    ],
    documentationRequired: [
      'Service coverage verification',
      'Medical necessity documentation',
    ],
  },
  PRIOR_AUTH_MISSING: {
    description: 'Required prior authorization not obtained',
    preventionTips: [
      'Check MAC requirements for prior auth',
      'Submit auth requests before service delivery',
      'Maintain auth documentation',
    ],
    documentationRequired: [
      'Prior authorization approval',
      'Auth reference number',
    ],
  },
};

// ===========================================
// API REQUEST/RESPONSE TYPES
// ===========================================

export interface ValidateVisitRequest {
  visitId: string;
  includeOasisCheck?: boolean;
  includeBillingCheck?: boolean;
}

export interface ValidateAssessmentRequest {
  assessmentId: string;
  validateEditChecks?: boolean;
  validateSkipPatterns?: boolean;
  validateDateRanges?: boolean;
}

export interface HomeboundCheckRequest {
  patientId: string;
  assessmentId?: string;
  visitId?: string;
  includeRecommendations?: boolean;
}
