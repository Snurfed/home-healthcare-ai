/**
 * The proposal state machine, kept free of persistence so it can be tested
 * exhaustively without a database.
 *
 *   DRAFTED ──(clears threshold)──> SURFACED ──accept/edit──> COMMITTED
 *      │                                └──reject──> REJECTED
 *      └──(below threshold)──> WITHHELD
 *
 * Withheld proposals are kept rather than discarded. Their rate per field is
 * the earliest warning that audio quality or a form template has regressed,
 * and they are the clearest map of where the model knows it is weak.
 */
import {
  ConfidencePolicy,
  DEFAULT_CONFIDENCE_POLICY,
  DraftProposal,
  ProposalDecision,
  ProposalStatus,
  thresholdFor,
} from './types';

export interface TriagedProposal extends DraftProposal {
  status: Extract<ProposalStatus, 'SURFACED' | 'WITHHELD'>;
  threshold: number;
}

/** Split a run's output into what the clinician sees and what is held back. */
export function triage(
  proposals: DraftProposal[],
  policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY
): TriagedProposal[] {
  return proposals.map((p) => {
    const threshold = thresholdFor(p.questionCode, policy);
    return {
      ...p,
      threshold,
      status: p.confidence >= threshold ? 'SURFACED' : 'WITHHELD',
    };
  });
}

/**
 * A proposal with no supporting evidence is never surfaced, whatever its
 * confidence. This is the guard against a fabricated measurement reaching a
 * clinician who is moving fast and inclined to trust the tool.
 */
export function requiresEvidence(p: DraftProposal): boolean {
  return p.evidence.length === 0;
}

export function triageStrict(
  proposals: DraftProposal[],
  policy: ConfidencePolicy = DEFAULT_CONFIDENCE_POLICY
): TriagedProposal[] {
  return triage(proposals, policy).map((p) =>
    requiresEvidence(p) ? { ...p, status: 'WITHHELD' as const } : p
  );
}

export class InvalidTransitionError extends Error {
  constructor(from: ProposalStatus, decision: ProposalDecision['kind']) {
    super(`Cannot ${decision} a proposal in state ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface DecisionOutcome {
  status: ProposalStatus;
  finalValue: unknown;
  /** Null when rejected — nothing is written. */
  commits: boolean;
  editDistance: number | null;
}

/**
 * Apply a clinician's decision. Only a SURFACED proposal can be decided: a
 * withheld one was never shown, and deciding twice is a bug worth surfacing
 * rather than silently absorbing.
 */
export function decide(
  current: ProposalStatus,
  proposedValue: unknown,
  decision: ProposalDecision
): DecisionOutcome {
  if (current !== 'SURFACED') {
    throw new InvalidTransitionError(current, decision.kind);
  }

  switch (decision.kind) {
    case 'accept':
      return { status: 'COMMITTED', finalValue: proposedValue, commits: true, editDistance: 0 };

    case 'edit':
      return {
        status: 'COMMITTED',
        finalValue: decision.value,
        commits: true,
        editDistance: editDistance(proposedValue, decision.value),
      };

    case 'reject':
      return { status: 'REJECTED', finalValue: null, commits: false, editDistance: null };
  }
}

/**
 * How far the clinician moved the value. This is the quality signal that makes
 * the system self-evaluating: a field whose proposals are always heavily edited
 * is a field the agent should abstain on, and that can be detected automatically
 * rather than waiting for someone to complain.
 *
 * Levenshtein over the string projection. Crude for numbers and structures, but
 * comparable across field types, which matters more than precision here.
 */
export function editDistance(before: unknown, after: unknown): number {
  const a = project(before);
  const b = project(after);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two rolling rows. Every index below is provably within bounds — the rows
  // are built to length b.length + 1 and j never exceeds it — but the project
  // compiles with noUncheckedIndexedAccess, which types each read as possibly
  // undefined. The `?? 0` fallbacks are unreachable and exist only to satisfy
  // that flag without scattering non-null assertions through the hot loop.
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const deletion = (prev[j] ?? 0) + 1;
      const insertion = (curr[j - 1] ?? 0) + 1;
      const substitution =
        (prev[j - 1] ?? 0) + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1);
      curr[j] = Math.min(deletion, insertion, substitution);
    }
    prev = curr;
  }
  return prev[b.length] ?? 0;
}

function project(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * Per-field quality, derived from decisions already made. No separate labelling
 * effort — ordinary use produces the evaluation set.
 */
export interface FieldQuality {
  questionCode: string;
  surfaced: number;
  withheld: number;
  accepted: number;
  edited: number;
  rejected: number;
  acceptRate: number;
  meanEditDistance: number;
  /** True when the field should be reconsidered: rarely taken as offered. */
  underperforming: boolean;
}

export function summarise(
  rows: Array<{
    questionCode: string;
    status: ProposalStatus;
    editDistance: number | null;
  }>,
  opts: { minSample?: number; acceptFloor?: number } = {}
): FieldQuality[] {
  const minSample = opts.minSample ?? 10;
  const acceptFloor = opts.acceptFloor ?? 0.5;
  const byCode = new Map<string, FieldQuality>();

  for (const row of rows) {
    const q =
      byCode.get(row.questionCode) ??
      {
        questionCode: row.questionCode,
        surfaced: 0,
        withheld: 0,
        accepted: 0,
        edited: 0,
        rejected: 0,
        acceptRate: 0,
        meanEditDistance: 0,
        underperforming: false,
      };

    if (row.status === 'WITHHELD') q.withheld++;
    if (row.status === 'REJECTED') q.rejected++;
    if (row.status === 'COMMITTED') {
      if ((row.editDistance ?? 0) === 0) q.accepted++;
      else q.edited++;
    }
    byCode.set(row.questionCode, q);
  }

  // Second pass for the rates, so distances are only averaged over commits.
  const distances = new Map<string, number[]>();
  for (const row of rows) {
    if (row.status === 'COMMITTED' && row.editDistance !== null) {
      const list = distances.get(row.questionCode) ?? [];
      list.push(row.editDistance);
      distances.set(row.questionCode, list);
    }
  }

  return [...byCode.values()].map((q) => {
    q.surfaced = q.accepted + q.edited + q.rejected;
    q.acceptRate = q.surfaced ? q.accepted / q.surfaced : 0;
    const d = distances.get(q.questionCode) ?? [];
    q.meanEditDistance = d.length ? d.reduce((s, n) => s + n, 0) / d.length : 0;
    q.underperforming = q.surfaced >= minSample && q.acceptRate < acceptFloor;
    return q;
  });
}
