-- Sample data for the lbry library app.
-- Not a versioned sqitch change; run separately (make db-seed) so migrations
-- stay pure schema. Idempotent: truncates the lbry tables before inserting.
-- Names are fully schema-qualified (no search_path reliance); FKs are resolved
-- via subselects on natural keys, so we never hardcode uuids.

TRUNCATE
    lbry.checkout,
    lbry.checkout_history,
    lbry.account_roles,
    lbry.user_roles,
    lbry.role,
    lbry.user_accounts,
    lbry.account,
    lbry."user",
    lbry.book_copy,
    lbry.book,
    lbry.author,
    lbry.genre,
    lbry.library,
    lbry.city,
    lbry.state
    RESTART IDENTITY CASCADE;

-- States --------------------------------------------------------------------

INSERT INTO lbry.state (name, code) VALUES
    ('California', 'CA'),
    ('New York', 'NY'),
    ('Texas', 'TX');

-- Cities --------------------------------------------------------------------

INSERT INTO lbry.city (name, state_id) VALUES
    ('San Francisco', (SELECT id FROM lbry.state WHERE code = 'CA')),
    ('Los Angeles', (SELECT id FROM lbry.state WHERE code = 'CA')),
    ('New York City', (SELECT id FROM lbry.state WHERE code = 'NY')),
    ('Austin', (SELECT id FROM lbry.state WHERE code = 'TX'));

-- Libraries -----------------------------------------------------------------

INSERT INTO lbry.library (name, address, city_id) VALUES
    ('Mission Branch', '300 Bartlett St', (SELECT id FROM lbry.city WHERE name = 'San Francisco')),
    ('Central Library', '630 W 5th St', (SELECT id FROM lbry.city WHERE name = 'Los Angeles')),
    ('Midtown Library', '455 5th Ave', (SELECT id FROM lbry.city WHERE name = 'New York City')),
    ('Austin Public', '710 W Cesar Chavez St', (SELECT id FROM lbry.city WHERE name = 'Austin'));

-- Genres --------------------------------------------------------------------

INSERT INTO lbry.genre (name) VALUES
    ('Science Fiction'),
    ('Fantasy'),
    ('Non-Fiction'),
    ('Mystery');

-- Authors -------------------------------------------------------------------

INSERT INTO lbry.author (first_name, last_name, bio) VALUES
    ('Ursula', 'Le Guin', 'American author of speculative fiction.'),
    ('Isaac', 'Asimov', 'Prolific science fiction and popular science writer.'),
    ('Terry', 'Pratchett', 'English author best known for the Discworld series.'),
    ('Agatha', 'Christie', 'English writer known for detective novels.');

-- Books ---------------------------------------------------------------------

INSERT INTO lbry.book (title, isbn, published_date, genre_id, author_id) VALUES
    ('The Left Hand of Darkness', '9780441478125', '1969-03-01',
        (SELECT id FROM lbry.genre WHERE name = 'Science Fiction'),
        (SELECT id FROM lbry.author WHERE last_name = 'Le Guin')),
    ('A Wizard of Earthsea', '9780553383041', '1968-11-01',
        (SELECT id FROM lbry.genre WHERE name = 'Fantasy'),
        (SELECT id FROM lbry.author WHERE last_name = 'Le Guin')),
    ('Foundation', '9780553293357', '1951-06-01',
        (SELECT id FROM lbry.genre WHERE name = 'Science Fiction'),
        (SELECT id FROM lbry.author WHERE last_name = 'Asimov')),
    ('The Colour of Magic', '9780062225672', '1983-11-24',
        (SELECT id FROM lbry.genre WHERE name = 'Fantasy'),
        (SELECT id FROM lbry.author WHERE last_name = 'Pratchett')),
    ('Murder on the Orient Express', '9780062693662', '1934-01-01',
        (SELECT id FROM lbry.genre WHERE name = 'Mystery'),
        (SELECT id FROM lbry.author WHERE last_name = 'Christie'));

-- Book copies ---------------------------------------------------------------

INSERT INTO lbry.book_copy (book_id, library_id, barcode, status) VALUES
    ((SELECT id FROM lbry.book WHERE isbn = '9780441478125'),
        (SELECT id FROM lbry.library WHERE name = 'Mission Branch'), 'BC-0001', 'available'),
    ((SELECT id FROM lbry.book WHERE isbn = '9780441478125'),
        (SELECT id FROM lbry.library WHERE name = 'Central Library'), 'BC-0002', 'checked_out'),
    ((SELECT id FROM lbry.book WHERE isbn = '9780553383041'),
        (SELECT id FROM lbry.library WHERE name = 'Mission Branch'), 'BC-0003', 'available'),
    ((SELECT id FROM lbry.book WHERE isbn = '9780553293357'),
        (SELECT id FROM lbry.library WHERE name = 'Midtown Library'), 'BC-0004', 'available'),
    ((SELECT id FROM lbry.book WHERE isbn = '9780062225672'),
        (SELECT id FROM lbry.library WHERE name = 'Austin Public'), 'BC-0005', 'checked_out'),
    ((SELECT id FROM lbry.book WHERE isbn = '9780062693662'),
        (SELECT id FROM lbry.library WHERE name = 'Central Library'), 'BC-0006', 'available');

-- Users ---------------------------------------------------------------------

INSERT INTO lbry."user" (username, email, full_name) VALUES
    ('alice', 'alice@example.com', 'Alice Anderson'),
    ('bob', 'bob@example.com', 'Bob Brown'),
    ('carol', 'carol@example.com', 'Carol Clark');

-- Accounts ------------------------------------------------------------------

INSERT INTO lbry.account (name) VALUES
    ('Anderson Household'),
    ('Downtown Reading Club');

INSERT INTO lbry.user_accounts (user_id, account_id) VALUES
    ((SELECT id FROM lbry."user" WHERE username = 'alice'),
        (SELECT id FROM lbry.account WHERE name = 'Anderson Household')),
    ((SELECT id FROM lbry."user" WHERE username = 'bob'),
        (SELECT id FROM lbry.account WHERE name = 'Downtown Reading Club')),
    ((SELECT id FROM lbry."user" WHERE username = 'carol'),
        (SELECT id FROM lbry.account WHERE name = 'Downtown Reading Club'));

-- Roles ---------------------------------------------------------------------

INSERT INTO lbry.role (name) VALUES
    ('member'),
    ('librarian'),
    ('admin');

INSERT INTO lbry.user_roles (user_id, role_id) VALUES
    ((SELECT id FROM lbry."user" WHERE username = 'alice'),
        (SELECT id FROM lbry.role WHERE name = 'admin')),
    ((SELECT id FROM lbry."user" WHERE username = 'bob'),
        (SELECT id FROM lbry.role WHERE name = 'member')),
    ((SELECT id FROM lbry."user" WHERE username = 'carol'),
        (SELECT id FROM lbry.role WHERE name = 'librarian'));

INSERT INTO lbry.account_roles (account_id, role_id) VALUES
    ((SELECT id FROM lbry.account WHERE name = 'Anderson Household'),
        (SELECT id FROM lbry.role WHERE name = 'member')),
    ((SELECT id FROM lbry.account WHERE name = 'Downtown Reading Club'),
        (SELECT id FROM lbry.role WHERE name = 'member'));

-- Checkouts (active) --------------------------------------------------------

INSERT INTO lbry.checkout (user_id, book_copy_id, checked_out_at, due_at) VALUES
    ((SELECT id FROM lbry."user" WHERE username = 'bob'),
        (SELECT id FROM lbry.book_copy WHERE barcode = 'BC-0002'),
        now() - interval '3 days', now() + interval '18 days'),
    ((SELECT id FROM lbry."user" WHERE username = 'carol'),
        (SELECT id FROM lbry.book_copy WHERE barcode = 'BC-0005'),
        now() - interval '10 days', now() + interval '11 days');

-- Checkouts (history) -------------------------------------------------------

INSERT INTO lbry.checkout_history (user_id, book_copy_id, checked_out_at, due_at, returned_at) VALUES
    ((SELECT id FROM lbry."user" WHERE username = 'alice'),
        (SELECT id FROM lbry.book_copy WHERE barcode = 'BC-0001'),
        now() - interval '30 days', now() - interval '9 days', now() - interval '12 days');
