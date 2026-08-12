/**
 * Persistence for the proposal loop. All the decision logic lives in
 * domain/proposals/stateMachine.ts and is unit-tested without a database; this
 * file is the thin layer that records it.
 *
 * The invariant worth protecting: a FieldValue is only ever created inside the
 * same transaction that moves a proposal to COMMITTED. If that ever drifts
 * apart, the chart can disagree with its own provenance trail, which is the one
 * failure mode that would be unrecoverable at audit.
 */
import { Prisma, ProposalStatus } from '../../generated/prisma';
import { TxClient } from '../../config/tenancy';

import {
  decide,
  triageStrict,
} from '../../domain/proposals/stateMachine';
import {
  AgentRunResult,
  ConfidencePolicy,
  DEFAULT_CONFIDENCE_POLICY,
  ProposalDecision,
} from '../../domain/proposals/types';
import { questionFor } from '../../domain/canonical/forms/registry';
import { validateValue } from '../../domain/canonical/validation';

/**
 * A value rejected by the form's own rules. Raised for human writes as well as
 * agent ones — the scribe was already checked against the question definition
 * and the clinician was not, which let free text into coded fields.
 */
export class ValueRejectedError extends Error {
  constructor(
    public readonly questionCode: string,
    reason: string
  ) {
    super(reason);
    this.name = 'ValueRejectedError';
  }
}

export interface RecordRunArgs {
  agencyId: string;
  formInstanceId: string;
  result: AgentRunResult;
  policy?: ConfidencePolicy;
}

export interface RecordRunOutcome {
  agentRunId: string;
  surfaced: number;
  withheld: number;
}

/**
 * Every method takes the transaction opened by withTenant() rather than a
 * client of its own. Row-level security keys off a transaction-local setting,
 * so a query issued outside that transaction is unscoped — and unscoped now
 * means it returns nothing. Taking the tx as a parameter makes it impossible to
 * forget: there is no client here to accidentally use.
 */
export class ProposalService {

  /**
   * Persist an agent run and its proposals, already triaged into what the
   * clinician will see and what was held back.
   *
   * Withheld proposals are stored rather than dropped. Their rate per field is
   * the earliest signal that audio quality or a form template has regressed,
   * and they map exactly where the model knows it is weak.
   */
  async recordRun(tx: TxClient, args: RecordRunArgs): Promise<RecordRunOutcome> {
    const { agencyId, formInstanceId, result } = args;
    const policy = args.policy ?? DEFAULT_CONFIDENCE_POLICY;
    const triaged = triageStrict(result.proposals, policy);

    {
      const run = await tx.agentRun.create({
        data: {
          agencyId,
          kind: result.kind,
          modelId: result.modelId,
          promptVersion: result.promptVersion,
          inputHash: hashInput(formInstanceId, result),
          latencyMs: result.latencyMs ?? null,
          inputTokens: result.inputTokens ?? null,
          outputTokens: result.outputTokens ?? null,
        },
      });

      for (const p of triaged) {
        await tx.proposal.create({
          data: {
            agencyId,
            agentRunId: run.id,
            formInstanceId,
            questionCode: p.questionCode,
            proposedValue: p.value as Prisma.InputJsonValue,
            confidence: new Prisma.Decimal(p.confidence.toFixed(2)),
            status: p.status,
            evidence: {
              create: p.evidence.map((e) => ({
                transcriptId: e.transcriptId ?? null,
                documentId: e.documentId ?? null,
                startOffset: e.startOffset ?? null,
                endOffset: e.endOffset ?? null,
                pageNumber: e.pageNumber ?? null,
                quote: e.quote,
              })),
            },
          },
        });
      }

      return {
        agentRunId: run.id,
        surfaced: triaged.filter((p) => p.status === 'SURFACED').length,
        withheld: triaged.filter((p) => p.status === 'WITHHELD').length,
      };
    }
  }

  /** What the clinician is asked to review, newest run first. */
  async surfacedFor(tx: TxClient, formInstanceId: string) {
    return tx.proposal.findMany({
      where: { formInstanceId, status: ProposalStatus.SURFACED },
      include: { evidence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Apply a clinician's accept / edit / reject.
   *
   * Committing writes the FieldValue in the same transaction and links it back
   * to the proposal, so provenance can never be orphaned. An existing value for
   * the same question is superseded rather than overwritten — history is part
   * of the record, and a surveyor may ask what changed and when.
   */
  async decide(
    tx: TxClient,
    proposalId: string,
    clinicianId: string,
    decision: ProposalDecision
  ) {
    {
      const proposal = await tx.proposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: { formInstance: { select: { formCode: true } } },
      });

      // An edited value goes through exactly the same rules the agent's did.
      if (decision.kind === 'edit') {
        assertValueAllowed(
          proposal.formInstance.formCode,
          proposal.questionCode,
          decision.value
        );
      }

      // Throws InvalidTransitionError if this proposal was never surfaced or
      // has already been decided. Deciding twice is a bug worth surfacing.
      const outcome = decide(
        proposal.status as ProposalStatus,
        proposal.proposedValue,
        decision
      );

      const updated = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: outcome.status,
          decidedById: clinicianId,
          decidedAt: new Date(),
          finalValue: outcome.commits
            ? (outcome.finalValue as Prisma.InputJsonValue)
            : Prisma.DbNull,
          editDistance: outcome.editDistance,
        },
      });

      if (!outcome.commits) return { proposal: updated, fieldValue: null };

      const superseded = await tx.fieldValue.findFirst({
        where: {
          formInstanceId: proposal.formInstanceId,
          questionCode: proposal.questionCode,
          supersededBy: { is: null },
        },
      });

      const fieldValue = await tx.fieldValue.create({
        data: {
          agencyId: proposal.agencyId,
          formInstanceId: proposal.formInstanceId,
          questionCode: proposal.questionCode,
          value: outcome.finalValue as Prisma.InputJsonValue,
          source: 'AGENT',
          proposalId: proposal.id,
          enteredById: clinicianId,
          supersedesId: superseded?.id ?? null,
        },
      });

      return { proposal: updated, fieldValue };
    }
  }

  /**
   * A value the clinician typed themselves, with no agent involved. Same
   * supersession rule, so human and agent edits share one history.
   */
  async setManualValue(tx: TxClient, args: {
    agencyId: string;
    formInstanceId: string;
    questionCode: string;
    value: unknown;
    clinicianId: string;
  }) {
    {
      const form = await tx.formInstance.findUniqueOrThrow({
        where: { id: args.formInstanceId },
        select: { formCode: true },
      });
      assertValueAllowed(form.formCode, args.questionCode, args.value);

      const superseded = await tx.fieldValue.findFirst({
        where: {
          formInstanceId: args.formInstanceId,
          questionCode: args.questionCode,
          supersededBy: { is: null },
        },
      });

      return tx.fieldValue.create({
        data: {
          agencyId: args.agencyId,
          formInstanceId: args.formInstanceId,
          questionCode: args.questionCode,
          value: args.value as Prisma.InputJsonValue,
          source: 'HUMAN',
          enteredById: args.clinicianId,
          supersedesId: superseded?.id ?? null,
        },
      });
    }
  }

  /** The current chart: latest value per question, ignoring superseded ones. */
  async currentValues(tx: TxClient, formInstanceId: string) {
    return tx.fieldValue.findMany({
      where: { formInstanceId, supersededBy: { is: null } },
      orderBy: { questionCode: 'asc' },
    });
  }

  /**
   * Per-field acceptance and edit distance — the evaluation set that ordinary
   * use produces for free. Feeds the underperforming-field check that decides
   * whether an agent should abstain on a field in future.
   */
  async qualityByField(tx: TxClient, agencyId: string, since?: Date) {
    return tx.proposal.groupBy({
      by: ['questionCode', 'status'],
      where: {
        agencyId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _count: { _all: true },
      _avg: { editDistance: true },
    });
  }
}

/**
 * Enforce the form's own rules on a write.
 *
 * A question the registry doesn't know is allowed through rather than blocked:
 * OASIS items and future disciplines are stored against the same canonical
 * field store before their definitions land here, and refusing them would break
 * writes the system is otherwise happy to make. The check tightens as the
 * registry fills in.
 */
function assertValueAllowed(
  formCode: string,
  questionCode: string,
  value: unknown
): void {
  const question = questionFor(formCode, questionCode);
  if (!question) return;

  const result = validateValue(question, value);
  if (!result.ok) {
    throw new ValueRejectedError(questionCode, result.reason ?? 'Invalid value');
  }
}

function hashInput(formInstanceId: string, result: AgentRunResult): string {
  // Cheap, stable fingerprint. Enough to spot a duplicate run of identical
  // input; not a security control.
  const basis = `${formInstanceId}:${result.promptVersion}:${result.proposals
    .map((p) => `${p.questionCode}=${String(p.value)}`)
    .sort()
    .join('|')}`;

  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = (Math.imul(31, hash) + basis.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
