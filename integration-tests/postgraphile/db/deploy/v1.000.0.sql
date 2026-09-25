-- Deploy lbry:v1.000.0 to pg
-- Initial schema for the "lbry" library app.
-- All tables live in schema lbry with uuid primary keys and
-- created_at / updated_at timestamps. Foreign keys give PostGraphile
-- forward + reverse connections so delv can normalize the graph.

BEGIN;

CREATE SCHEMA lbry;

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA lbry;

-- Geography -----------------------------------------------------------------

CREATE TABLE lbry.state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL,
    code lbry.citext NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.city (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL,
    state_id uuid NOT NULL REFERENCES lbry.state (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX city_state_id_idx ON lbry.city (state_id);

CREATE TABLE lbry.library (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL,
    address lbry.citext,
    city_id uuid NOT NULL REFERENCES lbry.city (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX library_city_id_idx ON lbry.library (city_id);

-- Catalog -------------------------------------------------------------------

CREATE TABLE lbry.genre (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.author (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name lbry.citext NOT NULL,
    last_name lbry.citext NOT NULL,
    bio lbry.citext,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.book (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title lbry.citext NOT NULL,
    isbn lbry.citext UNIQUE,
    published_date date,
    genre_id uuid REFERENCES lbry.genre (id),
    author_id uuid NOT NULL REFERENCES lbry.author (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_genre_id_idx ON lbry.book (genre_id);
CREATE INDEX book_author_id_idx ON lbry.book (author_id);

-- Physical copies so checkouts are realistic -------------------------------

CREATE TABLE lbry.book_copy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL REFERENCES lbry.book (id),
    library_id uuid NOT NULL REFERENCES lbry.library (id),
    barcode lbry.citext NOT NULL UNIQUE,
    status lbry.citext NOT NULL DEFAULT 'available',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_copy_book_id_idx ON lbry.book_copy (book_id);
CREATE INDEX book_copy_library_id_idx ON lbry.book_copy (library_id);

-- Identity ------------------------------------------------------------------

CREATE TABLE lbry."user" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username lbry.citext NOT NULL UNIQUE,
    email lbry.citext NOT NULL UNIQUE,
    full_name lbry.citext,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.account (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.user_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES lbry."user" (id),
    account_id uuid NOT NULL REFERENCES lbry.account (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, account_id)
);

CREATE INDEX user_accounts_user_id_idx ON lbry.user_accounts (user_id);
CREATE INDEX user_accounts_account_id_idx ON lbry.user_accounts (account_id);

-- Roles ---------------------------------------------------------------------

CREATE TABLE lbry.role (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name lbry.citext NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lbry.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES lbry."user" (id),
    role_id uuid NOT NULL REFERENCES lbry.role (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role_id)
);

CREATE INDEX user_roles_user_id_idx ON lbry.user_roles (user_id);
CREATE INDEX user_roles_role_id_idx ON lbry.user_roles (role_id);

CREATE TABLE lbry.account_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES lbry.account (id),
    role_id uuid NOT NULL REFERENCES lbry.role (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, role_id)
);

CREATE INDEX account_roles_account_id_idx ON lbry.account_roles (account_id);
CREATE INDEX account_roles_role_id_idx ON lbry.account_roles (role_id);

-- Circulation ---------------------------------------------------------------

CREATE TABLE lbry.checkout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES lbry."user" (id),
    book_copy_id uuid NOT NULL REFERENCES lbry.book_copy (id),
    checked_out_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL DEFAULT (now() + interval '21 days'),
    returned_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkout_user_id_idx ON lbry.checkout (user_id);
CREATE INDEX checkout_book_copy_id_idx ON lbry.checkout (book_copy_id);

COMMIT;
