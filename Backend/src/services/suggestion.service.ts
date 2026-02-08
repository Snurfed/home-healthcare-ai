/**
 * Suggestion Service
 *
 * Core suggestion engine that evaluates OASIS responses against rule definitions
 * to provide real-time guidance, optimization opportunities, and consistency checks.
 */

import prisma from '../config/prisma';
import {
  ALL_SUGGESTION_RULES,
  getRulesForQuestion,
  SuggestionRule,
  RuleContext,
  SuggestionType,
  SuggestionPriority,
} from '../constants/suggestion-rules.constants';

// =============================================================================
// TYPES
// =============================================================================

export interface QuestionSuggestion {
  id: string;
  questionCode: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  message: string;
  helpText?: string;
  financialImpact?: {
    estimatedDelta: number;
    direction: 'positive' | 'negative' | 'neutral';
    explanation: string;
  };
  relatedQuestions?: { itemCode: string; itemName: string; action: string }[];
  actionLabel?: string;
  actionTarget?: string;
  dismissible: boolean;
}

export interface GetSuggestionsInput {
  assessmentId: string;
  questionCode: string;
  currentValue: string | number | null;
  allResponses: Record<string, string | null>;
}

export interface DismissSuggestionInput {
  assessmentId: string;
  suggestionId: string;
  questionCode: string;
  reason: 'addressed' | 'not_applicable' | 'reviewed';
  userId: string;
}

export interface SuggestionsSummary {
  assessmentId: string;
  totalSuggestions: number;
  byType: Record<SuggestionType, number>;
  byPriority: Record<SuggestionPriority, number>;
  dismissed: number;
  active: number;
  totalFinancialOpportunity: number;
  topSuggestions: QuestionSuggestion[];
}

// =============================================================================
// MAIN SERVICE FUNCTIONS
// =============================================================================

/**
 * Get suggestions for a specific question in an assessment
 */
export async function getSuggestionsForQuestion(
  input: GetSuggestionsInput
): Promise<QuestionSuggestion[]> {
  const { assessmentId, questionCode, currentValue, allResponses } = input;

  // Get dismissed suggestions for this assessment
  const dismissedSuggestions = await getDismissedSuggestionIds(assessmentId);

  // Get rules that trigger on this question
  const applicableRules = getRulesForQuestion(questionCode);

  if (applicableRules.length === 0) {
    return [];
  }

  // Build context for rule evaluation
  const context = buildRuleContext(questionCode, currentValue, allResponses);

  // Evaluate each rule
  const suggestions: QuestionSuggestion[] = [];

  for (const ruleDef of applicableRules) {
    try {
      if (ruleDef.condition.evaluate(context)) {
        const suggestion = createSuggestionFromRule(ruleDef.rule, questionCode);

        // Skip if dismissed
        if (!dismissedSuggestions.has(suggestion.id)) {
          suggestions.push(suggestion);
        }
      }
    } catch (error) {
      // Log but don't fail - suggestions are non-critical
      console.error(`Error evaluating rule ${ruleDef.rule.id}:`, error);
    }
  }

  // Sort by priority
  return sortSuggestionsByPriority(suggestions);
}

/**
 * Get all active suggestions for an assessment (for summary)
 */
export async function getAllSuggestionsForAssessment(
  assessmentId: string
): Promise<QuestionSuggestion[]> {
  // Get all responses for the assessment
  const responses = await prisma.oasisResponse.findMany({
    where: { assessmentId },
    select: {
      itemCode: true,
      responseValue: true,
      responseCode: true,
    },
  });

  // Build response map
  const allResponses: Record<string, string | null> = {};
  for (const response of responses) {
    allResponses[response.itemCode] = response.responseValue || response.responseCode || null;
  }

  // Get dismissed suggestions
  const dismissedSuggestions = await getDismissedSuggestionIds(assessmentId);

  // Evaluate all rules
  const suggestions: QuestionSuggestion[] = [];
  const processedRules = new Set<string>();

  for (const ruleDef of ALL_SUGGESTION_RULES) {
    // Skip if already processed this rule
    if (processedRules.has(ruleDef.rule.id)) continue;

    // Find a trigger question that has a value
    const triggerWithValue = ruleDef.condition.triggerQuestions.find(
      q => allResponses[q] !== undefined
    );

    if (!triggerWithValue) continue;

    const context = buildRuleContext(
      triggerWithValue,
      allResponses[triggerWithValue] ?? null,
      allResponses
    );

    try {
      if (ruleDef.condition.evaluate(context)) {
        const suggestion = createSuggestionFromRule(ruleDef.rule, triggerWithValue);

        if (!dismissedSuggestions.has(suggestion.id)) {
          suggestions.push(suggestion);
          processedRules.add(ruleDef.rule.id);
        }
      }
    } catch (error) {
      console.error(`Error evaluating rule ${ruleDef.rule.id}:`, error);
    }
  }

  return sortSuggestionsByPriority(suggestions);
}

/**
 * Get suggestions summary for an assessment
 */
export async function getSuggestionsSummary(
  assessmentId: string
): Promise<SuggestionsSummary> {
  const allSuggestions = await getAllSuggestionsForAssessment(assessmentId);
  const dismissedCount = await prisma.suggestionDismissal.count({
    where: { assessmentId },
  });

  const byType: Record<SuggestionType, number> = {
    HELP: 0,
    OPTIMIZATION: 0,
    INCONSISTENCY: 0,
    REQUIRED_FOLLOWUP: 0,
    REVENUE_RISK: 0,
  };

  const byPriority: Record<SuggestionPriority, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  let totalFinancialOpportunity = 0;

  for (const suggestion of allSuggestions) {
    byType[suggestion.type]++;
    byPriority[suggestion.priority]++;

    if (suggestion.financialImpact?.direction === 'positive') {
      totalFinancialOpportunity += suggestion.financialImpact.estimatedDelta;
    }
  }

  // Get top suggestions (first 5 high priority)
  const topSuggestions = allSuggestions
    .filter(s => s.priority === 'high')
    .slice(0, 5);

  return {
    assessmentId,
    totalSuggestions: allSuggestions.length + dismissedCount,
    byType,
    byPriority,
    dismissed: dismissedCount,
    active: allSuggestions.length,
    totalFinancialOpportunity,
    topSuggestions,
  };
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(
  input: DismissSuggestionInput
): Promise<void> {
  const { assessmentId, suggestionId, questionCode, reason, userId } = input;

  await prisma.suggestionDismissal.upsert({
    where: {
      assessmentId_suggestionId: {
        assessmentId,
        suggestionId,
      },
    },
    create: {
      assessmentId,
      suggestionId,
      questionCode,
      reason,
      dismissedBy: userId,
    },
    update: {
      reason,
      dismissedBy: userId,
      dismissedAt: new Date(),
    },
  });
}

/**
 * Get list of dismissed suggestion IDs for an assessment
 */
export async function getDismissedSuggestionIds(
  assessmentId: string
): Promise<Set<string>> {
  const dismissals = await prisma.suggestionDismissal.findMany({
    where: { assessmentId },
    select: { suggestionId: true },
  });

  return new Set(dismissals.map(d => d.suggestionId));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build context for rule evaluation
 */
function buildRuleContext(
  questionCode: string,
  currentValue: string | number | null,
  allResponses: Record<string, string | null>
): RuleContext {
  // Convert responses to Map for rule evaluation
  const responsesMap = new Map<string, string | null>();
  for (const [key, value] of Object.entries(allResponses)) {
    responsesMap.set(key, value);
  }

  // Extract diagnoses for convenience
  const primaryDiagnosis = extractPrimaryDiagnosis(responsesMap);
  const secondaryDiagnoses = extractSecondaryDiagnoses(responsesMap);

  return {
    currentQuestionCode: questionCode,
    currentValue: currentValue !== null ? String(currentValue) : null,
    allResponses: responsesMap,
    primaryDiagnosis,
    secondaryDiagnoses,
  };
}

/**
 * Extract primary diagnosis from M1021 response
 */
function extractPrimaryDiagnosis(responses: Map<string, string | null>): string | undefined {
  const m1021 = responses.get('M1021');
  if (m1021 === null || m1021 === undefined) return undefined;
  const match = m1021.match(/^([A-Z]\d{2}\.?\d{0,4})/);
  return match && match[1] ? match[1].replace('.', '') : m1021.slice(0, 7).replace('.', '');
}

/**
 * Extract secondary diagnoses from M1023
 */
function extractSecondaryDiagnoses(responses: Map<string, string | null>): string[] {
  const m1023 = responses.get('M1023');
  if (!m1023) return [];
  try {
    const parsed = JSON.parse(m1023);
    if (Array.isArray(parsed)) {
      return parsed.map(d => typeof d === 'string' ? d : d.code || d.value).filter(Boolean);
    }
  } catch {
    return m1023.split(',').map(d => d.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Create a suggestion object from a rule definition
 */
function createSuggestionFromRule(
  rule: SuggestionRule,
  triggerQuestionCode: string
): QuestionSuggestion {
  return {
    id: `${rule.id}-${triggerQuestionCode}`,
    questionCode: triggerQuestionCode,
    type: rule.type,
    priority: rule.priority,
    title: rule.title,
    message: rule.message,
    helpText: rule.helpText,
    financialImpact: rule.financialImpact,
    relatedQuestions: rule.relatedQuestions,
    actionLabel: rule.actionLabel,
    actionTarget: rule.actionTarget,
    dismissible: rule.dismissible,
  };
}

/**
 * Sort suggestions by priority (high first, then medium, then low)
 */
function sortSuggestionsByPriority(suggestions: QuestionSuggestion[]): QuestionSuggestion[] {
  const priorityOrder: Record<SuggestionPriority, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  return suggestions.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Secondary sort by type (revenue risk and inconsistency first)
    const typeOrder: Record<SuggestionType, number> = {
      REVENUE_RISK: 1,
      INCONSISTENCY: 2,
      REQUIRED_FOLLOWUP: 3,
      OPTIMIZATION: 4,
      HELP: 5,
    };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

// =============================================================================
// CATEGORY-SPECIFIC EVALUATION FUNCTIONS (for extensibility)
// =============================================================================

/**
 * Evaluate diagnosis-based rules
 */
export function evaluateDiagnosisBasedRules(
  context: RuleContext
): QuestionSuggestion[] {
  return evaluateRuleCategory(context, 'REQUIRED_FOLLOWUP');
}

/**
 * Evaluate comorbidity optimization rules
 */
export function evaluateComorbidityOptimizationRules(
  context: RuleContext
): QuestionSuggestion[] {
  return evaluateRuleCategory(context, 'OPTIMIZATION');
}

/**
 * Evaluate inconsistency rules
 */
export function evaluateInconsistencyRules(
  context: RuleContext
): QuestionSuggestion[] {
  return evaluateRuleCategory(context, 'INCONSISTENCY');
}

/**
 * Evaluate functional guidance rules
 */
export function evaluateFunctionalGuidanceRules(
  context: RuleContext
): QuestionSuggestion[] {
  return evaluateRuleCategory(context, 'HELP');
}

/**
 * Evaluate revenue at risk rules
 */
export function evaluateRevenueAtRiskRules(
  context: RuleContext
): QuestionSuggestion[] {
  return evaluateRuleCategory(context, 'REVENUE_RISK');
}

/**
 * Helper to evaluate rules of a specific type
 */
function evaluateRuleCategory(
  context: RuleContext,
  ruleType: SuggestionType
): QuestionSuggestion[] {
  const suggestions: QuestionSuggestion[] = [];

  for (const ruleDef of ALL_SUGGESTION_RULES) {
    if (ruleDef.rule.type !== ruleType) continue;
    if (!ruleDef.condition.triggerQuestions.includes(context.currentQuestionCode)) continue;

    try {
      if (ruleDef.condition.evaluate(context)) {
        suggestions.push(createSuggestionFromRule(ruleDef.rule, context.currentQuestionCode));
      }
    } catch (error) {
      console.error(`Error evaluating rule ${ruleDef.rule.id}:`, error);
    }
  }

  return suggestions;
}
