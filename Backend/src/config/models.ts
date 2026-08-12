/**
 * Every model id the application uses, in one place.
 *
 * This file exists because the ids rotted silently. The codebase had pinned
 * `claude-sonnet-4-20250514` in eight service files and two Haiku ids in two
 * more; all three had been retired and every call returned 404, so each of
 * those AI features was dead at runtime with nothing to indicate it.
 *
 * Rules:
 *   - Import from here. Never write a model id as a literal in a service.
 *   - Choose by role, not by name, so a tier change is one edit.
 *   - `npm run models:check` verifies these against the live API. Run it in CI;
 *     a retired model should fail a build, not a patient visit.
 */

export const MODELS = {
  /**
   * Structured clinical extraction — scribe, OASIS, referral parsing.
   * Accuracy dominates: an error here reaches the chart or the claim.
   */
  EXTRACTION: 'claude-sonnet-5',

  /**
   * Narrative generation — SOAP notes, visit notes, physician communications.
   * Reviewed by a clinician before it counts, so a mid tier is appropriate.
   */
  GENERATION: 'claude-sonnet-5',

  /**
   * Latency-sensitive work inside a live visit: partial-transcript extraction
   * and event detection. Speed matters more than depth, and everything here is
   * re-checked by a slower pass before it becomes a proposal.
   */
  REALTIME: 'claude-haiku-4-5-20251001',

  /**
   * Highest-stakes reasoning. Reserved for compliance review before signature,
   * where a miss is a survey or reimbursement exposure.
   */
  COMPLIANCE: 'claude-opus-5',
} as const;

export type ModelRole = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelRole];

/** Distinct ids in use, for the startup and CI checks. */
export function modelIdsInUse(): string[] {
  return [...new Set(Object.values(MODELS))];
}
