-- Intentionally empty migration.
-- 0006_auth_workspace_foundation.sql already introduced the authentication/workspace
-- schema represented by the 0007 snapshot. The generated 0007 SQL duplicated those
-- CREATE TABLE/ALTER statements and would fail against databases where 0006 is applied.
-- Keep this journal entry as a no-op so Drizzle migration history remains monotonic.
SELECT 1;
