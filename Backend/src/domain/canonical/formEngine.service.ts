/**
 * Form Engine Service
 *
 * Responsible for:
 * - Building UI-ready form structures from CanonicalFormDefinitions
 * - Evaluating visibility rules
 * - Validating responses
 * - Computing derived values
 */

import type {
  CanonicalFormDefinition,
  CanonicalFormSection,
  CanonicalFormQuestion,
  CanonicalVisitNote,
  CanonicalResponse,
  CanonicalValue,
  CanonicalValidationResult,
  ValidationError,
  VisibilityCondition,
  CanonicalVisibilityRule,
  Discipline,
  VisitType,
} from './types';
import { getFormDefinition, requiresOasis } from './formDefinitions';

// =============================================================================
// FORM BUILDING
// =============================================================================

export interface BuiltForm {
  definition: CanonicalFormDefinition;
  sections: BuiltSection[];
  activeModules: string[];
  requiresOasis: boolean;
  validationState: FormValidationState;
}

export interface BuiltSection {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  required: boolean;
  collapsed: boolean;
  visible: boolean;
  aiDraftEnabled: boolean;
  questions: BuiltQuestion[];
  completionPercent: number;
}

export interface BuiltQuestion {
  id: string;
  conceptId: string;
  label: string;
  shortLabel?: string;
  helpText?: string;
  type: string;
  required: boolean;
  visible: boolean;
  enabled: boolean;
  currentValue?: CanonicalValue;
  defaultValue?: CanonicalValue;
  options?: Array<{ code: string; label: string; description?: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  };
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<number, string>;
  aiDraftEnabled?: boolean;
  oasisItemCode?: string;
  errors: string[];
  warnings: string[];
}

export interface FormValidationState {
  isValid: boolean;
  canSubmit: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  completionPercent: number;
  requiredMissing: string[];
}

/**
 * Build a complete UI-ready form from a canonical definition
 */
export function buildForm(
  discipline: Discipline,
  visitType: VisitType,
  responses: Record<string, CanonicalResponse> = {},
  activeModules: string[] = []
): BuiltForm {
  const definition = getFormDefinition(discipline, visitType);

  if (!definition) {
    throw new Error(`No form definition found for ${discipline} ${visitType}`);
  }

  const builtSections: BuiltSection[] = [];
  let totalQuestions = 0;
  let answeredQuestions = 0;
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  const requiredMissing: string[] = [];

  for (const section of definition.sections) {
    const builtSection = buildSection(section, responses, activeModules);
    builtSections.push(builtSection);

    // Aggregate stats
    if (builtSection.visible) {
      for (const q of builtSection.questions) {
        if (q.visible) {
          totalQuestions++;
          if (hasValue(responses[q.conceptId]?.value)) {
            answeredQuestions++;
          }
          if (q.required && !hasValue(responses[q.conceptId]?.value)) {
            requiredMissing.push(q.conceptId);
          }
          q.errors.forEach(e => allErrors.push({
            conceptId: q.conceptId,
            message: e,
            severity: 'error',
          }));
          q.warnings.forEach(w => allWarnings.push({
            conceptId: q.conceptId,
            message: w,
            severity: 'warning',
          }));
        }
      }
    }
  }

  const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const isValid = allErrors.length === 0 && requiredMissing.length === 0;

  return {
    definition,
    sections: builtSections,
    activeModules,
    requiresOasis: requiresOasis(visitType),
    validationState: {
      isValid,
      canSubmit: isValid,
      errors: allErrors,
      warnings: allWarnings,
      completionPercent,
      requiredMissing,
    },
  };
}

function buildSection(
  section: CanonicalFormSection,
  responses: Record<string, CanonicalResponse>,
  activeModules: string[]
): BuiltSection {
  // Check section visibility
  const visible = evaluateVisibilityRules(section.visibilityRules, responses, activeModules);

  const builtQuestions: BuiltQuestion[] = [];
  let answeredCount = 0;
  let visibleCount = 0;

  for (const question of section.questions) {
    const builtQ = buildQuestion(question, responses, activeModules);
    builtQuestions.push(builtQ);

    if (builtQ.visible) {
      visibleCount++;
      if (hasValue(builtQ.currentValue)) {
        answeredCount++;
      }
    }
  }

  const completionPercent = visibleCount > 0 ? Math.round((answeredCount / visibleCount) * 100) : 100;

  return {
    id: section.id,
    sectionId: section.sectionId,
    name: section.name,
    description: section.description,
    required: section.required,
    collapsed: section.collapsed ?? false,
    visible,
    aiDraftEnabled: section.aiDraftEnabled ?? false,
    questions: builtQuestions,
    completionPercent,
  };
}

function buildQuestion(
  question: CanonicalFormQuestion,
  responses: Record<string, CanonicalResponse>,
  activeModules: string[]
): BuiltQuestion {
  const response = responses[question.conceptId];
  const currentValue = response?.value;

  // Evaluate visibility
  const visible = evaluateVisibilityRules(question.visibilityRules, responses, activeModules);

  // Evaluate if required dynamically
  let required = question.required;
  if (question.visibilityRules) {
    const requireRule = question.visibilityRules.find(r => r.type === 'require_when');
    if (requireRule) {
      required = evaluateSingleRule(requireRule, responses, activeModules);
    }
  }

  // Validate current value
  const { errors, warnings } = validateQuestionValue(question, currentValue, visible, required);

  return {
    id: question.id,
    conceptId: question.conceptId,
    label: question.label,
    shortLabel: question.shortLabel,
    helpText: question.helpText,
    type: question.type,
    required,
    visible,
    enabled: true, // Could add disabled state logic
    currentValue,
    defaultValue: question.defaultValue,
    options: question.options?.map(o => ({
      code: o.code,
      label: o.label,
      description: o.description,
    })),
    validation: question.validation,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    scaleLabels: question.scaleLabels,
    aiDraftEnabled: question.aiDraftEnabled,
    oasisItemCode: question.oasisItemCode,
    errors,
    warnings,
  };
}

// =============================================================================
// VISIBILITY EVALUATION
// =============================================================================

function evaluateVisibilityRules(
  rules: CanonicalVisibilityRule[] | undefined,
  responses: Record<string, CanonicalResponse>,
  activeModules: string[]
): boolean {
  if (!rules || rules.length === 0) return true;

  // If any show_when rule matches, show the field
  // If any hide_when rule matches, hide the field
  for (const rule of rules) {
    const ruleResult = evaluateSingleRule(rule, responses, activeModules);

    if (rule.type === 'hide_when' && ruleResult) {
      return false;
    }
    if (rule.type === 'show_when' && !ruleResult) {
      return false;
    }
  }

  return true;
}

function evaluateSingleRule(
  rule: CanonicalVisibilityRule,
  responses: Record<string, CanonicalResponse>,
  activeModules: string[]
): boolean {
  const results = rule.conditions.map(c => evaluateCondition(c, responses, activeModules));

  if (rule.operator === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

function evaluateCondition(
  condition: VisibilityCondition,
  responses: Record<string, CanonicalResponse>,
  activeModules: string[]
): boolean {
  // Special handling for module_active operator
  if (condition.operator === 'module_active') {
    return activeModules.includes(condition.value as string);
  }

  const responseValue = responses[condition.field]?.value;

  switch (condition.operator) {
    case 'equals':
      return responseValue === condition.value;

    case 'not_equals':
      return responseValue !== condition.value;

    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(responseValue as string);
      }
      return false;

    case 'not_in':
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(responseValue as string);
      }
      return true;

    case 'greater_than':
      if (typeof responseValue === 'number' && typeof condition.value === 'number') {
        return responseValue > condition.value;
      }
      return false;

    case 'less_than':
      if (typeof responseValue === 'number' && typeof condition.value === 'number') {
        return responseValue < condition.value;
      }
      return false;

    case 'contains':
      if (Array.isArray(responseValue)) {
        return responseValue.includes(condition.value as string);
      }
      if (typeof responseValue === 'string' && typeof condition.value === 'string') {
        return responseValue.includes(condition.value);
      }
      return false;

    case 'is_set':
      return hasValue(responseValue);

    case 'is_not_set':
      return !hasValue(responseValue);

    default:
      return false;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateQuestionValue(
  question: CanonicalFormQuestion,
  value: CanonicalValue | undefined,
  visible: boolean,
  required: boolean
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only validate if visible
  if (!visible) return { errors, warnings };

  // Required check
  if (required && !hasValue(value)) {
    errors.push(`${question.label} is required`);
    return { errors, warnings };
  }

  // Skip further validation if no value
  if (!hasValue(value)) return { errors, warnings };

  const validation = question.validation;
  if (!validation) return { errors, warnings };

  // Numeric validation
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push(`${question.label} must be at least ${validation.min}`);
    }
    if (validation.max !== undefined && value > validation.max) {
      errors.push(`${question.label} must be at most ${validation.max}`);
    }
  }

  // String validation
  if (typeof value === 'string') {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      errors.push(`${question.label} must be at least ${validation.minLength} characters`);
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      errors.push(`${question.label} must be at most ${validation.maxLength} characters`);
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push(validation.patternMessage || `${question.label} format is invalid`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate an entire visit note
 */
export function validateVisitNote(
  visitNote: CanonicalVisitNote
): CanonicalValidationResult {
  const form = buildForm(
    visitNote.discipline,
    visitNote.visitType,
    visitNote.responses,
    visitNote.activeModules
  );

  const missingRequired = form.validationState.requiredMissing;

  return {
    valid: form.validationState.isValid,
    errors: form.validationState.errors,
    warnings: form.validationState.warnings,
    completionPercentage: form.validationState.completionPercent,
    missingRequired,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function hasValue(value: CanonicalValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Get the next incomplete section
 */
export function getNextIncompleteSection(form: BuiltForm): BuiltSection | undefined {
  return form.sections.find(s => s.visible && s.completionPercent < 100);
}

/**
 * Get all unanswered required questions
 */
export function getUnansweredRequired(form: BuiltForm): BuiltQuestion[] {
  const questions: BuiltQuestion[] = [];

  for (const section of form.sections) {
    if (!section.visible) continue;

    for (const question of section.questions) {
      if (question.visible && question.required && !hasValue(question.currentValue)) {
        questions.push(question);
      }
    }
  }

  return questions;
}

/**
 * Extract OASIS-mapped responses for submission
 */
export function extractOasisResponses(
  visitNote: CanonicalVisitNote
): Record<string, { conceptId: string; oasisItemCode: string; value: CanonicalValue }> {
  const form = buildForm(
    visitNote.discipline,
    visitNote.visitType,
    visitNote.responses,
    visitNote.activeModules
  );

  const oasisResponses: Record<string, { conceptId: string; oasisItemCode: string; value: CanonicalValue }> = {};

  for (const section of form.sections) {
    for (const question of section.questions) {
      if (question.oasisItemCode && question.visible && hasValue(question.currentValue)) {
        oasisResponses[question.oasisItemCode] = {
          conceptId: question.conceptId,
          oasisItemCode: question.oasisItemCode,
          value: question.currentValue!,
        };
      }
    }
  }

  return oasisResponses;
}

export default {
  buildForm,
  validateVisitNote,
  getNextIncompleteSection,
  getUnansweredRequired,
  extractOasisResponses,
};
