-- Verify lbry:v1.000.0 on pg

BEGIN;

SELECT id FROM lbry.state WHERE false;
SELECT id FROM lbry.city WHERE false;
SELECT id FROM lbry.library WHERE false;
SELECT id FROM lbry.genre WHERE false;
SELECT id FROM lbry.author WHERE false;
SELECT id FROM lbry.book WHERE false;
SELECT id FROM lbry.book_copy WHERE false;
SELECT id FROM lbry."user" WHERE false;
SELECT id FROM lbry.account WHERE false;
SELECT id FROM lbry.user_accounts WHERE false;
SELECT id FROM lbry.role WHERE false;
SELECT id FROM lbry.user_roles WHERE false;
SELECT id FROM lbry.account_roles WHERE false;
SELECT id FROM lbry.checkout WHERE false;

ROLLBACK;
