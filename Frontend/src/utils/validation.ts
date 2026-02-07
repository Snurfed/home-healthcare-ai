/**
 * Validation Utilities
 *
 * Validates OASIS question responses against validation rules
 */

import type { OASISQuestion, OASISResponse, ValidationRule } from '@typedefs/index';

/**
 * Validation error for a specific question
 */
export interface QuestionValidationError {
  itemCode: string;
  itemName: string;
  message: string;
  severity: 'error' | 'warning';
  ruleType: string;
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
 * Response map type
 */
type ResponseMap = Record<string, Partial<OASISResponse> | undefined>;

/**
 * Check if a response has a value
 */
function hasResponseValue(response: Partial<OASISResponse> | undefined): boolean {
  if (!response) return false;

  return !!(
    response.responseValue ||
    response.responseCode ||
    response.responseText ||
    response.responseNumeric !== undefined && response.responseNumeric !== null
  );
}

/**
 * Parse a condition string for conditional validation
 * e.g., "assessmentType=START_OF_CARE"
 */
function evaluateCondition(
  condition: string | undefined,
  context: { assessmentType?: string }
): boolean {
  if (!condition) return true; // No condition means always apply

  // Parse simple conditions like "assessmentType=START_OF_CARE"
  const match = condition.match(/^(\w+)=(.+)$/);
  if (match) {
    const [, field, expectedValue] = match;
    if (field === 'assessmentType') {
      return context.assessmentType === expectedValue;
    }
  }

  // Default to true if we can't parse
  return true;
}

/**
 * Validate a single question's response
 */
export function validateQuestion(
  question: OASISQuestion,
  response: Partial<OASISResponse> | undefined,
  context: { assessmentType?: string } = {}
): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];

  if (!question.validationRules || question.validationRules.length === 0) {
    return errors;
  }

  for (const rule of question.validationRules) {
    // Check if the condition for this rule is met
    const conditionMet = evaluateCondition(
      (rule as ValidationRule & { condition?: string }).condition,
      context
    );

    if (!conditionMet) continue;

    switch (rule.ruleType) {
      case 'required':
        if (!hasResponseValue(response)) {
          errors.push({
            itemCode: question.itemCode,
            itemName: question.itemName,
            message: rule.errorMessage,
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
            message: rule.errorMessage,
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
            message: rule.errorMessage,
            severity: rule.severity,
            ruleType: rule.ruleType,
          });
        }
        break;

      case 'pattern':
        if (
          response?.responseValue &&
          typeof rule.value === 'string'
        ) {
          const regex = new RegExp(rule.value);
          if (!regex.test(response.responseValue)) {
            errors.push({
              itemCode: question.itemCode,
              itemName: question.itemName,
              message: rule.errorMessage,
              severity: rule.severity,
              ruleType: rule.ruleType,
            });
          }
        }
        break;

      // Add more rule types as needed
    }
  }

  return errors;
}

/**
 * Validate all questions in a section
 */
export function validateSection(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: { assessmentType?: string } = {}
): ValidationResult {
  const allErrors: QuestionValidationError[] = [];

  for (const question of questions) {
    const response = responses[question.itemCode];
    const questionErrors = validateQuestion(question, response, context);
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

/**
 * Get a summary of required questions that are missing
 */
export function getMissingRequiredQuestions(
  questions: OASISQuestion[],
  responses: ResponseMap,
  context: { assessmentType?: string } = {}
): OASISQuestion[] {
  return questions.filter((question) => {
    if (!question.validationRules) return false;

    const hasRequiredRule = question.validationRules.some((rule) => {
      if (rule.ruleType !== 'required') return false;

      const conditionMet = evaluateCondition(
        (rule as ValidationRule & { condition?: string }).condition,
        context
      );

      return conditionMet;
    });

    if (!hasRequiredRule) return false;

    const response = responses[question.itemCode];
    return !hasResponseValue(response);
  });
}
