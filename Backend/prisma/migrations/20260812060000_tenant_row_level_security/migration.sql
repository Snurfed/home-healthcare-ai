-- Tenant isolation at the database, not in application code.
--
-- Application-level tenant filtering fails open: one handler that forgets a
-- WHERE clause leaks another agency's chart, and nothing in the type system
-- catches it. These policies fail closed instead — with no tenant set, every
-- query returns nothing and every insert is refused.
--
-- The tenant is carried on a per-transaction setting, app.current_agency_id,
-- applied by withTenant() in src/config/tenancy.ts.
--
-- FORCE is required: without it the table owner bypasses its own policies, and
-- the owner is exactly who the application connects as by default.
--
-- Superusers bypass RLS regardless. The application must therefore connect as a
-- non-superuser role — see scripts/setup-app-role.sql. Migrations continue to
-- run as the owner.

-- ---------------------------------------------------------------- direct
-- Tables that carry agencyId themselves.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_runs', 'proposals', 'form_instances', 'field_values']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("agencyId" = current_setting('app.current_agency_id', true))
        WITH CHECK ("agencyId" = current_setting('app.current_agency_id', true))
    $f$, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------- inherited
-- evidence has no agencyId of its own; it belongs to a proposal. Reaching the
-- parent keeps a single source of truth for which agency a row belongs to.
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON evidence;
CREATE POLICY tenant_isolation ON evidence
  USING (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = evidence."proposalId"
      AND p."agencyId" = current_setting('app.current_agency_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.id = evidence."proposalId"
      AND p."agencyId" = current_setting('app.current_agency_id', true)
  ));

-- validation_findings likewise belong to a form instance.
ALTER TABLE validation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_findings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON validation_findings;
CREATE POLICY tenant_isolation ON validation_findings
  USING (EXISTS (
    SELECT 1 FROM form_instances f
    WHERE f.id = validation_findings."formInstanceId"
      AND f."agencyId" = current_setting('app.current_agency_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM form_instances f
    WHERE f.id = validation_findings."formInstanceId"
      AND f."agencyId" = current_setting('app.current_agency_id', true)
  ));

-- No extra indexes needed for the subquery policies: Prisma already declares
-- evidence(proposalId) and validation_findings(formInstanceId, severity), and
-- the planner uses both.
