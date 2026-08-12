/**
 * Tenant isolation, enforced by Postgres rather than by application code.
 *
 * Connects as hha_app — the non-superuser role the application uses. Running
 * these as `postgres` would pass trivially and prove nothing, because a
 * superuser bypasses every policy. If APP_DATABASE_URL is not configured the
 * suite skips rather than giving false assurance.
 *
 * Setup:
 *   APP_DB_PASSWORD=... psql "$ADMIN_URL" -f scripts/setup-app-role.sql
 *   APP_DATABASE_URL=postgresql://hha_app:...@localhost:5432/homehealthai
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

import { PrismaClient } from '../../src/generated/prisma';
import { withTenant, currentTenant, TenantScopeError } from '../../src/config/tenancy';

dotenv.config();

const APP_URL = process.env['APP_DATABASE_URL'];
const ADMIN_URL = process.env['DATABASE_URL'];

const AGENCY_A = 'rls-agency-a';
const AGENCY_B = 'rls-agency-b';

let app: PrismaClient;
let admin: PrismaClient;
let appPool: Pool;
let adminPool: Pool;
let formA: string;
let formB: string;

/**
 * Decided at module load, because Jest registers tests during the describe
 * phase — before beforeAll runs. Gating on a flag set in beforeAll silently
 * skips the entire suite, which is how this file first "passed".
 *
 * Env presence is the only skip condition. If the app role is configured but
 * broken, the suite fails loudly rather than pretending isolation is proven.
 */
const CONFIGURED = Boolean(APP_URL && ADMIN_URL);

beforeAll(async () => {
  if (!CONFIGURED) return;

  appPool = new Pool({ connectionString: APP_URL });
  adminPool = new Pool({ connectionString: ADMIN_URL });
  app = new PrismaClient({ adapter: new PrismaPg(appPool) });
  admin = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  // Confirm the app role really is subject to RLS before trusting any result.
  const rows = await app.$queryRawUnsafe<Array<{ s: boolean; b: boolean }>>(
    `select rolsuper as s, rolbypassrls as b from pg_roles where rolname = current_user`
  );
  if (rows[0]?.s || rows[0]?.b) {
    throw new Error('APP_DATABASE_URL role bypasses RLS — these tests would prove nothing');
  }

  // Seed through the owner connection, which is not policy-bound.
  const a = await admin.formInstance.create({
    data: { agencyId: AGENCY_A, patientId: 'p-a', clinicianId: 'c-a', formCode: 'PT_EVAL_V1', formVersion: '1.0.0', discipline: 'PT' },
  });
  const b = await admin.formInstance.create({
    data: { agencyId: AGENCY_B, patientId: 'p-b', clinicianId: 'c-b', formCode: 'PT_EVAL_V1', formVersion: '1.0.0', discipline: 'PT' },
  });
  formA = a.id;
  formB = b.id;

  await admin.fieldValue.create({
    data: { agencyId: AGENCY_A, formInstanceId: formA, questionCode: 'PT.PAIN.CURRENT', value: 6, source: 'HUMAN', enteredById: 'c-a' },
  });
  await admin.fieldValue.create({
    data: { agencyId: AGENCY_B, formInstanceId: formB, questionCode: 'PT.PAIN.CURRENT', value: 3, source: 'HUMAN', enteredById: 'c-b' },
  });

});

afterAll(async () => {
  if (admin) {
    await admin.fieldValue.deleteMany({ where: { agencyId: { in: [AGENCY_A, AGENCY_B] } } });
    await admin.formInstance.deleteMany({ where: { agencyId: { in: [AGENCY_A, AGENCY_B] } } });
    await admin.$disconnect();
    await adminPool.end();
  }
  if (app) {
    await app.$disconnect();
    await appPool.end();
  }
});

const t = () => (CONFIGURED ? it : it.skip);

describe('row-level security', () => {
  t()('the app role is not a superuser and does not bypass RLS', async () => {
    const rows = await app.$queryRawUnsafe<Array<{ u: string; s: boolean; b: boolean }>>(
      `select current_user as u, rolsuper as s, rolbypassrls as b from pg_roles where rolname = current_user`
    );
    expect(rows[0]?.s).toBe(false);
    expect(rows[0]?.b).toBe(false);
  });

  t()('sees nothing at all when no tenant is set — fails closed', async () => {
    const forms = await app.formInstance.findMany();
    const values = await app.fieldValue.findMany();
    expect(forms).toHaveLength(0);
    expect(values).toHaveLength(0);
  });

  t()('sees only its own agency inside withTenant', async () => {
    const seen = await withTenant(app, AGENCY_A, async (tx) => {
      expect(await currentTenant(tx)).toBe(AGENCY_A);
      return tx.formInstance.findMany();
    });

    expect(seen.map((f) => f.agencyId)).toEqual([AGENCY_A]);
  });

  t()('cannot reach another agency even with the exact row id', async () => {
    // The id is known; the policy is what stops the read, not obscurity.
    const found = await withTenant(app, AGENCY_A, (tx) =>
      tx.formInstance.findUnique({ where: { id: formB } })
    );
    expect(found).toBeNull();
  });

  t()('cannot update another agency\'s row', async () => {
    const result = await withTenant(app, AGENCY_A, (tx) =>
      tx.formInstance.updateMany({ where: { id: formB }, data: { status: 'locked' } })
    );
    expect(result.count).toBe(0);

    const untouched = await admin.formInstance.findUnique({ where: { id: formB } });
    expect(untouched?.status).toBe('in_progress');
  });

  t()('cannot delete another agency\'s row', async () => {
    const result = await withTenant(app, AGENCY_A, (tx) =>
      tx.fieldValue.deleteMany({ where: { agencyId: AGENCY_B } })
    );
    expect(result.count).toBe(0);

    const survives = await admin.fieldValue.count({ where: { agencyId: AGENCY_B } });
    expect(survives).toBe(1);
  });

  t()('refuses to write a row labelled with a different agency', async () => {
    // WITH CHECK stops a scoped session from forging another tenant's data.
    await expect(
      withTenant(app, AGENCY_A, (tx) =>
        tx.formInstance.create({
          data: { agencyId: AGENCY_B, patientId: 'forged', clinicianId: 'c-a', formCode: 'PT_EVAL_V1', formVersion: '1.0.0', discipline: 'PT' },
        })
      )
    ).rejects.toThrow();

    const count = await admin.formInstance.count({ where: { patientId: 'forged' } });
    expect(count).toBe(0);
  });

  t()('allows a write for its own agency', async () => {
    const created = await withTenant(app, AGENCY_A, (tx) =>
      tx.fieldValue.create({
        data: { agencyId: AGENCY_A, formInstanceId: formA, questionCode: 'PT.NARRATIVE.GAIT', value: 'steady', source: 'HUMAN', enteredById: 'c-a' },
      })
    );
    expect(created.agencyId).toBe(AGENCY_A);
  });

  t()('the tenant does not survive the transaction', async () => {
    await withTenant(app, AGENCY_A, async () => undefined);
    // A pooled connection must not carry the previous request's identity.
    const leaked = await app.formInstance.findMany();
    expect(leaked).toHaveLength(0);
  });

  t()('rejects an agency id that is not a plain identifier', async () => {
    await expect(
      withTenant(app, "a' OR '1'='1", async () => undefined)
    ).rejects.toThrow(TenantScopeError);
  });

  t()('evidence is scoped through its parent proposal', async () => {
    const run = await admin.agentRun.create({
      data: { agencyId: AGENCY_B, kind: 'SCRIBE', modelId: 'test', promptVersion: 'v1', inputHash: 'x' },
    });
    const proposal = await admin.proposal.create({
      data: {
        agencyId: AGENCY_B, agentRunId: run.id, formInstanceId: formB,
        questionCode: 'PT.PAIN.CURRENT', proposedValue: 3, confidence: 0.9, status: 'SURFACED',
        evidence: { create: [{ quote: 'it is a three', transcriptId: 's1' }] },
      },
    });

    // evidence carries no agencyId of its own, so the policy reaches the parent.
    const visible = await withTenant(app, AGENCY_A, (tx) =>
      tx.evidence.findMany({ where: { proposalId: proposal.id } })
    );
    expect(visible).toHaveLength(0);

    const own = await withTenant(app, AGENCY_B, (tx) =>
      tx.evidence.findMany({ where: { proposalId: proposal.id } })
    );
    expect(own).toHaveLength(1);

    await admin.agentRun.delete({ where: { id: run.id } });
  });
});
