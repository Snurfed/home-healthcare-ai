-- Extend tenant isolation to the rest of the clinical schema.
--
-- Denormalised rather than traversed. Policies that reach a parent are fine one
-- hop deep (evidence -> proposals), but oasis_responses would need two and the
-- planner pays for the subquery on every row. Every PHI table therefore carries
-- its own agencyId.
--
-- The column defaults to the tenant in force, so existing insert code needs no
-- change: a row written inside withTenant() is labelled automatically, and
-- WITH CHECK refuses anything written outside one.
--
-- Backfill walks the parent chain. Rows that cannot be attributed are left NULL
-- and become invisible to every tenant — deliberately. An unattributable row is
-- one nobody can prove ownership of, and guessing is how data crosses agencies.

-- ------------------------------------------------------------------ columns
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patients', 'episodes', 'visits', 'care_plans',
    'oasis_assessments', 'oasis_responses',
    'documents', 'referral_documents', 'soap_notes', 'voice_transcriptions',
    'emergency_contacts', 'insurances', 'patient_assignments',
    'physician_communications', 'detected_clinical_events',
    'suggestion_dismissals', 'communication_triggers',
    'communication_attachments', 'communication_audit_logs',
    'communication_send_logs',
    'emr_patient_links', 'emr_sync_jobs',
    'agency_settings', 'integration_settings', 'emr_connections',
    'clinical_event_trigger_configs', 'notification_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "agencyId" TEXT', t);
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN "agencyId" SET DEFAULT current_setting(''app.current_agency_id'', true)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("agencyId")', t || '_agency_idx', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------- backfill
-- Patients are the tenant root. With one agency in the database every existing
-- patient belongs to it; with none, nothing to do.
UPDATE patients p
SET "agencyId" = (SELECT u."agencyId" FROM users u WHERE u."agencyId" IS NOT NULL GROUP BY u."agencyId" HAVING count(*) > 0 LIMIT 1)
WHERE p."agencyId" IS NULL
  AND (SELECT count(DISTINCT "agencyId") FROM users WHERE "agencyId" IS NOT NULL) = 1;

UPDATE episodes e SET "agencyId" = p."agencyId" FROM patients p WHERE e."patientId" = p.id AND e."agencyId" IS NULL;
UPDATE visits v SET "agencyId" = p."agencyId" FROM patients p WHERE v."patientId" = p.id AND v."agencyId" IS NULL;
UPDATE care_plans c SET "agencyId" = p."agencyId" FROM patients p WHERE c."patientId" = p.id AND c."agencyId" IS NULL;
UPDATE oasis_assessments a SET "agencyId" = p."agencyId" FROM patients p WHERE a."patientId" = p.id AND a."agencyId" IS NULL;
UPDATE documents d SET "agencyId" = p."agencyId" FROM patients p WHERE d."patientId" = p.id AND d."agencyId" IS NULL;
UPDATE referral_documents r SET "agencyId" = p."agencyId" FROM patients p WHERE r."patientId" = p.id AND r."agencyId" IS NULL;
UPDATE soap_notes s SET "agencyId" = p."agencyId" FROM patients p WHERE s."patientId" = p.id AND s."agencyId" IS NULL;
UPDATE voice_transcriptions v SET "agencyId" = p."agencyId" FROM patients p WHERE v."patientId" = p.id AND v."agencyId" IS NULL;
UPDATE emergency_contacts c SET "agencyId" = p."agencyId" FROM patients p WHERE c."patientId" = p.id AND c."agencyId" IS NULL;
UPDATE insurances i SET "agencyId" = p."agencyId" FROM patients p WHERE i."patientId" = p.id AND i."agencyId" IS NULL;
UPDATE patient_assignments a SET "agencyId" = p."agencyId" FROM patients p WHERE a."patientId" = p.id AND a."agencyId" IS NULL;
UPDATE physician_communications c SET "agencyId" = p."agencyId" FROM patients p WHERE c."patientId" = p.id AND c."agencyId" IS NULL;
UPDATE detected_clinical_events e SET "agencyId" = p."agencyId" FROM patients p WHERE e."patientId" = p.id AND e."agencyId" IS NULL;
UPDATE emr_patient_links l SET "agencyId" = p."agencyId" FROM patients p WHERE l."patientId" = p.id AND l."agencyId" IS NULL;

-- Second hop, after their parents are labelled.
UPDATE oasis_responses r SET "agencyId" = a."agencyId" FROM oasis_assessments a WHERE r."assessmentId" = a.id AND r."agencyId" IS NULL;
UPDATE suggestion_dismissals d SET "agencyId" = a."agencyId" FROM oasis_assessments a WHERE d."assessmentId" = a.id AND d."agencyId" IS NULL;
UPDATE communication_triggers t SET "agencyId" = a."agencyId" FROM oasis_assessments a WHERE t."assessmentId" = a.id AND t."agencyId" IS NULL;
UPDATE emr_sync_jobs j SET "agencyId" = v."agencyId" FROM visits v WHERE j."visitId" = v.id AND j."agencyId" IS NULL;
UPDATE communication_attachments a SET "agencyId" = c."agencyId" FROM physician_communications c WHERE a."communicationId" = c.id AND a."agencyId" IS NULL;
UPDATE communication_audit_logs l SET "agencyId" = c."agencyId" FROM physician_communications c WHERE l."communicationId" = c.id AND l."agencyId" IS NULL;

-- ----------------------------------------------------------------- policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patients', 'episodes', 'visits', 'care_plans',
    'oasis_assessments', 'oasis_responses',
    'documents', 'referral_documents', 'soap_notes', 'voice_transcriptions',
    'emergency_contacts', 'insurances', 'patient_assignments',
    'physician_communications', 'detected_clinical_events',
    'suggestion_dismissals', 'communication_triggers',
    'communication_attachments', 'communication_audit_logs',
    'communication_send_logs',
    'emr_patient_links', 'emr_sync_jobs',
    'agency_settings', 'integration_settings', 'emr_connections',
    'clinical_event_trigger_configs', 'notification_templates',
    'emr_field_mappings'
  ]
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

-- users is the one table a request must read before its tenant is known, so it
-- is scoped by row rather than hidden outright: a session may load its own user
-- record, and sees no other agency's staff.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (
    current_setting('app.current_agency_id', true) IS NULL
    OR current_setting('app.current_agency_id', true) = ''
    OR "agencyId" = current_setting('app.current_agency_id', true)
  );

-- emr_field_mappings already had agencyId, so the loop above skipped it and it
-- kept no default. Caught by tests/integration/rlsCoverage.test.ts, which is
-- exactly the drift that test exists to find.
ALTER TABLE emr_field_mappings
  ALTER COLUMN "agencyId" SET DEFAULT current_setting('app.current_agency_id', true);
