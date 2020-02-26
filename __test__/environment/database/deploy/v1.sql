-- Deploy delv-test:v1 to pg

BEGIN;

CREATE SCHEMA delv;

CREATE TABLE delv.book_categories( -- Use for table with a different pk than the others
    category TEXT PRIMARY KEY
);

CREATE TABLE delv.books(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category REFERENCES delv.book_categories(category)
);

CREATE TABLE delv.authors(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);

CREATE TABLE delv.libraries(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);

CREATE TABLE delv.account(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);

CREATE TABLE delv.book_authors(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES delv.books(id),
    author_id UUID REFERENCES delv.authors(id)
);

CREATE TABLE delv.library_books(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES delv.books(id),
    library_id UUID REFERENCES delv.libraries(id)
);

CREATE TABLE delv.library_accounts(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_id UUID REFERENCES delv.libraries(id)
    account_id UUID REFERENCES delv.accounts(id)
);

CREATE TABLE delv.checkouts(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES delv.books(id),
    library_id UUID REFERENCES delv.libraries(id),
    account_id UUID REFERENCES delv.accounts(id)
    out_at TIMESTAMP DEFAULT NOW()
    in_at TIMESTAMP,
    returned BOOLEAN DEFAULT FALSE
);

CREATE TABLE delv.account_syndicates( -- Histroically A(many)-to-(many)A has been an issue for delv
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES delv.accounts(id),
    account_id UUID REFERENCES delv.accounts(id),
    relationship TEXT NOT NULL
);

CREATE TABLE delv.overdue_fine( -- Caching json, so lets just make a table that uses json
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_id UUID REFERENCES delv.checkouts(id),
    payment_info JSONB
);


COMMIT;
