/**
 * Full HTTP round-trip of the proposal loop against a running server.
 *
 * Proves the thing that matters: a transcript goes in, proposals come back with
 * evidence, a clinician accepts / edits / rejects them, and the resulting chart
 * carries correct provenance — all over the real API with real auth.
 *
 * Requires `npx tsx src/index.ts` to already be running.
 * Run:  npx tsx scripts/loop-e2e.ts
 */
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, UserRole, UserStatus } from '../src/generated/prisma';
import { questionFor } from '../src/domain/canonical/forms/registry';

dotenv.config();

const BASE = `http://localhost:${process.env['PORT'] ?? 3000}`;
const AGENCY = 'e2e-agency';
const EMAIL = 'e2e-pt@example.test';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TRANSCRIPT = [
  { id: 'seg1', offset: 0, text: "How's the pain today, nought to ten?" },
  { id: 'seg2', offset: 40, text: "It's a six right now. Worse going down the stairs." },
  { id: 'seg3', offset: 100, text: 'And before the surgery, what were you up to?' },
  { id: 'seg4', offset: 150, text: 'I walked the dog every morning, about a mile, no cane.' },
  { id: 'seg5', offset: 210, text: 'Four steps to the front door, rail on one side. A rug in the hall that slides.' },
  { id: 'seg6', offset: 300, text: "I'm getting a hundred and five degrees of knee flexion." },
  { id: 'seg7', offset: 360, text: "You're using the rolling walker and I'm just standing nearby, no hands on." },
];

async function main() {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');

  // ---- a real clinician, because the middleware loads the user -----------
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { status: UserStatus.ACTIVE, role: UserRole.THERAPIST_PT, agencyId: AGENCY },
    create: {
      email: EMAIL,
      passwordHash: 'not-used-in-this-test',
      firstName: 'Dana',
      lastName: 'Reyes',
      role: UserRole.THERAPIST_PT,
      status: UserStatus.ACTIVE,
      agencyId: AGENCY,
    },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, type: 'access' },
    secret,
    { expiresIn: '15m', issuer: 'home-health-care-ai-assistant', audience: 'home-health-care-api' }
  );

  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { status: res.status, json, text };
  };

  step('1. open a PT evaluation');
  // No agencyId in the body any more: the server takes it from the session.
  const created = await api('POST', '/api/forms', {
    patientId: 'e2e-patient',
    formCode: 'PT_EVAL_V1',
  });
  assert(created.status === 201, `expected 201, got ${created.status} ${created.text.slice(0, 200)}`);
  const formId = created.json.form.id as string;
  console.log(`   form ${formId}  (${created.json.definition.name})`);

  step('2. run the scribe over the transcript');
  const capture = await api('POST', `/api/forms/${formId}/capture`, { segments: TRANSCRIPT });
  assert(capture.status === 200, `expected 200, got ${capture.status} ${capture.text.slice(0, 300)}`);
  console.log(`   ${capture.json.modelId} · ${capture.json.latencyMs}ms`);
  console.log(`   surfaced ${capture.json.surfaced} · withheld ${capture.json.withheld}`);

  step('3. review what was surfaced');
  const listed = await api('GET', `/api/forms/${formId}/proposals`);
  assert(listed.status === 200, `expected 200, got ${listed.status}`);
  const proposals = listed.json.proposals as any[];
  for (const p of proposals) {
    console.log(`   ${p.questionCode}  conf ${p.confidence}  "${p.evidence[0]?.quote ?? '—'}"`);
  }
  assert(proposals.length > 0, 'no proposals surfaced — nothing to decide');

  const leaked = proposals.filter((p) => p.questionCode.startsWith('PT.ROM') || p.questionCode.startsWith('PT.MMT'));
  assert(leaked.length === 0, `a measurement was proposed: ${leaked.map((p) => p.questionCode).join(', ')}`);
  console.log('   (no ROM/MMT proposed despite 105 degrees being said aloud)');

  step('4. accept the first, edit the second, reject the third');
  const [first, second, third] = proposals;

  const accepted = await api('POST', `/api/proposals/${first.id}/decide`, { action: 'accept' });
  assert(accepted.status === 200, `accept failed: ${accepted.status} ${accepted.text.slice(0, 200)}`);
  assert(accepted.json.fieldValue !== null, 'accept produced no FieldValue');
  console.log(`   accepted ${first.questionCode} -> FieldValue ${accepted.json.fieldValue.id.slice(0, 8)}`);

  if (second) {
    // First prove the form's rules bind the clinician, not just the agent.
    // This exact string used to be written straight into a coded field.
    const illegal = await api('POST', `/api/proposals/${second.id}/decide`, {
      action: 'edit',
      value: 'CLINICIAN CORRECTED VALUE',
    });
    assert(illegal.status === 422, `expected 422 for an illegal edit, got ${illegal.status}`);
    console.log(`   refused  ${second.questionCode} <- free text (422)`);

    // A legal value for the same field still goes through.
    const legal = legalValueFor(second.questionCode);
    const edited = await api('POST', `/api/proposals/${second.id}/decide`, {
      action: 'edit',
      value: legal,
    });
    assert(edited.status === 200, `legal edit failed: ${edited.status} ${edited.text.slice(0, 200)}`);
    console.log(`   edited   ${second.questionCode} -> "${legal}" (distance ${edited.json.proposal.editDistance})`);
  }

  if (third) {
    const rejected = await api('POST', `/api/proposals/${third.id}/decide`, { action: 'reject' });
    assert(rejected.status === 200, `reject failed: ${rejected.status}`);
    assert(rejected.json.fieldValue === null, 'reject wrote a FieldValue');
    console.log(`   rejected ${third.questionCode} -> no value written`);
  }

  step('5. deciding the same proposal twice is refused');
  const again = await api('POST', `/api/proposals/${first.id}/decide`, { action: 'accept' });
  assert(again.status === 409, `expected 409 conflict, got ${again.status}`);
  console.log('   409 Conflict, as intended');

  step('6. type a value by hand');
  const manual = await api('PUT', `/api/forms/${formId}/values/PT.PLAN.FREQUENCY`, {
    value: '2x/week for 4 weeks',
  });
  assert(manual.status === 201, `manual value failed: ${manual.status}`);
  console.log('   PT.PLAN.FREQUENCY set by clinician');

  step('7. the resulting chart, with provenance');
  const final = await api('GET', `/api/forms/${formId}`);
  assert(final.status === 200, `fetch failed: ${final.status}`);
  for (const v of final.json.values as any[]) {
    console.log(`   ${v.source.padEnd(6)} ${v.questionCode.padEnd(32)} ${JSON.stringify(v.value).slice(0, 46)}`);
  }

  const agentValues = (final.json.values as any[]).filter((v) => v.source === 'AGENT');
  assert(agentValues.every((v) => v.proposalId), 'an AGENT value has no proposal link');
  console.log(`   every AGENT value (${agentValues.length}) links back to its proposal`);

  step('8. per-field quality');
  const quality = await api('GET', '/api/forms/quality');
  assert(quality.status === 200, `quality failed: ${quality.status}`);
  for (const r of quality.json.rows as any[]) {
    console.log(`   ${r.questionCode.padEnd(32)} ${r.status.padEnd(10)} n=${r._count._all}`);
  }

  console.log('\nALL STEPS PASSED');
}

/**
 * A value the form will actually accept for a given field, so the script can
 * exercise a legal edit whichever proposal happens to come back second.
 */
function legalValueFor(questionCode: string): unknown {
  const question = questionFor('PT_EVAL_V1', questionCode);
  if (question?.options?.length) return question.options[0]?.code;
  if (question?.type === 'scale') return question.scaleMin ?? 0;
  if (question?.type === 'number') return 100;
  return 'Clinician-revised narrative for this field.';
}

function step(label: string) {
  console.log(`\n${label}`);
  console.log('─'.repeat(74));
}

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.formInstance.deleteMany({ where: { agencyId: AGENCY } });
    await prisma.agentRun.deleteMany({ where: { agencyId: AGENCY } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
    await pool.end();
  });
