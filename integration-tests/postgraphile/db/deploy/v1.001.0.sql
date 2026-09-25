-- Deploy lbry:v1.001.0 to pg
-- Split checkout into active loans (lbry.checkout) + returned loans
-- (lbry.checkout_history), and add a return_checkout stored function that
-- PostGraphile exposes as a mutation.

BEGIN;

CREATE TABLE lbry.checkout_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES lbry."user" (id),
    book_copy_id uuid NOT NULL REFERENCES lbry.book_copy (id),
    checked_out_at timestamptz NOT NULL,
    due_at timestamptz NOT NULL,
    returned_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkout_history_user_id_idx ON lbry.checkout_history (user_id);
CREATE INDEX checkout_history_book_copy_id_idx ON lbry.checkout_history (book_copy_id);

-- Move already-returned loans into history, then drop them from the active table.
INSERT INTO lbry.checkout_history (user_id, book_copy_id, checked_out_at, due_at, returned_at)
SELECT user_id, book_copy_id, checked_out_at, due_at, returned_at
FROM lbry.checkout WHERE returned_at IS NOT NULL;

DELETE FROM lbry.checkout WHERE returned_at IS NOT NULL;

ALTER TABLE lbry.checkout DROP COLUMN returned_at;

CREATE FUNCTION lbry.return_checkout(checkout_id uuid)
    RETURNS lbry.checkout_history AS $$
DECLARE
    hist lbry.checkout_history;
BEGIN
    INSERT INTO lbry.checkout_history (user_id, book_copy_id, checked_out_at, due_at, returned_at)
    SELECT user_id, book_copy_id, checked_out_at, due_at, now()
    FROM lbry.checkout WHERE id = checkout_id
    RETURNING * INTO hist;

    IF hist.id IS NULL THEN
        RAISE EXCEPTION 'checkout % not found', checkout_id;
    END IF;

    UPDATE lbry.book_copy SET status = 'available', updated_at = now()
    WHERE id = hist.book_copy_id;

    DELETE FROM lbry.checkout WHERE id = checkout_id;
    RETURN hist;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMIT;
