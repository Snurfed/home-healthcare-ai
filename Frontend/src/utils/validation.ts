/**
 * Validation Utilities
 *
 * Comprehensive validation for OASIS question responses including:
 * - Required field validation
 * - Type-specific validation (numeric ranges, dates, patterns)
 * - Cross-question validation (consistency checks)
 * - Assessment-wide validation before submission
 */

import type { OASISQuestion, OASISResponse, ValidationRule, AssessmentType } from '@typedefs/index';

/**
 * Validation error for a specific question
 */
export interface QuestionValidationError {
  itemCode: string;
  itemName: string;
  message: string;
  severity: 'error' | 'warning';
  ruleType: string;
  relatedItemCode?: string; // For cross-question validation
}

/**
 * Validation result for a set of questions
 */
export interface ValidationResult {
  isValid: boolean;
  errors: QuestionValidationError[];
  warnings: QuestionValidationError[];
  errorCount: number;
  warningCount: number;
}

/**
 * Full assessment validation result
 */
export interface AssessmentValidationResult extends ValidationResult {
  sectionResults: Record<string, ValidationResult>;
  completionPercentage: number;
  isReadyForSubmission: boolean;
  missingRequiredCount: number;
  crossValidationErrors: QuestionValidationError[];
}

/**
 * Cross-question validation rule
 */
export interface CrossValidationRule {
  sourceItemCode: string;
  targetItemCode: string;
  condition: 'equals' | 'notEquals' | 'lessThan' | 'greaterThan' | 'lessThanOrEqual' | 'greaterThanOrEqual' | 'requires' | 'excludes' | 'dateBefore' | 'dateAfter';
  sourceValue?: string | number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation context for conditional rules
 */
export interface ValidationContext {
  assessmentType?: AssessmentType;
  assessmentDate?: string;
  startOfCareDate?: string;
  allResponses?: ResponseMap;
}

/**
 * Response map type
 */
type ResponseMap = Record<string, Partial<OASISResponse> | undefined>;

// ============================================================================
// Cross-Question Validation Rules
// ============================================================================

/**
 * OASIS cross-question validation rules based on CMS guidance
 */
const CROSS_VALIDATION_RULES: CrossValidationRule[] = [
  // Pain frequency vs pain effect - if pain is frequent, should have some effect
  {
    sourceItemCode: 'M1242',
    targetItemCode: 'M1240',
    condition: 'requires',
    sourceValue: '3', // Daily pain
    message: 'If patient has daily pain (M1242=3), pain frequency (M1240) should indicate pain is present',
    severity: 'warning',
  },
  // Pressure ulcer present vs stage
  {
    sourceItemCode: 'M1306',
    targetItemCode: 'M1311',
    condition: 'requires',
    sourceValue: '1', // Unhealed pressure ulcer present
    message: 'If unhealed pressure ulcer is present (M1306=1), pressure ulcer staging (M1311) must be completed',
    severity: 'error',
  },
  // Surgical wound vs wound status
  {
    sourceItemCode: 'M1340',
    targetItemCode: 'M1342',
    condition: 'requires',
    sourceValue: '1', // Surgical wound present
    message: 'If surgical wound is present (M1340=1), wound status (M1342) must be completed',
    severity: 'error',
  },
  // Ambulation ability vs device usage
  {
    sourceItemCode: 'GG0170C',
    targetItemCode: 'GG0170I',
    condition: 'lessThanOrEqual',
    message: 'Walking ability with device (GG0170I) should not exceed ability without device (GG0170C)',
    severity: 'warning',
  },
  // Discharge date must be after start of care date
  {
    sourceItemCode: 'M0906',
    targetItemCode: 'M0030',
    condition: 'dateAfter',
    message: 'Discharge date (M0906) must be after start of care date (M0030)',
    severity: 'error',
  },
  // Transfer date must be after start of care
  {
    sourceItemCode: 'M0903',
    targetItemCode: 'M0030',
    condition: 'dateAfter',
    message: 'Transfer date (M0903) must be after start of care date (M0030)',
    severity: 'error',
  },
  // Resumption date must be after start of care
  {
    sourceItemCode: 'M0032',
    targetItemCode: 'M0030',
    condition: 'dateAfter',
    message: 'Resumption of care date (M0032) must be after start of care date (M0030)',
    severity: 'error',
  },
  // Assessment completion date validation
  {
    sourceItemCode: 'M0090',
    targetItemCode: 'M0030',
    condition: 'greaterThanOrEqual',
    message: 'Assessment completion date (M0090) must be on or after start of care date (M0030)',
    severity: 'error',
  },
  // Cognitive function vs confusion frequency
  {
    sourceItemCode: 'M1710',
    targetItemCode: 'M1700',
    condition: 'requires',
    sourceValue: '1', // Confusion present
    message: 'If confusion is present (M1710), cognitive function (M1700) details should be provided',
    severity: 'warning',
  },
  // Urinary incontinence vs catheter
  {
    sourceItemCode: 'M1610',
    targetItemCode: 'M1600',
    condition: 'excludes',
    sourceValue: '0', // No incontinence
    message: 'If patient has indwelling catheter (M1610), urinary incontinence (M1600) should reflect catheter status',
    severity: 'warning',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a response has a value
 */
function hasResponseValue(response: Partial<OASISResponse> | undefined): boolean {
  if (!response) return false;

  return !!(
    response.responseValue ||
    response.responseCode ||
    response.responseText ||
    (response.responseNumeric !== undefined && response.responseNumeric !== null) ||
    response.responseDate
  );
}

/**
 * Get the primary value from a response
 */
function getResponseValue(response: Partial<OASISResponse> | undefined): string | number | null {
  if (!response) return null;

  if (response.responseNumeric !== undefined && response.responseNumeric !== null) {
    return response.responseNumeric;
  }
  if (response.responseCode) return response.responseCode;
  if (response.responseValue) return response.responseValue;
  if (response.responseDate) return response.responseDate;
  return null;
}

/**
 * Parse a date string to Date object
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Validate date is valid and within reasonable range
 */
function isValidDate(dateStr: string): boolean {
  const date = parseDate(dateStr);
  if (!date) return false;

  const now = new Date();
  const minDate = new Date('1900-01-01');
  const maxDate = new Date(now.getFullYear() + 1, 11, 31); // Allow dates up to end of next year

  return date >= minDate && date <= maxDate;
}

/**
 * Validate ICD-10 code format
 */
function isValidICD10(code: string): boolean {
  // ICD-10 format: Letter followed by 2 digits, optional decimal, then up to 4 more characters
  const icd10Pattern = /^[A-Z]\d{2}(\.\d{1,4})?$/i;
  return icd10Pattern.test(code);
}

/**
 * Parse a condition string for conditional validation
 * e.g., "assessmentType=START_OF_CARE" or "M1000=1"
 */
function evaluateCondition(
  condition: string | undefined,
  context: ValidationContext
): boolean {
  if (!condition) return true; // No condition means always apply

  // Parse conditions like "assessmentType=START_OF_CARE"
  const match = condition.match(/^(\w+)([=!<>]+)(.+)$/);
  if (!match) return true;

  const [, field, operator, expectedValue] = match;
  if (!field || !operator || !expectedValue) return true;

  // System context conditions
  if (field === 'assessmentType') {
    if (operator === '=' || operator === '==') {
      return context.assessmentType === expectedValue;
    }
    if (operator === '!=' || operator === '<>') {
      return context.assessmentType !== expectedValue;
    }
  }

  // Question-based conditions
  if (context.allResponses) {
    const response = context.allResponses[field];
    const responseValue = getResponseValue(response);

    if (responseValue === null) return false;

    const strValue = String(responseValue);
    const numValue = Number(responseValue);
    const expectedNum = Number(expectedValue);

    switch (operator) {
      case '=':
      case '==':
        return strValue === expectedValue;
      case '!=':
      case '<>':
        return strValue !== expectedValue;
      case '>':
        return !isNaN(numValue) && !isNaN(expectedNum) && numValue > expectedNum;
      case '<':
        return !isNaN(numValue) && !isNaN(expectedNum) && numValue < expectedNum;
      case '>=':
        return !isNaN(numValue) && !isNaN(expectedNum) && numValue >= expectedNum;
      case '<=':
        return !isNaN(numValue) && !isNaN(expectedNum) && numValue <= expectedNum;
    }
  }

  return true;
}

// ============================================================================
// Single Question Validation
// ============================================================================

/**
 * Validate a single question's response
 */
export function validateQuestion(
  question: OASISQuestion,
  response: Partial<OASISResponse> | undefined,
  context: ValidationContext = {}
): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];

  // Type-specific validation (even without explicit rules)
  errors.push(...validateResponseType(question, response));

  // Rule-based validation
  if (question.validationRules && question.validationRules.length > 0) {
    for (const rule of question.validationRules) {
      // Check if the condition for this rule is met
      const ruleWithCondition = rule as ValidationRule & { condition?: string };
      const conditionMet = evaluateCondition(ruleWithCondition.condition, context);

      if (!conditionMet) continue;

      const ruleErrors = validateRule(question, response, rule);
      errors.push(...ruleErrors);
    }
  }

  return errors;
}

/**
 * Validate response against its expected type
 */
function validateResponseType(
  question: OASISQuestion,
  response: Partial<OASISResponse> | undefined
): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];

  if (!hasResponseValue(response)) return errors;

  switch (question.responseType) {
    case 'numeric':
      if (response?.responseNumeric !== undefined && response.responseNumeric !== null) {
        if (isNaN(response.responseNumeric)) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            message: 'Value must be a valid number',
            severity: 'error',
            ruleType: 'type',
          });
        }
      }
      break;

    case 'date':
      if (response?.responseValue || response?.responseDate) {
        const dateValue = response.responseDate || response.responseValue;
        if (dateValue && !isValidDate(dateValue)) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            message: 'Please enter a valid date',
            severity: 'error',
            ruleType: 'type',
          });
        }
      }
      break;

    case 'icd10':
      if (response?.responseValue || response?.responseCode) {
        const code = response.responseCode || response.responseValue;
        if (code && !isValidICD10(code)) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            message: 'Please enter a valid ICD-10 code (e.g., I10, E11.9)',
            severity: 'warning',
            ruleType: 'type',
          });
        }
      }
      break;

    case 'single_select':
      if (response?.responseCode || response?.responseValue) {
        const value = response.responseCode || response.responseValue;
        const validCodes = question.responses?.map(r => r.code) || [];
        if (value && validCodes.length > 0 && !validCodes.includes(value)) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            message: `Invalid selection. Please choose from available options.`,
            severity: 'error',
            ruleType: 'type',
          });
        }
      }
      break;

    case 'multi_select':
      if (response?.responseCode || response?.responseValue) {
        const value = response.responseCode || response.responseValue || '';
        const selectedCodes = value.split(',').filter(Boolean);
        const validCodes = question.responses?.map(r => r.code) || [];

        if (validCodes.length > 0) {
          const invalidCodes = selectedCodes.filter(c => !validCodes.includes(c));
          if (invalidCodes.length > 0) {
            errors.push({
              itemCode: question.itemCode,
              itemName: question.itemName,
              message: `Invalid selection(s): ${invalidCodes.join(', ')}`,
              severity: 'error',
              ruleType: 'type',
            });
          }
        }
      }
      break;
  }

  return errors;
}

/**
 * Validate a single rule against a response
 */
function validateRule(
  question: OASISQuestion,
  response: Partial<OASISResponse> | undefined,
  rule: ValidationRule
): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];

  switch (rule.ruleType) {
    case 'required':
      if (!hasResponseValue(response)) {
        errors.push({
          itemCode: question.itemCode,
          itemName: question.itemName,
          message: rule.errorMessage || `${question.itemCode} is required`,
          severity: rule.severity,
          ruleType: rule.ruleType,
        });
      }
      break;

    case 'min':
      if (
        response?.responseNumeric !== undefined &&
        response.responseNumeric !== null &&
        typeof rule.value === 'number' &&
        response.responseNumeric < rule.value
      ) {
        errors.push({
          itemCode: question.itemCode,
          itemName: question.itemName,
          message: rule.errorMessage || `Value must be at least ${rule.value}`,
          severity: rule.severity,
          ruleType: rule.ruleType,
        });
      }
      break;

    case 'max':
      if (
        response?.responseNumeric !== undefined &&
        response.responseNumeric !== null &&
        typeof rule.value === 'number' &&
        response.responseNumeric > rule.value
      ) {
        errors.push({
          itemCode: question.itemCode,
          itemName: question.itemName,
          message: rule.errorMessage || `Value must be at most ${rule.value}`,
          severity: rule.severity,
          ruleType: rule.ruleType,
        });
      }
      break;

    case 'pattern':
      if (response?.responseValue && typeof rule.value === 'string') {
        try {
          const regex = new RegExp(rule.value);
          if (!regex.test(response.responseValue)) {
            errors.push({
              itemCode: question.itemCode,
              itemName: question.itemName,
              message: rule.errorMessage || 'Value does not match required format',
              severity: rule.severity,
              ruleType: rule.ruleType,
            });
          }
        } catch {
          // Invalid regex, skip validation
        }
      }
      break;

    case 'custom':
      // Custom validation handled by specific question logic
      break;
  }

  return errors;
}

// ============================================================================
// Cross-Question Validation
// ============================================================================

/**
 * Validate cross-question consistency rules
 */
export function validateCrossQuestionRules(
  questions: OASISQuestion[],
  responses: ResponseMap,
  _context: ValidationContext = {}
): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];
  const questionMap = new Map(questions.map(q => [q.itemCode, q]));

  for (const rule of CROSS_VALIDATION_RULES) {
    const sourceResponse = responses[rule.sourceItemCode];
    const targetResponse = responses[rule.targetItemCode];
    const sourceQuestion = questionMap.get(rule.sourceItemCode);
    const targetQuestion = questionMap.get(rule.targetItemCode);

    // Skip if questions don't exist in this assessment
    if (!sourceQuestion && !targetQuestion) continue;

    const sourceValue = getResponseValue(sourceResponse);
    const targetValue = getResponseValue(targetResponse);

    let isViolation = false;

    switch (rule.condition) {
      case 'requires':
        // If source has specific value, target must have a value
        if (rule.sourceValue !== undefined) {
          if (String(sourceValue) === String(rule.sourceValue) && !hasResponseValue(targetResponse)) {
            isViolation = true;
          }
        } else {
          // If source has any value, target must have a value
          if (hasResponseValue(sourceResponse) && !hasResponseValue(targetResponse)) {
            isViolation = true;
          }
        }
        break;

      case 'excludes':
        // If source has specific value, target should not have that value
        if (rule.sourceValue !== undefined) {
          if (String(sourceValue) === String(rule.sourceValue) &&
              String(targetValue) === String(rule.sourceValue)) {
            isViolation = true;
          }
        }
        break;

      case 'equals':
        if (hasResponseValue(sourceResponse) && hasResponseValue(targetResponse)) {
          if (sourceValue !== targetValue) {
            isViolation = true;
          }
        }
        break;

      case 'notEquals':
        if (hasResponseValue(sourceResponse) && hasResponseValue(targetResponse)) {
          if (sourceValue === targetValue) {
            isViolation = true;
          }
        }
        break;

      case 'lessThan':
      case 'lessThanOrEqual':
        if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
          if (rule.condition === 'lessThan' && sourceValue >= targetValue) {
            isViolation = true;
          }
          if (rule.condition === 'lessThanOrEqual' && sourceValue > targetValue) {
            isViolation = true;
          }
        }
        break;

      case 'greaterThan':
      case 'greaterThanOrEqual':
        if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
          if (rule.condition === 'greaterThan' && sourceValue <= targetValue) {
            isViolation = true;
          }
          if (rule.condition === 'greaterThanOrEqual' && sourceValue < targetValue) {
            isViolation = true;
          }
        }
        break;

      case 'dateAfter':
        const sourceDate = parseDate(String(sourceValue));
        const targetDate = parseDate(String(targetValue));
        if (sourceDate && targetDate && sourceDate <= targetDate) {
          isViolation = true;
        }
        break;

      case 'dateBefore':
        const srcDate = parseDate(String(sourceValue));
        const tgtDate = parseDate(String(targetValue));
        if (srcDate && tgtDate && srcDate >= tgtDate) {
          isViolation = true;
        }
        break;
    }

    if (isViolation) {
      errors.push({
        itemCode: rule.sourceItemCode,
        itemName: sourceQuestion?.itemName || rule.sourceItemCode,
        message: rule.message,
        severity: rule.severity,
        ruleType: 'cross-validation',
        relatedItemCode: rule.targetItemCode,
      });
    }
  }

  return errors;
}

// ============================================================================
// Section Validation
// ============================================================================

/**
 * Validate all questions in a section
 */
export function validateSection(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: ValidationContext = {}
): ValidationResult {
  const allErrors: QuestionValidationError[] = [];

  // Add allResponses to context for conditional validation
  const fullContext = { ...context, allResponses: responses };

  for (const question of questions) {
    const response = responses[question.itemCode];
    const questionErrors = validateQuestion(question, response, fullContext);
    allErrors.push(...questionErrors);
  }

  const errors = allErrors.filter((e) => e.severity === 'error');
  const warnings = allErrors.filter((e) => e.severity === 'warning');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

// ============================================================================
// Full Assessment Validation
// ============================================================================

/**
 * Validate entire assessment before submission
 */
export function validateAssessment(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: ValidationContext = {}
): AssessmentValidationResult {
  const fullContext = { ...context, allResponses: responses };
  const sectionResults: Record<string, ValidationResult> = {};
  const allErrors: QuestionValidationError[] = [];
  const allWarnings: QuestionValidationError[] = [];

  // Group questions by section
  const sectionQuestions = new Map<string, OASISQuestion[]>();
  for (const question of questions) {
    const sectionId = question.section;
    if (!sectionQuestions.has(sectionId)) {
      sectionQuestions.set(sectionId, []);
    }
    sectionQuestions.get(sectionId)!.push(question);
  }

  // Validate each section
  for (const [sectionId, sectionQs] of sectionQuestions) {
    const result = validateSection(sectionQs, responses, fullContext);
    sectionResults[sectionId] = result;
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  // Cross-question validation
  const crossValidationErrors = validateCrossQuestionRules(questions, responses, fullContext);
  allErrors.push(...crossValidationErrors.filter(e => e.severity === 'error'));
  allWarnings.push(...crossValidationErrors.filter(e => e.severity === 'warning'));

  // Calculate completion percentage
  const totalQuestions = questions.length;
  const answeredQuestions = questions.filter(q => hasResponseValue(responses[q.itemCode])).length;
  const completionPercentage = totalQuestions > 0
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0;

  // Count missing required fields
  const missingRequired = getMissingRequiredQuestions(questions, responses, fullContext);

  // Determine if ready for submission
  const isReadyForSubmission =
    allErrors.filter(e => e.severity === 'error').length === 0 &&
    missingRequired.length === 0 &&
    completionPercentage >= 80; // At least 80% complete

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    errorCount: allErrors.length,
    warningCount: allWarnings.length,
    sectionResults,
    completionPercentage,
    isReadyForSubmission,
    missingRequiredCount: missingRequired.length,
    crossValidationErrors,
  };
}

/**
 * Get a summary of required questions that are missing
 */
export function getMissingRequiredQuestions(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: ValidationContext = {}
): OASISQuestion[] {
  return questions.filter((question) => {
    if (!question.validationRules) return false;

    const hasRequiredRule = question.validationRules.some((rule) => {
      if (rule.ruleType !== 'required') return false;

      const ruleWithCondition = rule as ValidationRule & { condition?: string };
      const conditionMet = evaluateCondition(ruleWithCondition.condition, context);

      return conditionMet;
    });

    if (!hasRequiredRule) return false;

    const response = responses[question.itemCode];
    return !hasResponseValue(response);
  });
}

/**
 * Get submission readiness summary
 */
export function getSubmissionReadiness(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: ValidationContext = {}
): {
  isReady: boolean;
  blockers: string[];
  warnings: string[];
  completionPercentage: number;
} {
  const result = validateAssessment(questions, responses, context);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (result.missingRequiredCount > 0) {
    blockers.push(`${result.missingRequiredCount} required field(s) are not completed`);
  }

  if (result.errorCount > 0) {
    blockers.push(`${result.errorCount} validation error(s) must be fixed`);
  }

  if (result.completionPercentage < 80) {
    blockers.push(`Assessment is only ${result.completionPercentage}% complete (minimum 80% required)`);
  }

  if (result.warningCount > 0) {
    warnings.push(`${result.warningCount} warning(s) should be reviewed`);
  }

  if (result.crossValidationErrors.length > 0) {
    warnings.push(`${result.crossValidationErrors.length} consistency issue(s) detected`);
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    warnings,
    completionPercentage: result.completionPercentage,
  };
}
