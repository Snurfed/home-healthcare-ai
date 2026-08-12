/**
 * The forms the system can open.
 *
 * Lives in the domain rather than the controller so the persistence layer can
 * validate against a question definition too — without it, only the HTTP layer
 * knew what a field was allowed to contain.
 */
import { CanonicalFormDefinition, CanonicalFormQuestion } from '../types';
import { findQuestion } from '../validation';
import { PT_EVALUATION_V1 } from './ptEvaluation';

export const FORM_REGISTRY: Record<string, CanonicalFormDefinition> = {
  [PT_EVALUATION_V1.id]: PT_EVALUATION_V1,
};

export function getForm(formCode: string): CanonicalFormDefinition | undefined {
  return FORM_REGISTRY[formCode];
}

export function listForms(): string[] {
  return Object.keys(FORM_REGISTRY);
}

/**
 * Resolve a question from a form code. Returns undefined when either the form
 * or the question is unknown — callers decide whether that is an error or a
 * field they simply don't govern.
 */
export function questionFor(
  formCode: string,
  conceptId: string
): CanonicalFormQuestion | undefined {
  const form = getForm(formCode);
  return form ? findQuestion(form, conceptId) : undefined;
}
