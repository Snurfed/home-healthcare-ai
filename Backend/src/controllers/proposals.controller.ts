/**
 * HTTP surface for the proposal loop.
 *
 * Every handler runs inside withTenant(), so row-level security filters each
 * query in Postgres rather than in application code. Two consequences worth
 * knowing:
 *
 *   The tenant comes from the authenticated user, never from the request. A
 *   client that could name its own agency could read any agency.
 *
 *   Outside a tenant scope the policies return nothing, so a handler that
 *   forgets withTenant yields an obvious empty result rather than a leak. That
 *   is deliberate: the failure is visible and safe.
 */
import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

import prisma from '../config/prisma';
import { withTenant, TenantScopeError } from '../config/tenancy';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ProposalService, ValueRejectedError } from '../services/proposals/proposal.service';
import { ScribeAgent, TranscriptSegment } from '../services/agents/scribe.agent';
import { getForm, listForms } from '../domain/canonical/forms/registry';
import { InvalidTransitionError } from '../domain/proposals/stateMachine';
import { ProposalDecision } from '../domain/proposals/types';

const service = new ProposalService();

interface Caller {
  clinicianId: string;
  agencyId: string;
}

/**
 * The caller's identity and tenant, or null having already answered.
 *
 * A user with no agency cannot reach patient data at all: there is no tenant to
 * scope them to, and defaulting to any agency would be the exact leak the
 * policies exist to prevent.
 */
function caller(req: AuthenticatedRequest, res: Response): Caller | null {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!user.agencyId) {
    res.status(403).json({
      error: 'Your account is not assigned to an agency, so patient data is unavailable.',
      code: 'NO_AGENCY',
    });
    return null;
  }
  return { clinicianId: user.id, agencyId: user.agencyId };
}

/** Map the domain errors onto status codes, once. */
function handle(error: unknown, res: Response): Response {
  if (error instanceof InvalidTransitionError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof ValueRejectedError) {
    return res.status(422).json({ error: error.message, questionCode: error.questionCode });
  }
  if (error instanceof TenantScopeError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}

/** POST /api/forms — open a form for a visit. */
export async function createFormInstance(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const { patientId, visitId, formCode } = req.body ?? {};
  if (!patientId || !formCode) {
    return res.status(400).json({ error: 'patientId and formCode are required' });
  }

  const definition = getForm(formCode);
  if (!definition) {
    return res.status(404).json({ error: `Unknown form ${formCode}`, available: listForms() });
  }

  const form = await withTenant(prisma, who.agencyId, (tx) =>
    tx.formInstance.create({
      data: {
        // From the session, not the body. RLS would refuse anything else.
        agencyId: who.agencyId,
        patientId,
        visitId: visitId ?? null,
        clinicianId: who.clinicianId,
        formCode: definition.id,
        formVersion: definition.version,
        discipline: definition.discipline,
      },
    })
  );

  return res.status(201).json({ form, definition });
}

/** GET /api/forms/:id — the form, its current values, and anything awaiting review. */
export async function getFormInstance(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const id = req.params['id'] as string;

  const result = await withTenant(prisma, who.agencyId, async (tx) => {
    const form = await tx.formInstance.findUnique({ where: { id } });
    if (!form) return null;

    const [values, pendingProposals] = await Promise.all([
      service.currentValues(tx, id),
      service.surfacedFor(tx, id),
    ]);
    return { form, values, pendingProposals };
  });

  // Another agency's form is indistinguishable from one that does not exist,
  // which is the correct answer to give.
  if (!result) return res.status(404).json({ error: 'Form instance not found' });

  return res.json({ ...result, definition: getForm(result.form.formCode) ?? null });
}

/**
 * POST /api/forms/:id/capture — run the scribe over transcript segments.
 *
 * Returns counts rather than the proposals themselves; the client fetches the
 * surfaced set separately, so there is exactly one path by which a proposal
 * reaches a clinician.
 */
export async function runScribe(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const id = req.params['id'] as string;
  const segments = req.body?.segments as TranscriptSegment[] | undefined;

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'segments[] is required' });
  }
  if (segments.some((s) => typeof s?.id !== 'string' || typeof s?.text !== 'string')) {
    return res.status(400).json({ error: 'each segment needs an id and text' });
  }

  const form = await withTenant(prisma, who.agencyId, (tx) =>
    tx.formInstance.findUnique({ where: { id } })
  );
  if (!form) return res.status(404).json({ error: 'Form instance not found' });
  if (form.status !== 'in_progress') {
    return res.status(409).json({ error: `Form is ${form.status}; nothing further can be proposed` });
  }

  const definition = getForm(form.formCode);
  if (!definition) return res.status(500).json({ error: `Form definition ${form.formCode} is missing` });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return res.status(503).json({ error: 'Scribe unavailable: ANTHROPIC_API_KEY is not configured' });

  // The model call sits outside the transaction on purpose: it takes seconds,
  // and holding a database transaction open for it would exhaust the pool.
  let result;
  try {
    const agent = new ScribeAgent(new Anthropic({ apiKey }));
    result = await agent.run({ form: definition, segments });
  } catch (error) {
    // A scribe failure must never block documentation — the clinician types.
    return res.status(502).json({
      error: 'Scribe run failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const outcome = await withTenant(prisma, who.agencyId, (tx) =>
    service.recordRun(tx, { agencyId: who.agencyId, formInstanceId: id, result })
  );

  return res.json({
    ...outcome,
    modelId: result.modelId,
    promptVersion: result.promptVersion,
    latencyMs: result.latencyMs,
  });
}

/** GET /api/forms/:id/proposals — what is awaiting a decision. */
export async function listProposals(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const id = req.params['id'] as string;
  const proposals = await withTenant(prisma, who.agencyId, (tx) =>
    service.surfacedFor(tx, id)
  );
  return res.json({ proposals });
}

/** POST /api/proposals/:id/decide — accept, edit or reject. */
export async function decideProposal(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const id = req.params['id'] as string;
  const { action, value } = req.body ?? {};

  let decision: ProposalDecision;
  if (action === 'accept') decision = { kind: 'accept' };
  else if (action === 'reject') decision = { kind: 'reject' };
  else if (action === 'edit') {
    if (value === undefined) return res.status(400).json({ error: 'edit requires a value' });
    decision = { kind: 'edit', value };
  } else {
    return res.status(400).json({ error: "action must be 'accept', 'edit' or 'reject'" });
  }

  try {
    const result = await withTenant(prisma, who.agencyId, (tx) =>
      service.decide(tx, id, who.clinicianId, decision)
    );
    return res.json(result);
  } catch (error) {
    // findUniqueOrThrow on a proposal belonging to another agency: RLS hides
    // the row, so it reads as missing rather than forbidden.
    if (error instanceof Error && error.message.includes('No Proposal found')) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    return handle(error, res);
  }
}

/** PUT /api/forms/:id/values/:questionCode — a value the clinician typed. */
export async function setValue(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const id = req.params['id'] as string;
  const questionCode = req.params['questionCode'] as string;
  const { value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  try {
    const outcome = await withTenant(prisma, who.agencyId, async (tx) => {
      const form = await tx.formInstance.findUnique({ where: { id } });
      if (!form) return { notFound: true as const };
      if (form.status === 'signed' || form.status === 'locked') {
        return { locked: form.status };
      }

      const fieldValue = await service.setManualValue(tx, {
        agencyId: who.agencyId,
        formInstanceId: id,
        questionCode,
        value,
        clinicianId: who.clinicianId,
      });
      return { fieldValue };
    });

    if ('notFound' in outcome) return res.status(404).json({ error: 'Form instance not found' });
    if ('locked' in outcome) {
      return res.status(409).json({ error: `Form is ${outcome.locked} and cannot be edited` });
    }
    return res.status(201).json(outcome);
  } catch (error) {
    return handle(error, res);
  }
}

/**
 * GET /api/forms/quality
 *
 * Per-field acceptance and mean edit distance for the caller's own agency —
 * the evaluation set that ordinary use produces.
 */
export async function fieldQuality(req: AuthenticatedRequest, res: Response) {
  const who = caller(req, res);
  if (!who) return;

  const since = req.query['since'] ? new Date(req.query['since'] as string) : undefined;
  const rows = await withTenant(prisma, who.agencyId, (tx) =>
    service.qualityByField(tx, who.agencyId, since)
  );
  return res.json({ rows });
}
