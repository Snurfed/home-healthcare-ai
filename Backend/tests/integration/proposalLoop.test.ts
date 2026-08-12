/**
 * The proposal loop against a real database.
 *
 * The invariant under test: chart content and its provenance can never
 * disagree. A FieldValue exists only where a proposal was accepted or edited,
 * carries a link back to it, and superseding a value preserves the old one.
 *
 * Skips itself when no database is reachable, so unit runs stay fast.
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

import { PrismaClient } from '../../src/generated/prisma';
import { ProposalService } from '../../src/services/proposals/proposal.service';
import { AgentRunResult } from '../../src/domain/proposals/types';
import { InvalidTransitionError } from '../../src/domain/proposals/stateMachine';
import { ValueRejectedError } from '../../src/services/proposals/proposal.service';

dotenv.config();

// This Prisma build requires a driver adapter, matching src/config/prisma.ts.
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const service = new ProposalService(prisma);

const AGENCY = 'test-agency-proposals';
const CLINICIAN = 'test-clinician-1';
let formInstanceId: string;
let reachable = true;

const run = (proposals: AgentRunResult['proposals']): AgentRunResult => ({
  kind: 'SCRIBE',
  modelId: 'test-model',
  promptVersion: 'test-v1',
  proposals,
});

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch {
    reachable = false;
    return;
  }

  const form = await prisma.formInstance.create({
    data: {
      agencyId: AGENCY,
      patientId: 'test-patient-1',
      clinicianId: CLINICIAN,
      formCode: 'PT_EVAL_V1',
      formVersion: '1.0.0',
      discipline: 'PT',
    },
  });
  formInstanceId = form.id;
});

afterAll(async () => {
  if (reachable) {
    await prisma.formInstance.deleteMany({ where: { agencyId: AGENCY } });
    await prisma.agentRun.deleteMany({ where: { agencyId: AGENCY } });
  }
  await prisma.$disconnect();
  await pool.end();
});

const maybe = () => (reachable ? it : it.skip);

describe('proposal loop (integration)', () => {
  maybe()('separates surfaced from withheld on the confidence policy', async () => {
    const outcome = await service.recordRun({
      agencyId: AGENCY,
      formInstanceId,
      result: run([
        {
          questionCode: 'PT.NARRATIVE.CHIEF_COMPLAINT',
          value: 'Right knee pain since a fall.',
          confidence: 0.93,
          evidence: [{ transcriptId: 's1', quote: 'my knee has hurt since I fell' }],
        },
        {
          // Payment-linked, so held to 0.9 — this abstains.
          questionCode: 'OASIS.GG0130A',
          value: '04',
          confidence: 0.72,
          evidence: [{ transcriptId: 's2', quote: 'I can mostly manage on my own' }],
        },
      ]),
    });

    expect(outcome.surfaced).toBe(1);
    expect(outcome.withheld).toBe(1);

    // The abstention is retained, not discarded — it is the signal.
    const withheld = await prisma.proposal.findMany({
      where: { formInstanceId, status: 'WITHHELD' },
    });
    expect(withheld).toHaveLength(1);
    expect(withheld[0]?.questionCode).toBe('OASIS.GG0130A');
  });

  maybe()('accepting writes a FieldValue linked back to its proposal', async () => {
    const [proposal] = await service.surfacedFor(formInstanceId);
    expect(proposal).toBeDefined();

    const { fieldValue } = await service.decide(proposal!.id, CLINICIAN, { kind: 'accept' });

    expect(fieldValue).not.toBeNull();
    expect(fieldValue!.source).toBe('AGENT');
    expect(fieldValue!.proposalId).toBe(proposal!.id);
    expect(fieldValue!.enteredById).toBe(CLINICIAN);
  });

  maybe()('a decided proposal cannot be decided again', async () => {
    const decided = await prisma.proposal.findFirst({
      where: { formInstanceId, status: 'COMMITTED' },
    });
    await expect(
      service.decide(decided!.id, CLINICIAN, { kind: 'reject' })
    ).rejects.toThrow(InvalidTransitionError);
  });

  maybe()('editing records how far the clinician moved the value', async () => {
    await service.recordRun({
      agencyId: AGENCY,
      formInstanceId,
      result: run([
        {
          questionCode: 'PT.NARRATIVE.GAIT',
          value: 'Ambulates with a steady gait.',
          confidence: 0.8,
          evidence: [{ transcriptId: 's3', quote: 'walking looked steady enough' }],
        },
      ]),
    });

    const surfaced = await service.surfacedFor(formInstanceId);
    const target = surfaced.find((p) => p.questionCode === 'PT.NARRATIVE.GAIT');

    const { proposal, fieldValue } = await service.decide(target!.id, CLINICIAN, {
      kind: 'edit',
      value: 'Ambulates with an antalgic gait favouring the right.',
    });

    expect(proposal.status).toBe('COMMITTED');
    expect(proposal.editDistance).toBeGreaterThan(0);
    expect(fieldValue!.value).toContain('antalgic');
  });

  maybe()('rejecting writes no FieldValue', async () => {
    await service.recordRun({
      agencyId: AGENCY,
      formInstanceId,
      result: run([
        {
          questionCode: 'PT.PAIN.LOCATION',
          value: 'left shoulder',
          confidence: 0.85,
          evidence: [{ transcriptId: 's4', quote: 'the shoulder is sore too' }],
        },
      ]),
    });

    const surfaced = await service.surfacedFor(formInstanceId);
    const target = surfaced.find((p) => p.questionCode === 'PT.PAIN.LOCATION');

    const { fieldValue } = await service.decide(target!.id, CLINICIAN, { kind: 'reject' });
    expect(fieldValue).toBeNull();

    const values = await prisma.fieldValue.findMany({
      where: { formInstanceId, questionCode: 'PT.PAIN.LOCATION' },
    });
    expect(values).toHaveLength(0);
  });

  maybe()('a later value supersedes rather than overwrites', async () => {
    await service.setManualValue({
      agencyId: AGENCY,
      formInstanceId,
      questionCode: 'PT.PLAN.FREQUENCY',
      value: '2x/week for 4 weeks',
      clinicianId: CLINICIAN,
    });

    await service.setManualValue({
      agencyId: AGENCY,
      formInstanceId,
      questionCode: 'PT.PLAN.FREQUENCY',
      value: '3x/week for 4 weeks',
      clinicianId: CLINICIAN,
    });

    const all = await prisma.fieldValue.findMany({
      where: { formInstanceId, questionCode: 'PT.PLAN.FREQUENCY' },
    });
    expect(all).toHaveLength(2);

    // The chart reads only the newest; the prior value survives underneath it.
    const current = await service.currentValues(formInstanceId);
    const freq = current.filter((v) => v.questionCode === 'PT.PLAN.FREQUENCY');
    expect(freq).toHaveLength(1);
    expect(freq[0]?.value).toBe('3x/week for 4 weeks');
  });

  maybe()('every AGENT value traces back to an accepted proposal', async () => {
    const agentValues = await prisma.fieldValue.findMany({
      where: { formInstanceId, source: 'AGENT' },
      include: { proposal: true },
    });

    expect(agentValues.length).toBeGreaterThan(0);
    for (const v of agentValues) {
      expect(v.proposal).not.toBeNull();
      expect(['COMMITTED']).toContain(v.proposal!.status);
    }
  });
});

describe('form rules bind the clinician too (integration)', () => {
  maybe()('rejects an edit that is not a legal option code', async () => {
    await service.recordRun({
      agencyId: AGENCY,
      formInstanceId,
      result: run([
        {
          questionCode: 'PT.GAIT.ASSIST_LEVEL',
          value: 'supervision',
          confidence: 0.9,
          evidence: [{ transcriptId: 's9', quote: 'standing nearby with no hands on' }],
        },
      ]),
    });

    const surfaced = await service.surfacedFor(formInstanceId);
    const target = surfaced.find((p) => p.questionCode === 'PT.GAIT.ASSIST_LEVEL');

    // The exact string that slipped through before validation existed.
    await expect(
      service.decide(target!.id, CLINICIAN, { kind: 'edit', value: 'CLINICIAN CORRECTED VALUE' })
    ).rejects.toThrow(ValueRejectedError);

    // And the proposal is untouched, so it can still be decided properly.
    const after = await prisma.proposal.findUnique({ where: { id: target!.id } });
    expect(after?.status).toBe('SURFACED');

    // A legal edit still works.
    const ok = await service.decide(target!.id, CLINICIAN, { kind: 'edit', value: 'setup' });
    expect(ok.fieldValue?.value).toBe('setup');
  });

  maybe()('rejects a hand-typed value that breaks the form rules', async () => {
    await expect(
      service.setManualValue({
        agencyId: AGENCY,
        formInstanceId,
        questionCode: 'PT.PAIN.CURRENT',
        value: 99,
        clinicianId: CLINICIAN,
      })
    ).rejects.toThrow(ValueRejectedError);
  });

  maybe()('still allows a value for a question the registry does not govern', async () => {
    // OASIS items share the canonical store before their definitions land.
    const v = await service.setManualValue({
      agencyId: AGENCY,
      formInstanceId,
      questionCode: 'OASIS.M1800',
      value: '02',
      clinicianId: CLINICIAN,
    });
    expect(v.value).toBe('02');
  });
});
