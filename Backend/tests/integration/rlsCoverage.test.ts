/**
 * Coverage guard: every table holding patient data must be protected.
 *
 * The risk this defends against is drift, not a bug that exists today. A new
 * model added six months from now gets a table, a migration and no policy, and
 * nothing else in the system would notice. This test notices.
 *
 * Tables are opt-out rather than opt-in: anything not explicitly listed as
 * exempt must have RLS enabled, FORCEd, and a tenant policy. A new table is
 * therefore protected by default, and exempting one is a deliberate edit with a
 * stated reason next to it.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const ADMIN_URL = process.env['DATABASE_URL'];
const CONFIGURED = Boolean(ADMIN_URL);

/**
 * Tables that legitimately hold no tenant-scoped data. Each needs a reason —
 * "it was easier" is not one.
 */
const EXEMPT: Record<string, string> = {
  users: 'scoped by its own policy; a request must read its user before the tenant is known',
  oasis_questions: 'CMS reference data, identical for every agency',
  system_configs: 'deployment-wide settings, no patient data',
  refresh_tokens: 'auth material keyed by user, never queried across agencies',
  emr_access_tokens: 'auth material keyed by user',
  audit_logs: 'append-only audit trail; see the note below',
  emr_audit_logs: 'append-only audit trail; see the note below',
};

let pool: Pool;

beforeAll(() => {
  if (CONFIGURED) pool = new Pool({ connectionString: ADMIN_URL });
});

afterAll(async () => {
  if (pool) await pool.end();
});

const t = CONFIGURED ? it : it.skip;

describe('RLS coverage', () => {
  t('every non-exempt table has RLS enabled and forced', async () => {
    const { rows } = await pool.query<{ tablename: string; rls: boolean; forced: boolean }>(`
      SELECT t.tablename,
             c.relrowsecurity      AS rls,
             c.relforcerowsecurity AS forced
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' AND t.tablename NOT LIKE '_prisma%'
    `);

    const unprotected = rows
      .filter((r) => !(r.tablename in EXEMPT))
      .filter((r) => !r.rls || !r.forced)
      .map((r) => `${r.tablename} (rls=${r.rls}, forced=${r.forced})`);

    expect(unprotected).toEqual([]);
  });

  t('every protected table actually has a tenant policy', async () => {
    const { rows } = await pool.query<{ tablename: string; policies: number }>(`
      SELECT t.tablename, count(p.polname)::int AS policies
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      LEFT JOIN pg_policy p ON p.polrelid = c.oid AND p.polname = 'tenant_isolation'
      WHERE t.schemaname = 'public' AND t.tablename NOT LIKE '_prisma%'
        AND c.relrowsecurity
      GROUP BY t.tablename
    `);

    const missing = rows.filter((r) => r.policies === 0).map((r) => r.tablename);
    expect(missing).toEqual([]);
  });

  t('every protected table carries the agencyId the policy reads', async () => {
    // Two tables are scoped through a parent instead; everything else must have
    // its own column or the policy could not evaluate.
    const VIA_PARENT = ['evidence', 'validation_findings'];

    const { rows } = await pool.query<{ tablename: string; has_col: number }>(`
      SELECT t.tablename,
             (SELECT count(*)::int FROM information_schema.columns col
               WHERE col.table_name = t.tablename AND col.column_name = 'agencyId') AS has_col
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' AND c.relrowsecurity
    `);

    const missing = rows
      .filter((r) => !VIA_PARENT.includes(r.tablename) && r.has_col === 0)
      .map((r) => r.tablename);

    expect(missing).toEqual([]);
  });

  t('the exempt list has not gone stale', async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`
    );
    const existing = new Set(rows.map((r) => r.tablename));
    const gone = Object.keys(EXEMPT).filter((name) => !existing.has(name));

    // An exemption for a table that no longer exists hides the fact that a
    // replacement may have arrived unprotected.
    expect(gone).toEqual([]);
  });

  t('new PHI columns default to the tenant in force', async () => {
    // The default is what lets existing insert code keep working unchanged: a
    // row written inside withTenant is labelled without the caller doing it.
    const { rows } = await pool.query<{ tablename: string }>(`
      SELECT t.tablename
      FROM pg_tables t
      JOIN information_schema.columns col
        ON col.table_name = t.tablename AND col.column_name = 'agencyId'
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
        AND c.relrowsecurity
        AND t.tablename NOT IN ('users', 'proposals', 'agent_runs', 'form_instances', 'field_values')
        AND (col.column_default IS NULL OR col.column_default NOT LIKE '%current_agency_id%')
    `);

    expect(rows.map((r) => r.tablename)).toEqual([]);
  });
});
