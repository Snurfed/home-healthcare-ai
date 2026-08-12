/**
 * HTTP surface for the proposal loop.
 *
 * Tenancy note: User carries no agencyId in this schema, so every handler
 * derives the agency from the FormInstance it is operating on rather than
 * trusting anything the client sends. That is safe for these operations, but it
 * is not multi-tenancy — a user from agency A can still address a form in
 * agency B if they learn its id. Closing that needs agencyId on User plus
 * Postgres row-level security; see the note in docs/ai-emr-architecture.html.
 */
import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ProposalService, ValueRejectedError } from '../services/proposals/proposal.service';
import { ScribeAgent, TranscriptSegment } from '../services/agents/scribe.agent';
import { getForm, listForms } from '../domain/canonical/forms/registry';
import { InvalidTransitionError } from '../domain/proposals/stateMachine';
import { ProposalDecision } from '../domain/proposals/types';

const service = new ProposalService(prisma);

function requireUser(req: AuthenticatedRequest, res: Response): string | null {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return id;
}

/** POST /api/forms — open a form for a visit. */
export async function createFormInstance(req: AuthenticatedRequest, res: Response) {
  const clinicianId = requireUser(req, res);
  if (!clinicianId) return;

  const { agencyId, patientId, visitId, formCode } = req.body ?? {};
  if (!agencyId || !patientId || !formCode) {
    return res.status(400).json({ error: 'agencyId, patientId and formCode are required' });
  }

  const definition = getForm(formCode);
  if (!definition) {
    return res.status(404).json({ error: `Unknown form ${formCode}`, available: listForms() });
  }

  const form = await prisma.formInstance.create({
    data: {
      agencyId,
      patientId,
      visitId: visitId ?? null,
      clinicianId,
      formCode: definition.id,
      formVersion: definition.version,
      discipline: definition.discipline,
    },
  });

  return res.status(201).json({ form, definition });
}

/** GET /api/forms/:id — the form, its current values, and anything awaiting review. */
export async function getFormInstance(req: AuthenticatedRequest, res: Response) {
  if (!requireUser(req, res)) return;

  const id = req.params['id'] as string;
  const form = await prisma.formInstance.findUnique({ where: { id } });
  if (!form) return res.status(404).json({ error: 'Form instance not found' });

  const [values, pending] = await Promise.all([
    service.currentValues(id),
    service.surfacedFor(id),
  ]);

  return res.json({
    form,
    definition: getForm(form.formCode) ?? null,
    values,
    pendingProposals: pending,
  });
}

/**
 * POST /api/forms/:id/capture — run the scribe over transcript segments.
 *
 * Returns counts rather than the proposals themselves; the client fetches the
 * surfaced set separately, so there is exactly one path by which a proposal
 * reaches a clinician.
 */
export async function runScribe(req: AuthenticatedRequest, res: Response) {
  if (!requireUser(req, res)) return;

  const id = req.params['id'] as string;
  const segments = req.body?.segments as TranscriptSegment[] | undefined;

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'segments[] is required' });
  }
  if (segments.some((s) => typeof s?.id !== 'string' || typeof s?.text !== 'string')) {
    return res.status(400).json({ error: 'each segment needs an id and text' });
  }

  const form = await prisma.formInstance.findUnique({ where: { id } });
  if (!form) return res.status(404).json({ error: 'Form instance not found' });
  if (form.status !== 'in_progress') {
    return res.status(409).json({ error: `Form is ${form.status}; nothing further can be proposed` });
  }

  const definition = getForm(form.formCode);
  if (!definition) return res.status(500).json({ error: `Form definition ${form.formCode} is missing` });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return res.status(503).json({ error: 'Scribe unavailable: ANTHROPIC_API_KEY is not configured' });

  try {
    const agent = new ScribeAgent(new Anthropic({ apiKey }));
    const result = await agent.run({ form: definition, segments });

    // agencyId comes from the record, never the request body.
    const outcome = await service.recordRun({
      agencyId: form.agencyId,
      formInstanceId: id,
      result,
    });

    return res.json({
      ...outcome,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    // A scribe failure must never block documentation — the clinician types.
    return res.status(502).json({
      error: 'Scribe run failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/** GET /api/forms/:id/proposals — what is awaiting a decision. */
export async function listProposals(req: AuthenticatedRequest, res: Response) {
  if (!requireUser(req, res)) return;
  const id = req.params['id'] as string;
  return res.json({ proposals: await service.surfacedFor(id) });
}

/** POST /api/proposals/:id/decide — accept, edit or reject. */
export async function decideProposal(req: AuthenticatedRequest, res: Response) {
  const clinicianId = requireUser(req, res);
  if (!clinicianId) return;

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
    const result = await service.decide(id, clinicianId, decision);
    return res.json(result);
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      // Already decided, or never surfaced. A conflict, not a server fault.
      return res.status(409).json({ error: error.message });
    }
    if (error instanceof ValueRejectedError) {
      // The clinician's edit broke the form's own rules.
      return res.status(422).json({ error: error.message, questionCode: error.questionCode });
    }
    throw error;
  }
}

/** PUT /api/forms/:id/values/:questionCode — a value the clinician typed. */
export async function setValue(req: AuthenticatedRequest, res: Response) {
  const clinicianId = requireUser(req, res);
  if (!clinicianId) return;

  const id = req.params['id'] as string;
  const questionCode = req.params['questionCode'] as string;
  const { value } = req.body ?? {};
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  const form = await prisma.formInstance.findUnique({ where: { id } });
  if (!form) return res.status(404).json({ error: 'Form instance not found' });
  if (form.status === 'signed' || form.status === 'locked') {
    return res.status(409).json({ error: `Form is ${form.status} and cannot be edited` });
  }

  try {
    const fieldValue = await service.setManualValue({
      agencyId: form.agencyId,
      formInstanceId: id,
      questionCode,
      value,
      clinicianId,
    });
    return res.status(201).json({ fieldValue });
  } catch (error) {
    if (error instanceof ValueRejectedError) {
      return res.status(422).json({ error: error.message, questionCode: error.questionCode });
    }
    throw error;
  }
}

/**
 * GET /api/forms/quality?agencyId=…
 *
 * Per-field acceptance and mean edit distance. This is the evaluation set that
 * ordinary use produces, and the input to deciding whether an agent should stop
 * proposing on a field.
 */
export async function fieldQuality(req: AuthenticatedRequest, res: Response) {
  if (!requireUser(req, res)) return;

  const agencyId = req.query['agencyId'] as string | undefined;
  if (!agencyId) return res.status(400).json({ error: 'agencyId is required' });

  const since = req.query['since'] ? new Date(req.query['since'] as string) : undefined;
  return res.json({ rows: await service.qualityByField(agencyId, since) });
}
