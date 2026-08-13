/**
 * OASIS Validation Service
 *
 * Implements CMS OASIS edit checks including:
 * - Cross-field validation
 * - Logical consistency checks
 * - Skip pattern validation
 * - Date range validations
 *
 * Returns errors in CMS-compliant format for submission readiness.
 * Based on CMS OASIS-E Guidance Manual and OASIS Submission Specifications.
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/prisma';
import {
  ComplianceIssue,
  OasisEditCheck,
  OasisEditCheckResult,
  OasisValidationResult,
  SkipPatternViolation,
  DateRangeIssue,
} from '../../types/compliance.types';

// ===========================================
// CMS EDIT CHECK DEFINITIONS
// ===========================================

/**
 * Cross-field edit checks based on CMS OASIS specifications
 * Edit Type:
 * - fatal: Prevents submission
 * - warning: Advisory but submission allowed
 * - soft: Informational only
 */
const CMS_EDIT_CHECKS: OasisEditCheck[] = [
  // M1033 Risk for Hospitalization triggers
  {
    editId: 'OASIS-E-001',
    editType: 'fatal',
    items: ['M1033', 'M1800'],
    description: 'If M1033 (Risk for Hospitalization) = 01, then M1800 (Grooming) must be present',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-002',
    editType: 'fatal',
    items: ['M1033', 'M2001'],
    description: 'If M1033 = 01, then M2001 (Drug Regimen Review) must be completed',
    category: 'cross_field',
  },

  // Assessment type and date requirements
  {
    editId: 'OASIS-E-010',
    editType: 'fatal',
    items: ['M0100', 'M0030'],
    description: 'If M0100 (Reason for Assessment) = 01 (SOC), then M0030 (SOC Date) must be present',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-011',
    editType: 'fatal',
    items: ['M0100', 'M0032'],
    description: 'If M0100 = 03 (ROC), then M0032 (ROC Date) must be present',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-012',
    editType: 'fatal',
    items: ['M0100', 'M0906'],
    description: 'If M0100 = 06 or 07 (Transfer/Death), then M0906 (Discharge Date) must be present',
    category: 'cross_field',
  },

  // Wound assessment triggers
  {
    editId: 'OASIS-E-020',
    editType: 'fatal',
    items: ['M1306', 'M1307'],
    description: 'If M1306 (Unhealed Pressure Ulcer) = 1, then M1307 (Most Problematic Pressure Ulcer Stage) must be completed',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-021',
    editType: 'fatal',
    items: ['M1307', 'M1308', 'M1309'],
    description: 'If M1307 = 1-4, then corresponding M1308/M1309 (Number of ulcers by stage) must be > 0',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-022',
    editType: 'fatal',
    items: ['M1311', 'M1322'],
    description: 'If M1311 (Healable pressure ulcers) = 1, then M1322 (Status) must indicate active treatment',
    category: 'cross_field',
  },

  // Functional status triggers
  {
    editId: 'OASIS-E-030',
    editType: 'warning',
    items: ['GG0170I', 'M1860'],
    description: 'GG0170I (Walk 10 feet) should be consistent with M1860 (Ambulation)',
    category: 'logical',
  },
  {
    editId: 'OASIS-E-031',
    editType: 'warning',
    items: ['GG0130A', 'M1800'],
    description: 'GG0130A (Eating) should be consistent with M1800 (Grooming)',
    category: 'logical',
  },

  // Cognitive and behavioral triggers
  {
    editId: 'OASIS-E-040',
    editType: 'warning',
    items: ['M1700', 'M1710'],
    description: 'If M1700 (Cognitive Function) = 3-4, then M1710 (Behavior Frequency) should reflect cognitive issues',
    category: 'logical',
  },
  {
    editId: 'OASIS-E-041',
    editType: 'fatal',
    items: ['M1730', 'M1730_PHQ2_SCORE'],
    description: 'M1730 (Depression Screening) PHQ-2 score must be calculated correctly (0-6)',
    category: 'logical',
  },

  // Medication management triggers
  {
    editId: 'OASIS-E-050',
    editType: 'fatal',
    items: ['M2001', 'M2003'],
    description: 'If M2001 (Drug Regimen Review) = 0 (No), then M2003 (Medication Follow-up) must = NA',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-051',
    editType: 'warning',
    items: ['M2001', 'M2010'],
    description: 'If M2001 indicates high-risk medications, M2010 (Patient/Caregiver Drug Education) should = 1',
    category: 'cross_field',
  },

  // Therapy need triggers
  {
    editId: 'OASIS-E-060',
    editType: 'warning',
    items: ['M2200', 'GG0170'],
    description: 'M2200 (Therapy Need) should align with GG0170 functional limitations',
    category: 'logical',
  },

  // Diagnosis triggers
  {
    editId: 'OASIS-E-070',
    editType: 'fatal',
    items: ['M1021', 'M1023'],
    description: 'M1021 (Primary Diagnosis) ICD-10 code must be valid and appropriate for home health',
    category: 'cross_field',
  },
  {
    editId: 'OASIS-E-071',
    editType: 'warning',
    items: ['M1021', 'M1028'],
    description: 'Primary diagnosis should have associated OASIS findings that support the diagnosis',
    category: 'logical',
  },
];

// ===========================================
// SKIP PATTERN DEFINITIONS
// ===========================================

interface SkipPatternRule {
  triggerItem: string;
  triggerValues: string[];
  skippedItems: string[];
  condition: 'skip_if' | 'require_if';
  guideline: string;
}

const SKIP_PATTERNS: SkipPatternRule[] = [
  // M1306 triggers wound section
  {
    triggerItem: 'M1306',
    triggerValues: ['0'],
    skippedItems: ['M1307', 'M1308', 'M1309', 'M1311', 'M1313'],
    condition: 'skip_if',
    guideline: 'If M1306 (Unhealed Pressure Ulcer) = 0, skip M1307-M1313',
  },
  {
    triggerItem: 'M1306',
    triggerValues: ['1'],
    skippedItems: ['M1307', 'M1311'],
    condition: 'require_if',
    guideline: 'If M1306 (Unhealed Pressure Ulcer) = 1, M1307 and M1311 are required',
  },

  // M1320 stasis ulcer triggers
  {
    triggerItem: 'M1320',
    triggerValues: ['0'],
    skippedItems: ['M1322', 'M1324'],
    condition: 'skip_if',
    guideline: 'If M1320 (Stasis Ulcer) = 0, skip M1322-M1324',
  },

  // M1330 surgical wound triggers
  {
    triggerItem: 'M1330',
    triggerValues: ['0'],
    skippedItems: ['M1332', 'M1334'],
    condition: 'skip_if',
    guideline: 'If M1330 (Surgical Wound) = 0, skip M1332-M1334',
  },

  // M1400 dyspnea triggers
  {
    triggerItem: 'M1400',
    triggerValues: ['0'],
    skippedItems: ['M1410'],
    condition: 'skip_if',
    guideline: 'If M1400 (Dyspnea) = 0, skip M1410 (Respiratory Treatments)',
  },

  // M2001 drug regimen review triggers
  {
    triggerItem: 'M2001',
    triggerValues: ['00'],
    skippedItems: ['M2003', 'M2005'],
    condition: 'skip_if',
    guideline: 'If M2001 (Drug Regimen Review) = 00, skip M2003-M2005',
  },

  // M1730 depression screening triggers
  {
    triggerItem: 'M1730',
    triggerValues: ['99'],
    skippedItems: ['M1730_PHQ2'],
    condition: 'skip_if',
    guideline: 'If M1730 = 99 (unable to respond), skip PHQ-2 scoring',
  },

  // GG0100 Prior Functioning triggers
  {
    triggerItem: 'GG0100A',
    triggerValues: ['88', '09'],
    skippedItems: ['GG0100B', 'GG0100C', 'GG0100D'],
    condition: 'skip_if',
    guideline: 'If GG0100A = 88 (not applicable) or 09 (unknown), skip remaining prior functioning items',
  },
];

// ===========================================
// DATE VALIDATION RULES
// ===========================================

interface DateValidationRule {
  dateField: string;
  validationType: 'not_future' | 'within_range' | 'sequence';
  referenceField?: string;
  maxDaysBefore?: number;
  maxDaysAfter?: number;
  guideline: string;
}

const DATE_VALIDATION_RULES: DateValidationRule[] = [
  {
    dateField: 'M0030',
    validationType: 'not_future',
    guideline: 'M0030 (SOC Date) cannot be a future date',
  },
  {
    dateField: 'M0032',
    validationType: 'not_future',
    guideline: 'M0032 (ROC Date) cannot be a future date',
  },
  {
    dateField: 'M0090',
    validationType: 'within_range',
    referenceField: 'M0030',
    maxDaysBefore: 0,
    maxDaysAfter: 5,
    guideline: 'M0090 (Assessment Completion Date) must be within 5 days of SOC/ROC',
  },
  {
    dateField: 'M0906',
    validationType: 'sequence',
    referenceField: 'M0030',
    maxDaysBefore: 0,
    guideline: 'M0906 (Discharge Date) must be on or after SOC Date',
  },
  {
    dateField: 'M0104',
    validationType: 'within_range',
    referenceField: 'M0030',
    maxDaysBefore: 365,
    maxDaysAfter: 0,
    guideline: 'M0104 (Referral Date) must be within 365 days before SOC',
  },
];

// ===========================================
// MAIN VALIDATION FUNCTION
// ===========================================

/**
 * Comprehensive OASIS validation with CMS edit checks
 */
export async function validateOasisAssessment(
  assessmentId: string,
  options: {
    validateEditChecks?: boolean;
    validateSkipPatterns?: boolean;
    validateDateRanges?: boolean;
  } = { validateEditChecks: true, validateSkipPatterns: true, validateDateRanges: true }
): Promise<OasisValidationResult> {
  const issues: ComplianceIssue[] = [];
  const editCheckResults: OasisEditCheckResult[] = [];
  const skipPatternViolations: SkipPatternViolation[] = [];
  const dateRangeIssues: DateRangeIssue[] = [];

  // Fetch assessment with responses
  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      responses: true,
    },
  });

  if (!assessment) {
    return {
      valid: false,
      issues: [{
        id: uuidv4(),
        field: 'assessmentId',
        code: 'ASSESSMENT_NOT_FOUND',
        severity: 'error',
        category: 'oasis_completeness',
        message: 'OASIS assessment not found',
        suggestion: 'Verify assessment ID',
        source: 'oasisValidation.validateOasisAssessment',
      }],
      score: 0,
      summary: { errors: 1, warnings: 0, info: 0 },
      validatedAt: new Date().toISOString(),
      entityType: 'assessment',
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
    };
  }

  // Build response map for validation
  const responseMap: Record<string, string | null> = {};
  const dateResponseMap: Record<string, Date | null> = {};

  for (const response of assessment.responses) {
    responseMap[response.itemCode] = response.responseCode || response.responseValue;
    if (response.responseDate) {
      dateResponseMap[response.itemCode] = response.responseDate;
    }
  }

  // Run edit checks
  if (options.validateEditChecks) {
    const editResults = runEditChecks(responseMap);
    editCheckResults.push(...editResults.results);
    issues.push(...editResults.issues);
  }

  // Run skip pattern validation
  if (options.validateSkipPatterns) {
    const skipResults = validateSkipPatterns(responseMap);
    skipPatternViolations.push(...skipResults.violations);
    issues.push(...skipResults.issues);
  }

  // Run date range validation
  if (options.validateDateRanges) {
    const dateResults = validateDateRanges(dateResponseMap, responseMap);
    dateRangeIssues.push(...dateResults.issues);
    issues.push(...dateResults.complianceIssues);
  }

  // Run logical consistency checks
  const logicalIssues = runLogicalConsistencyChecks(responseMap);
  issues.push(...logicalIssues);

  // Calculate completion percentage
  const completionPercentage = calculateCompletionPercentage(assessment.assessmentType, responseMap);

  // Identify sections with issues
  const sectionsWithIssues = identifySectionsWithIssues(issues);

  // Calculate score
  const score = calculateValidationScore(issues);

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    score,
    summary: {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    },
    validatedAt: new Date().toISOString(),
    entityType: 'assessment',
    entityId: assessmentId,
    oasisDetails: {
      assessmentId,
      assessmentType: assessment.assessmentType,
      completionPercentage,
      sectionsWithIssues,
      editChecks: editCheckResults,
      skipPatternViolations,
      dateRangeIssues,
    },
  };
}

// ===========================================
// EDIT CHECK FUNCTIONS
// ===========================================

/**
 * Run CMS edit checks against response data
 */
function runEditChecks(
  responseMap: Record<string, string | null>
): { results: OasisEditCheckResult[]; issues: ComplianceIssue[] } {
  const results: OasisEditCheckResult[] = [];
  const issues: ComplianceIssue[] = [];

  for (const editCheck of CMS_EDIT_CHECKS) {
    const result = evaluateEditCheck(editCheck, responseMap);
    results.push(result);

    if (!result.passed) {
      issues.push({
        id: uuidv4(),
        field: editCheck.items.join(', '),
        code: editCheck.editId,
        severity: editCheck.editType === 'fatal' ? 'error' : 'warning',
        category: editCheck.category === 'cross_field' ? 'oasis_completeness' : 'documentation',
        message: editCheck.description,
        suggestion: generateEditCheckSuggestion(editCheck, result.actualValues),
        cmsEditNumber: editCheck.editId,
        source: 'oasisValidation.runEditChecks',
      });
    }
  }

  return { results, issues };
}

/**
 * Evaluate a single edit check
 */
function evaluateEditCheck(
  editCheck: OasisEditCheck,
  responseMap: Record<string, string | null>
): OasisEditCheckResult {
  const actualValues: Record<string, string | null> = {};

  for (const item of editCheck.items) {
    actualValues[item] = responseMap[item] || null;
  }

  let passed = true;
  let expectedCondition = '';

  // Evaluate based on edit check ID (specific logic for each)
  switch (editCheck.editId) {
    case 'OASIS-E-001': {
      // M1033 = 01 requires M1800
      if (responseMap['M1033'] === '01' && !responseMap['M1800']) {
        passed = false;
        expectedCondition = 'M1800 must be present when M1033 = 01';
      }
      break;
    }
    case 'OASIS-E-002': {
      // M1033 = 01 requires M2001
      if (responseMap['M1033'] === '01' && !responseMap['M2001']) {
        passed = false;
        expectedCondition = 'M2001 must be completed when M1033 = 01';
      }
      break;
    }
    case 'OASIS-E-010': {
      // M0100 = 01 (SOC) requires M0030
      if (responseMap['M0100'] === '01' && !responseMap['M0030']) {
        passed = false;
        expectedCondition = 'M0030 (SOC Date) required when M0100 = 01';
      }
      break;
    }
    case 'OASIS-E-011': {
      // M0100 = 03 (ROC) requires M0032
      if (responseMap['M0100'] === '03' && !responseMap['M0032']) {
        passed = false;
        expectedCondition = 'M0032 (ROC Date) required when M0100 = 03';
      }
      break;
    }
    case 'OASIS-E-012': {
      // M0100 = 06/07 requires M0906
      if (['06', '07'].includes(responseMap['M0100'] || '') && !responseMap['M0906']) {
        passed = false;
        expectedCondition = 'M0906 (Discharge Date) required when M0100 = 06 or 07';
      }
      break;
    }
    case 'OASIS-E-020': {
      // M1306 = 1 requires M1307
      if (responseMap['M1306'] === '1' && !responseMap['M1307']) {
        passed = false;
        expectedCondition = 'M1307 must be completed when M1306 = 1';
      }
      break;
    }
    case 'OASIS-E-021': {
      // M1307 stage requires corresponding count
      const stage = responseMap['M1307'];
      if (stage && ['1', '2', '3', '4'].includes(stage)) {
        const countField = stage === '1' || stage === '2' ? 'M1308' : 'M1309';
        const count = responseMap[countField];
        if (!count || count === '0' || count === '00') {
          passed = false;
          expectedCondition = `${countField} must be > 0 when M1307 = ${stage}`;
        }
      }
      break;
    }
    case 'OASIS-E-030': {
      // GG0170I consistency with M1860
      const gg0170i = responseMap['GG0170I'];
      const m1860 = responseMap['M1860'];
      if (gg0170i && m1860) {
        // Independent in GG but dependent in M1860 is inconsistent
        if (gg0170i === '06' && ['01', '02', '03'].includes(m1860)) {
          passed = false;
          expectedCondition = 'GG0170I = 06 (independent) conflicts with M1860 indicating dependency';
        }
      }
      break;
    }
    case 'OASIS-E-050': {
      // M2001 = 0 requires M2003 = NA
      if (responseMap['M2001'] === '00' && responseMap['M2003'] && responseMap['M2003'] !== 'NA') {
        passed = false;
        expectedCondition = 'M2003 must = NA when M2001 = 00';
      }
      break;
    }
    case 'OASIS-E-070': {
      // M1021 ICD-10 validation (simplified)
      const icd10 = responseMap['M1021'];
      if (icd10 && !isValidICD10Format(icd10)) {
        passed = false;
        expectedCondition = 'M1021 must contain a valid ICD-10 code format';
      }
      break;
    }
    default:
      // Default: check that all required items are present
      passed = editCheck.items.every((item) => responseMap[item] !== null && responseMap[item] !== undefined);
      expectedCondition = `All items must be present: ${editCheck.items.join(', ')}`;
  }

  return {
    editCheck,
    passed,
    actualValues,
    expectedCondition,
  };
}

/**
 * Generate a helpful suggestion for fixing edit check failures
 */
function generateEditCheckSuggestion(
  editCheck: OasisEditCheck,
  actualValues: Record<string, string | null>
): string {
  const missingItems = editCheck.items.filter((item) => !actualValues[item]);

  if (missingItems.length > 0) {
    return `Complete the following items: ${missingItems.join(', ')}`;
  }

  return `Review and correct the following items for consistency: ${editCheck.items.join(', ')}`;
}

// ===========================================
// SKIP PATTERN VALIDATION
// ===========================================

/**
 * Validate skip patterns are followed correctly
 */
function validateSkipPatterns(
  responseMap: Record<string, string | null>
): { violations: SkipPatternViolation[]; issues: ComplianceIssue[] } {
  const violations: SkipPatternViolation[] = [];
  const issues: ComplianceIssue[] = [];

  for (const rule of SKIP_PATTERNS) {
    const triggerValue = responseMap[rule.triggerItem];

    if (!triggerValue) continue;

    const shouldTrigger = rule.triggerValues.includes(triggerValue);

    if (rule.condition === 'skip_if' && shouldTrigger) {
      // Check that skipped items are NOT completed
      for (const skippedItem of rule.skippedItems) {
        if (responseMap[skippedItem] && responseMap[skippedItem] !== 'NA' && responseMap[skippedItem] !== '^') {
          violations.push({
            triggerItem: rule.triggerItem,
            skippedItem,
            expectedCondition: `${skippedItem} should be skipped when ${rule.triggerItem} = ${triggerValue}`,
            actualValues: {
              [rule.triggerItem]: triggerValue,
              [skippedItem]: responseMap[skippedItem],
            },
            guideline: rule.guideline,
          });

          issues.push({
            id: uuidv4(),
            field: skippedItem,
            code: 'SKIP_PATTERN_VIOLATION',
            severity: 'warning',
            category: 'oasis_completeness',
            message: `${skippedItem} should be skipped based on ${rule.triggerItem} = ${triggerValue}`,
            suggestion: `Per CMS guidelines: ${rule.guideline}`,
            source: 'oasisValidation.validateSkipPatterns',
          });
        }
      }
    } else if (rule.condition === 'require_if' && shouldTrigger) {
      // Check that required items ARE completed
      for (const requiredItem of rule.skippedItems) {
        if (!responseMap[requiredItem]) {
          violations.push({
            triggerItem: rule.triggerItem,
            skippedItem: requiredItem,
            expectedCondition: `${requiredItem} is required when ${rule.triggerItem} = ${triggerValue}`,
            actualValues: {
              [rule.triggerItem]: triggerValue,
              [requiredItem]: null,
            },
            guideline: rule.guideline,
          });

          issues.push({
            id: uuidv4(),
            field: requiredItem,
            code: 'REQUIRED_ITEM_MISSING',
            severity: 'error',
            category: 'oasis_completeness',
            message: `${requiredItem} is required when ${rule.triggerItem} = ${triggerValue}`,
            suggestion: `Complete ${requiredItem}. ${rule.guideline}`,
            source: 'oasisValidation.validateSkipPatterns',
          });
        }
      }
    }
  }

  return { violations, issues };
}

// ===========================================
// DATE RANGE VALIDATION
// ===========================================

/**
 * Validate date ranges and sequences
 */
function validateDateRanges(
  dateResponseMap: Record<string, Date | null>,
  _responseMap: Record<string, string | null>
): { issues: DateRangeIssue[]; complianceIssues: ComplianceIssue[] } {
  const issues: DateRangeIssue[] = [];
  const complianceIssues: ComplianceIssue[] = [];

  const now = new Date();

  for (const rule of DATE_VALIDATION_RULES) {
    const dateValue = dateResponseMap[rule.dateField];

    if (!dateValue) continue;

    switch (rule.validationType) {
      case 'not_future': {
        if (dateValue > now) {
          issues.push({
            dateField: rule.dateField,
            dateValue: dateValue.toISOString(),
            issueType: 'future_date',
            expectedRange: 'Date must not be in the future',
            guideline: rule.guideline,
          });

          complianceIssues.push({
            id: uuidv4(),
            field: rule.dateField,
            code: 'DATE_IN_FUTURE',
            severity: 'error',
            category: 'documentation',
            message: `${rule.dateField} cannot be a future date`,
            suggestion: `Correct ${rule.dateField} to today or earlier`,
            source: 'oasisValidation.validateDateRanges',
          });
        }
        break;
      }

      case 'within_range': {
        const refDate = dateResponseMap[rule.referenceField || ''];
        if (refDate && rule.maxDaysBefore !== undefined && rule.maxDaysAfter !== undefined) {
          const daysDiff = Math.floor((dateValue.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff < -rule.maxDaysBefore || daysDiff > rule.maxDaysAfter) {
            issues.push({
              dateField: rule.dateField,
              dateValue: dateValue.toISOString(),
              issueType: 'out_of_range',
              expectedRange: `Within ${rule.maxDaysBefore} days before to ${rule.maxDaysAfter} days after ${rule.referenceField}`,
              guideline: rule.guideline,
            });

            complianceIssues.push({
              id: uuidv4(),
              field: rule.dateField,
              code: 'DATE_OUT_OF_RANGE',
              severity: 'error',
              category: 'documentation',
              message: `${rule.dateField} is outside the valid range relative to ${rule.referenceField}`,
              suggestion: rule.guideline,
              source: 'oasisValidation.validateDateRanges',
            });
          }
        }
        break;
      }

      case 'sequence': {
        const refDate = dateResponseMap[rule.referenceField || ''];
        if (refDate && dateValue < refDate) {
          issues.push({
            dateField: rule.dateField,
            dateValue: dateValue.toISOString(),
            issueType: 'sequence_error',
            expectedRange: `${rule.dateField} must be on or after ${rule.referenceField}`,
            guideline: rule.guideline,
          });

          complianceIssues.push({
            id: uuidv4(),
            field: rule.dateField,
            code: 'DATE_SEQUENCE_ERROR',
            severity: 'error',
            category: 'documentation',
            message: `${rule.dateField} cannot be before ${rule.referenceField}`,
            suggestion: rule.guideline,
            source: 'oasisValidation.validateDateRanges',
          });
        }
        break;
      }
    }
  }

  return { issues, complianceIssues };
}

// ===========================================
// LOGICAL CONSISTENCY CHECKS
// ===========================================

/**
 * Run logical consistency checks between related items
 */
function runLogicalConsistencyChecks(
  responseMap: Record<string, string | null>
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  // Check GG self-care vs ADL consistency
  const ggEating = responseMap['GG0130A'];
  const m1870 = responseMap['M1870']; // Feeding or eating

  if (ggEating && m1870) {
    const ggScore = parseInt(ggEating, 10);
    const mScore = parseInt(m1870, 10);

    // GG scores: 06=independent, 01=dependent
    // M scores: typically 0=independent, higher=more dependent
    if (ggScore === 6 && mScore >= 3) {
      issues.push({
        id: uuidv4(),
        field: 'GG0130A, M1870',
        code: 'LOGICAL_INCONSISTENCY',
        severity: 'warning',
        category: 'documentation',
        message: 'GG0130A indicates independence but M1870 suggests dependency in eating/feeding',
        suggestion: 'Review and reconcile eating/feeding assessments',
        source: 'oasisValidation.runLogicalConsistencyChecks',
      });
    }
  }

  // Check ambulation consistency
  const gg0170i = responseMap['GG0170I']; // Walk 10 feet
  const m1860 = responseMap['M1860']; // Ambulation

  if (gg0170i && m1860) {
    const walkScore = parseInt(gg0170i, 10);
    const ambulationScore = parseInt(m1860, 10);

    // If can walk 10 feet independently but M1860 shows bedbound
    if (walkScore >= 5 && ambulationScore === 0) {
      issues.push({
        id: uuidv4(),
        field: 'GG0170I, M1860',
        code: 'AMBULATION_INCONSISTENCY',
        severity: 'warning',
        category: 'documentation',
        message: 'GG0170I indicates mobility but M1860 suggests bedbound status',
        suggestion: 'Review ambulation assessments for consistency',
        source: 'oasisValidation.runLogicalConsistencyChecks',
      });
    }
  }

  // Check cognitive status vs depression screening consistency
  const m1700 = responseMap['M1700']; // Cognitive functioning
  const m1730 = responseMap['M1730']; // Depression screening

  if (m1700 && m1730) {
    const cognitiveScore = parseInt(m1700, 10);
    // If severe cognitive impairment but PHQ-2 completed (not marked as unable)
    if (cognitiveScore >= 3 && m1730 !== '99') {
      issues.push({
        id: uuidv4(),
        field: 'M1700, M1730',
        code: 'COGNITIVE_SCREENING_INCONSISTENCY',
        severity: 'info',
        category: 'documentation',
        message: 'Severe cognitive impairment documented but depression screening completed - verify patient could reliably respond',
        suggestion: 'Confirm depression screening validity given cognitive status',
        source: 'oasisValidation.runLogicalConsistencyChecks',
      });
    }
  }

  // Check wound status consistency
  const m1306 = responseMap['M1306']; // Unhealed pressure ulcer
  const m1300 = responseMap['M1300']; // Skin integrity

  if (m1306 === '1' && m1300 === '0') {
    issues.push({
      id: uuidv4(),
      field: 'M1306, M1300',
      code: 'WOUND_STATUS_INCONSISTENCY',
      severity: 'warning',
      category: 'documentation',
      message: 'M1306 indicates unhealed pressure ulcer but M1300 indicates intact skin integrity',
      suggestion: 'Review and reconcile skin/wound assessments',
      source: 'oasisValidation.runLogicalConsistencyChecks',
    });
  }

  return issues;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Validate ICD-10 code format (simplified)
 */
function isValidICD10Format(code: string): boolean {
  // Basic ICD-10-CM format: Letter + digits (3-7 characters)
  const icd10Pattern = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{0,4})?$/i;
  return icd10Pattern.test(code.trim());
}

/**
 * Calculate completion percentage based on assessment type
 */
function calculateCompletionPercentage(
  assessmentType: string,
  responseMap: Record<string, string | null>
): number {
  const requiredItemsByType: Record<string, string[]> = {
    START_OF_CARE: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0030', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1021', 'M1023', 'M1033', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170I', 'GG0170J',
    ],
    RECERTIFICATION: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1021', 'M1023', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
    ],
    DISCHARGE_FROM_AGENCY: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170I', 'GG0170J',
    ],
  };

  const requiredItems = requiredItemsByType[assessmentType] ?? requiredItemsByType['START_OF_CARE'] ?? [];
  const completedCount = requiredItems.filter((item) => responseMap[item]).length;

  return requiredItems.length > 0 ? Math.round((completedCount / requiredItems.length) * 100) : 0;
}

/**
 * Identify OASIS sections with issues
 */
function identifySectionsWithIssues(issues: ComplianceIssue[]): string[] {
  const sections = new Set<string>();

  for (const issue of issues) {
    const fieldItems = issue.field.split(',').map((f) => f.trim());

    for (const item of fieldItems) {
      if (item.startsWith('M00') || item.startsWith('M01')) {
        sections.add('clinical_record');
      } else if (item.startsWith('M10')) {
        sections.add('patient_history');
      } else if (item.startsWith('M11')) {
        sections.add('living_situation');
      } else if (item.startsWith('M12')) {
        sections.add('sensory_status');
      } else if (item.startsWith('M13')) {
        sections.add('integumentary_status');
      } else if (item.startsWith('M14')) {
        sections.add('respiratory_status');
      } else if (item.startsWith('M15')) {
        sections.add('cardiac_status');
      } else if (item.startsWith('M16')) {
        sections.add('elimination_status');
      } else if (item.startsWith('M17')) {
        sections.add('neuro_emotional');
      } else if (item.startsWith('M18')) {
        sections.add('functional_abilities');
      } else if (item.startsWith('M20') || item.startsWith('M21')) {
        sections.add('medication_management');
      } else if (item.startsWith('M22')) {
        sections.add('therapy_need');
      } else if (item.startsWith('GG')) {
        sections.add('functional_abilities');
      }
    }
  }

  return Array.from(sections);
}

/**
 * Calculate validation score
 */
function calculateValidationScore(issues: ComplianceIssue[]): number {
  const errorWeight = 20;
  const warningWeight = 5;
  const infoWeight = 1;

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  const deductions = errors * errorWeight + warnings * warningWeight + infos * infoWeight;
  return Math.max(0, Math.min(100, 100 - deductions));
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  validateOasisAssessment,
  CMS_EDIT_CHECKS,
  SKIP_PATTERNS,
  DATE_VALIDATION_RULES,
};
