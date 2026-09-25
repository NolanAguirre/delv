-- Verify lbry:v1.001.0 on pg

BEGIN;

SELECT id FROM lbry.checkout_history WHERE false;
SELECT 'lbry.return_checkout(uuid)'::regprocedure;

ROLLBACK;
