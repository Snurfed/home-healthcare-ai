-- Creates the role the application connects as.
--
-- This exists because RLS is silently useless otherwise. A superuser bypasses
-- every policy, and the table owner bypasses its own unless FORCE is set — and
-- the default setup here connected as `postgres`, which is both. The policies
-- would have been present, enabled, and doing nothing.
--
-- Run once per environment, as a superuser:
--   psql "$ADMIN_DATABASE_URL" -f scripts/setup-app-role.sql
--
-- Then point the application's DATABASE_URL at hha_app. Migrations keep using
-- the owner connection; only the running application uses this role.
--
-- Set a real password before running anywhere that is not a laptop.

\set app_password `echo "${APP_DB_PASSWORD:-change-me-in-every-real-environment}"`

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hha_app') THEN
    CREATE ROLE hha_app LOGIN;
    RAISE NOTICE 'created role hha_app';
  ELSE
    RAISE NOTICE 'role hha_app already exists';
  END IF;
END $$;

ALTER ROLE hha_app WITH PASSWORD :'app_password';

-- Explicitly not a superuser and explicitly subject to RLS. Stated rather than
-- assumed, because both default the wrong way for this purpose if the role is
-- ever recreated by hand.
ALTER ROLE hha_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE homehealthai TO hha_app;
GRANT USAGE ON SCHEMA public TO hha_app;

-- Data access only. No DDL: the application must not be able to drop a policy
-- it is subject to.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hha_app;

-- Tables created by future migrations are covered automatically; a new table
-- that the app cannot read is a confusing outage, and one it can read without
-- a policy is a leak.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hha_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hha_app;

SELECT
  rolname,
  rolsuper    AS is_superuser,
  rolbypassrls AS bypasses_rls
FROM pg_roles
WHERE rolname = 'hha_app';
