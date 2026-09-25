-- Revert lbry:v1.000.0 from pg

BEGIN;

DROP SCHEMA IF EXISTS lbry CASCADE;

COMMIT;
