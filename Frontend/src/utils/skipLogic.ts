/**
 * Skip Logic Utilities
 *
 * Evaluates conditional visibility of OASIS questions based on responses
 */

import type { OASISQuestion, OASISResponse, SkipLogicCondition } from '@typedefs/index';

/**
 * Response map type - itemCode to response value
 */
type ResponseMap = Record<string, Partial<OASISResponse> | undefined>;

/**
 * Parse a skip logic condition string like "M1306 = 0" or "M1240 != 1"
 */
function parseConditionString(condition: string): SkipLogicCondition | null {
  // Match patterns like: M1306 = 0, M1240 != 1, M1000 IN (1,2,3), M1500 > 5
  const patterns = [
    // Equals: M1306 = 0
    /^(\w+)\s*=\s*(.+)$/,
    // Not equals: M1306 != 0
    /^(\w+)\s*!=\s*(.+)$/,
    // Greater than: M1500 > 5
    /^(\w+)\s*>\s*(.+)$/,
    // Less than: M1500 < 5
    /^(\w+)\s*<\s*(.+)$/,
    // In: M1000 IN (1,2,3)
    /^(\w+)\s+IN\s*\((.+)\)$/i,
    // Not in: M1000 NOT IN (1,2,3)
    /^(\w+)\s+NOT\s+IN\s*\((.+)\)$/i,
  ];

  const operatorMap: Record<number, SkipLogicCondition['operator']> = {
    0: 'equals',
    1: 'notEquals',
    2: 'greaterThan',
    3: 'lessThan',
    4: 'in',
    5: 'notIn',
  };

  for (let i = 0; i < patterns.length; i++) {
    const match = condition.match(patterns[i]!);
    if (match) {
      const [, itemCode, valueStr] = match;
      const operator = operatorMap[i]!;

      let value: string | string[] | number;
      if (operator === 'in' || operator === 'notIn') {
        // Parse comma-separated values
        value = valueStr!.split(',').map((v) => v.trim());
      } else if (!isNaN(Number(valueStr))) {
        value = Number(valueStr);
      } else {
        value = valueStr!.trim();
      }

      return {
        dependsOn: itemCode!,
        operator,
        value,
      };
    }
  }

  return null;
}

/**
 * Get the response value for comparison
 */
function getResponseValue(response: Partial<OASISResponse> | undefined): string | number | null {
  if (!response) return null;

  // Check numeric first
  if (response.responseNumeric !== undefined && response.responseNumeric !== null) {
    return response.responseNumeric;
  }

  // Then code
  if (response.responseCode) {
    return response.responseCode;
  }

  // Then value
  if (response.responseValue) {
    return response.responseValue;
  }

  return null;
}

/**
 * Evaluate a single skip logic condition
 */
export function evaluateCondition(
  condition: SkipLogicCondition,
  responses: ResponseMap
): boolean {
  const response = responses[condition.dependsOn];
  const responseValue = getResponseValue(response);

  // If the dependent question hasn't been answered, condition is not met
  if (responseValue === null) {
    return false;
  }

  const { operator, value } = condition;

  switch (operator) {
    case 'equals':
      return String(responseValue) === String(value);

    case 'notEquals':
      return String(responseValue) !== String(value);

    case 'greaterThan':
      return typeof responseValue === 'number' && typeof value === 'number'
        ? responseValue > value
        : false;

    case 'lessThan':
      return typeof responseValue === 'number' && typeof value === 'number'
        ? responseValue < value
        : false;

    case 'in':
      return Array.isArray(value) && value.includes(String(responseValue));

    case 'notIn':
      return Array.isArray(value) && !value.includes(String(responseValue));

    default:
      return false;
  }
}

/**
 * Skip logic as stored in the database (from seed)
 */
interface DatabaseSkipLogic {
  condition: string;
  skipToItem: string;
  reason: string;
}

/**
 * Determine which questions should be visible based on skip logic
 *
 * @param questions - All questions in the section (sorted by sortOrder)
 * @param responses - Current responses (saved + draft)
 * @returns Set of itemCodes that should be hidden
 */
export function getHiddenQuestions(
  questions: OASISQuestion[],
  responses: ResponseMap
): Set<string> {
  const hidden = new Set<string>();
  const sortedQuestions = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const question of sortedQuestions) {
    // Skip if no skip logic defined
    if (!question.skipLogic) continue;

    // Handle array of SkipLogicCondition (frontend format)
    if (Array.isArray(question.skipLogic)) {
      // This format means: show this question only if ALL conditions are met
      // If conditions are NOT met, hide this question
      const allConditionsMet = question.skipLogic.every((cond) =>
        evaluateCondition(cond, responses)
      );

      if (!allConditionsMet) {
        hidden.add(question.itemCode);
      }
    }
    // Handle database format with condition string
    else if (typeof question.skipLogic === 'object' && 'condition' in question.skipLogic) {
      const dbSkipLogic = question.skipLogic as unknown as DatabaseSkipLogic;
      const parsedCondition = parseConditionString(dbSkipLogic.condition);

      if (parsedCondition && evaluateCondition(parsedCondition, responses)) {
        // Condition is met - hide questions between current and skipToItem
        const currentIndex = sortedQuestions.findIndex(
          (q) => q.itemCode === question.itemCode
        );
        const skipToIndex = sortedQuestions.findIndex(
          (q) => q.itemCode === dbSkipLogic.skipToItem
        );

        if (currentIndex !== -1 && skipToIndex !== -1 && skipToIndex > currentIndex) {
          // Hide all questions between current and skipTo (exclusive)
          for (let i = currentIndex + 1; i < skipToIndex; i++) {
            hidden.add(sortedQuestions[i]!.itemCode);
          }
        }
      }
    }
  }

  return hidden;
}

/**
 * Filter questions to only show visible ones based on skip logic
 */
export function filterVisibleQuestions(
  questions: OASISQuestion[],
  responses: ResponseMap
): OASISQuestion[] {
  const hidden = getHiddenQuestions(questions, responses);
  return questions.filter((q) => !hidden.has(q.itemCode));
}

/**
 * Check if a specific question is visible
 */
export function isQuestionVisible(
  question: OASISQuestion,
  allQuestions: OASISQuestion[],
  responses: ResponseMap
): boolean {
  const hidden = getHiddenQuestions(allQuestions, responses);
  return !hidden.has(question.itemCode);
}
