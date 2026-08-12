/**
 * Value validation against a canonical question.
 *
 * This existed only inside the scribe, which meant the AI was held to the
 * form's rules and the clinician was not: a human edit or a typed value could
 * put any string into a coded field. The end-to-end run put the literal text
 * "CLINICIAN CORRECTED VALUE" into PT.GAIT.ASSIST_LEVEL, a field with six legal
 * option codes, and nothing objected.
 *
 * One implementation, used by every write path.
 */
import { CanonicalFormDefinition, CanonicalFormQuestion } from './types';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export const VALID: ValidationResult = { ok: true };

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

export function validateValue(
  question: CanonicalFormQuestion,
  value: unknown
): ValidationResult {
  // Clearing a field is always allowed; required-ness is a signature-time
  // concern, not an entry-time one. A clinician mid-visit has partial data.
  if (value === null || value === undefined || value === '') return VALID;

  if (question.options?.length) {
    const codes = question.options.map((o) => o.code);
    if (!codes.includes(String(value))) {
      return fail(
        `"${String(value)}" is not a valid option for ${question.conceptId}. ` +
          `Expected one of: ${codes.join(', ')}`
      );
    }
    return VALID;
  }

  switch (question.type) {
    case 'number':
    case 'decimal':
    case 'scale': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) {
        return fail(`${question.conceptId} expects a number, got "${String(value)}"`);
      }
      if (question.type === 'number' && !Number.isInteger(n)) {
        return fail(`${question.conceptId} expects a whole number`);
      }
      return checkRange(question, n);
    }

    case 'boolean':
      if (typeof value !== 'boolean') {
        return fail(`${question.conceptId} expects true or false`);
      }
      return VALID;

    case 'date':
    case 'datetime':
      if (Number.isNaN(new Date(String(value)).getTime())) {
        return fail(`${question.conceptId} expects a valid date`);
      }
      return VALID;

    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') {
        return fail(`${question.conceptId} expects text`);
      }
      const { minLength, maxLength, pattern, patternMessage } = question.validation ?? {};
      if (minLength !== undefined && value.length < minLength) {
        return fail(`${question.conceptId} needs at least ${minLength} characters`);
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return fail(`${question.conceptId} allows at most ${maxLength} characters`);
      }
      if (pattern && !new RegExp(pattern).test(value)) {
        return fail(patternMessage ?? `${question.conceptId} does not match the expected format`);
      }
      return VALID;
    }

    default:
      // Compound types (vitals, wounds, goal lists) carry their own structure
      // and are validated by their own editors, not here.
      return VALID;
  }
}

function checkRange(question: CanonicalFormQuestion, n: number): ValidationResult {
  const min = question.scaleMin ?? question.validation?.min;
  const max = question.scaleMax ?? question.validation?.max;

  if (min !== undefined && n < min) {
    return fail(`${question.conceptId} must be at least ${min}, got ${n}`);
  }
  if (max !== undefined && n > max) {
    return fail(`${question.conceptId} must be at most ${max}, got ${n}`);
  }
  return VALID;
}

/** Locate a question by its canonical concept id. */
export function findQuestion(
  form: CanonicalFormDefinition,
  conceptId: string
): CanonicalFormQuestion | undefined {
  for (const section of form.sections) {
    const hit = section.questions.find((q) => q.conceptId === conceptId);
    if (hit) return hit;
  }
  return undefined;
}
