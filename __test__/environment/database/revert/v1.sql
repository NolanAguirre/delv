-- Revert delv-test:v1 from pg

BEGIN;

DROP SCHEMA delv CASCADE;

COMMIT;
