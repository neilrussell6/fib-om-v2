# Tasks — 03-seed-dummy

- Date: 20261101-135000
- Feature: 03-seed-dummy
- Phase: 2 (Tasks)

Built from `artifacts/specs/03-seed-dummy/spec.md` and the overview `artifacts/docs/nextjs-vercel-neon-migration.md` (O6, O7). References in brackets point at the spec's acceptance criteria (AC n) or Design sections.

## Tasks

### Shared pieces

- [ ] Add `lib/data/v1-categories.ts`: v1's category names after its renames (Bag → Bag Filters, Flat Panel → Flat Panel Filters, Holding Frame → Holding Frames, VForm → V Form Panel Filters) and additions (Wire Products, Carbon Filters, Filter Units, Media), each with its `show_*` flags, copied from `../fib-om-v2-reference/migrations/data.sql` (original names) and `data-dml-updates.sql` (renames, additions, `UPDATE … SET show_*`); every `show_*` column of `product_categories` is present for every category, defaulting to `false` where v1 sets nothing; also export the four renames as a mapping for `seed-old` (spec 05) (Design: Code layout; AC 10)
- [ ] Add `scripts/lib/target-guard.ts`: parse `--target` (refuse missing or unknown values); read the host from `DATABASE_URL_UNPOOLED`; with `local`, accept only `localhost`, `127.0.0.1` or `db.localtest.me`; with `staging` or `production`, require `PRODUCTION_DB_HOST`; an empty `PRODUCTION_DB_HOST` or `FROM_CLIENT_ID` counts as unset; refuse when the host matches `PRODUCTION_DB_HOST` and the target isn't `production`; every refusal is an error whose message names the rule. Written so `seed-old` can add its own rules on top (Design: Target guard; AC 6, AC 7)

### `seed-dummy`

- [ ] Add a small seeded PRNG (no new dependency) for `buildDataset`, with a helper to pick from a list and an integer range (Design: Dataset)
- [ ] Add `buildDataset(seed, fromClientId)` to `scripts/seed-dummy.ts`, pure and returning rows grouped by table, with every date from the 2026-01-01 anchor (`orders.date`, `orders.due_date`, `delivery_dockets.date` set explicitly): (Design: Dataset; AC 1, AC 2, AC 8)
  - [ ] clients: at least 30 dummy clients plus the sender "Fibatron (dummy)"; every client gets an explicit id — the sender `fromClientId`, the dummy clients the other ids from 1 upward, skipping it; fake names only, and no ABN, ACN, phone numbers or addresses that look real; NULLs in each nullable column on some rows (Design: Dataset — Sender client, Client ids; AC 1, AC 4, AC 8)
  - [ ] product categories: one per entry in `lib/data/v1-categories.ts` with v1's flags, plus "Dummy All Columns" (every flag on) and "Dummy No Columns" (every flag off) (AC 1)
  - [ ] product types (with and without `millimetres_per_pleat`), sizes, and media (with and without `pleat_spacing`) (AC 1)
  - [ ] at least 60 products over every category, with `notcher` true and false and `efficiency` set and NULL (AC 1)
  - [ ] at least 20 delivery dockets from the sender client, in both statuses, each sent to a client that also has orders, so dockets can hold that client's orders (AC 1)
  - [ ] at least 60 orders in every status, due dates before and after the anchor, with and without a docket (only dockets of the order's own client, spec 02); some dockets with several orders, some with none (AC 1)
  - [ ] at least 300 order items over every category: every value of each enum column and NULL in each nullable column; both values of every boolean column including the seven stage statuses; zero and non-zero dimensions; non-ASCII text and `/` in at least one `comment` and `part_number`; each notcher-feed condition (order `new`, frame status not done, product `notcher`) both met and not met. Orders and order items reference each other by position in the dataset, since their ids come from sequences (AC 1, AC 2)
- [ ] Add `seedDummy(client, dataset)` to `scripts/seed-dummy.ts`: in one transaction, one `TRUNCATE … CONTINUE IDENTITY` of every app table except `users`, `login_attempts` and the Atlas revisions table; `ALTER SEQUENCE … RESTART` for the reference tables' and `delivery_dockets`' identity sequences only; insert in FK order (reference tables → dockets → orders → order items), clients with `OVERRIDING SYSTEM VALUE` and their assigned ids, then set the `clients` sequence above the highest id; orders and order items take ids from their sequences, mapping dataset positions to the returned ids; return row counts per table; any error rolls back (Design: Writing; AC 3, AC 4, AC 5)
- [ ] Add the CLI entry point to `scripts/seed-dummy.ts` (runs only when executed directly, so tests can import the functions): parse `--target`, `--seed` (integer, default `1`) and `--yes`; load `.env` if present only for `--target local` (for `staging`, the operator's session environment is used alone, so a stale local `.env` never mixes in); run the target guard; refuse `--target production` and the production host whatever the target; with `--target staging`, require `FROM_CLIENT_ID` and ask the operator to type `staging` with a plain, visible `node:readline` prompt, exiting non-zero before connecting when there is no terminal and no `--yes`; with `--target local`, default `FROM_CLIENT_ID` to `1`; only then connect with `pg` over `DATABASE_URL_UNPOOLED`, run `buildDataset` and `seedDummy`, and print rows per table, the seed and the target; exit non-zero with a clear message on any refusal or error (User-visible behaviour; Design: Target guard; AC 6, AC 7)
- [ ] Add `"seed:dummy": "tsx scripts/seed-dummy.ts"` to `package.json` (User-visible behaviour)

### Test infrastructure

- [ ] Add a test helper that creates a throwaway database (unique name) on the server in `DATABASE_URL_UNPOOLED`, applies `db/migrations` to it with Atlas (`atlas migrate apply --dir file://db/migrations --url … --revisions-schema public`), returns its connection string, and drops it afterwards in a `finally`/`afterAll`, closing its own clients first and using `DROP DATABASE … WITH (FORCE)` so a failed test leaves nothing behind; if `atlas` isn't on the PATH, it throws "atlas not found: install with curl -sSf https://atlasgo.sh | sh"; the `seed-dummy` tests use only this database, never the shared test database (Acceptance criteria preamble)

### Tests

- [ ] Unit: `buildDataset` called twice with the same arguments returns equal values, and a different seed returns different values (AC 2)
- [ ] Unit: `buildDataset(1, 1)` and `buildDataset(1, 20)` give unique client ids with the sender at `fromClientId` (AC 4)
- [ ] Unit: no ABN or ACN values, and phone and address columns are NULL or match the dummy patterns (AC 8)
- [ ] Unit: `lib/data/v1-categories.ts` matches a committed list of expected v1 category names, and the flags of three categories match expected values copied into the test from `data-dml-updates.sql` (the reference folder isn't in the repo or CI) (AC 10)
- [ ] Integration (throwaway database): `seedDummy` with `buildDataset(1, 1)` fills every app table except `users` and `login_attempts` with the coverage listed under Dataset, including the sender with id 1, both dummy categories, the notcher-feed conditions both met and not met, and more than 25 clients, products, orders and order items (AC 1)
- [ ] Integration (throwaway database): two runs with the same seed give identical rows in every table, ordered by id, ignoring `orders` and `order_items` ids and the references to them (AC 2)
- [ ] Integration (throwaway database): pre-existing clients, products, orders, order items and dockets are gone afterwards; pre-existing `users` and `login_attempts` rows are unchanged (AC 3)
- [ ] Integration (throwaway database): with the `orders` and `order_items` sequences set to 100000 first, every inserted id is at least 100000 and the sequences aren't lowered; reference and docket ids start at 1; with `FROM_CLIENT_ID` 20, the sender has id 20, client ids are unique, and the next `clients` id is above the highest (AC 4)
- [ ] Integration (throwaway database): `seedDummy` with a dataset holding one order item whose `product_id` doesn't exist fails, and every table is exactly as before (AC 5)
- [ ] Integration (CLI, no database): with `DATABASE_URL_UNPOOLED=postgres://x@seed-guard.invalid:1/none`, each case gets a complete environment in which only the rule under test is broken (for example the no-terminal case sets `FROM_CLIENT_ID=1` and a non-matching `PRODUCTION_DB_HOST`; a missing variable is passed as an empty string), and exits non-zero with that rule's specific message and no connection error: `--target production`; no `--target`; `--target prod`; `--target local`; `--target staging` without `PRODUCTION_DB_HOST`; `--target staging` without `FROM_CLIENT_ID`; `--target staging` with no terminal and no `--yes` (AC 6)
- [ ] Integration (CLI, no database): with `PRODUCTION_DB_HOST=seed-guard.invalid`, `--target staging --yes` (with `FROM_CLIENT_ID` set) exits non-zero with the production-host rule's message; `--target local` with `localhost`, `127.0.0.1` and `db.localtest.me` on an unused port exits non-zero with a connection error, not the guard's message (AC 7)
- [ ] Unit: no file under `.github/workflows/` mentions `seed-dummy` or `seed:dummy` (AC 9)

### Wrap-up

- [ ] Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:integration` locally, then `npm run seed:dummy -- --target local` against the local database and check the lists in the app (AC 1)
- [ ] Operational, after deploy: seed staging from a trusted machine (`--target staging` with staging's `DATABASE_URL_UNPOOLED`, `PRODUCTION_DB_HOST` and Vercel Preview's `FROM_CLIENT_ID`), then record that Clients, Products, Orders and Order Items each show more than one page and a docket can be created (AC 11)

## Not in this feature

- `seed-old`, `snapshot.sh`, the notcher capture and cutover (`05-data-scripts`).
- Running `seed-dummy` against production, or from CI.
- Creating users (`create-user`, spec 01).
- Running the notcher contract test against seeded data (the contract test keeps its own fixture, spec 04).
- Derived columns (`calculated_id`, `pleats`, `wire_metres`, `wire_height`, `order_items_packed`): they are views added in spec 04 and are computed from the seeded columns automatically.
