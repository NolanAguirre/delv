-- Revert lbry:v1.001.0 from pg
-- Reverse the checkout split: drop the function, restore returned_at, move
-- history rows back into checkout, drop checkout_history.

BEGIN;

DROP FUNCTION lbry.return_checkout(uuid);

ALTER TABLE lbry.checkout ADD COLUMN returned_at timestamptz;

INSERT INTO lbry.checkout (user_id, book_copy_id, checked_out_at, due_at, returned_at)
SELECT user_id, book_copy_id, checked_out_at, due_at, returned_at
FROM lbry.checkout_history;

DROP TABLE lbry.checkout_history;

COMMIT;
