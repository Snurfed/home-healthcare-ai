/**
 * Contracts for the AI proposal layer.
 *
 * The rule the whole design rests on: an agent never writes to the clinical
 * record. It emits proposals. A clinician accepts, edits or rejects, and only
 * that action produces a FieldValue.
 *
 * Three things fall out of this that cannot be retrofitted later:
 *
 *   - Provenance. Every value knows whether a human or an agent originated it,
 *     which run, against which evidence, and who accepted it.
 *   - An evaluation set. Acceptance rate and edit distance per field, gathered
 *     as a by-product of ordinary use.
 *   - Reversibility. Disabling an agent removes proposals, never chart content.
 */

export type AgentKind = 'SCRIBE' | 'INTAKE' | 'SUGGESTION' | 'COMPLIANCE';

export type ProposalStatus =
  | 'DRAFTED'
  | 'SURFACED'
  | 'WITHHELD'
  | 'ACCEPTED'
  | 'EDITED'
  | 'REJECTED'
  | 'COMMITTED';

/** A span in a transcript or document that justifies a proposed value. */
export interface EvidenceSpan {
  /** Exactly one of these identifies the source. */
  transcriptId?: string;
  documentId?: string;
  startOffset?: number;
  endOffset?: number;
  pageNumber?: number;
  /** The literal text, carried so the UI can show it without a second fetch. */
  quote: string;
}

/** What an agent returns for a single canonical field. */
export interface DraftProposal {
  questionCode: string;
  value: unknown;
  /** 0..1. Below the field's threshold the proposal is withheld, not shown. */
  confidence: number;
  evidence: EvidenceSpan[];
}

export interface AgentRunResult {
  kind: AgentKind;
  modelId: string;
  promptVersion: string;
  proposals: DraftProposal[];
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Confidence a proposal must clear before a clinician is shown it.
 *
 * Deliberately not one global number. A wrong free-text sentence costs an edit;
 * a wrong OASIS functional item costs reimbursement and invites audit, so those
 * fields are held to a far higher bar and abstain more often. Blank beats wrong
 * on anything payment-linked.
 */
export interface ConfidencePolicy {
  default: number;
  byQuestionPrefix: Record<string, number>;
}

export const DEFAULT_CONFIDENCE_POLICY: ConfidencePolicy = {
  default: 0.7,
  byQuestionPrefix: {
    // OASIS functional items drive PDGM payment. Abstain readily.
    'OASIS.GG': 0.9,
    'OASIS.M': 0.9,
    // Objective measurements are never inferred; if it wasn't said, it's blank.
    'PT.ROM': 0.85,
    'PT.MMT': 0.85,
    'VITALS': 0.85,
    // Narrative is cheap to correct.
    'PT.NARRATIVE': 0.55,
  },
};

export function thresholdFor(
  questionCode: string,
  policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY
): number {
  const match = Object.keys(policy.byQuestionPrefix)
    .filter((prefix) => questionCode.startsWith(prefix))
    // Longest prefix wins, so a specific rule beats a general one.
    .sort((a, b) => b.length - a.length)[0];

  const threshold = match === undefined ? undefined : policy.byQuestionPrefix[match];
  return threshold ?? policy.default;
}

/** The decision a clinician makes on a surfaced proposal. */
export type ProposalDecision =
  | { kind: 'accept' }
  | { kind: 'edit'; value: unknown }
  | { kind: 'reject' };
