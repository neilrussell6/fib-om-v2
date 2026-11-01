# Spec — 03-seed-dummy

- Date: 20261101-125349
- Revised: 20261101-133629 (spec review FAIL, author decisions D1–D11)
- Revised: 20261101-133951 (re-review FAIL, author decision D12)
- Feature: 03-seed-dummy
- Phase: 1 (Spec)

> Part 3 of 5 of the FIB OM migration. Read with the overview
> [`artifacts/docs/nextjs-vercel-neon-migration.md`](../../docs/nextjs-vercel-neon-migration.md)
> (sections O1–O9). Depends on `02-basic-crud` (schema). Next: `04-custom-behaviour`.
>
> Extracted on 2026-11-01 from `05-data-scripts` (formerly `04-data-scripts`), so that local and
> staging databases have realistic data to work against while `04-custom-behaviour` is built and
> tested. The behaviour is the one approved there, with the changes listed under "Changes from the
> original".

## Summary

`scripts/seed-dummy.ts` fills a local or staging database with a deterministic, synthetic dataset covering every app table except `users` and `login_attempts`: clients, the product catalogue, orders, order items and delivery dockets. It wipes and replaces the existing app data, keeps the users so staff can still log in, and refuses to touch production. It also introduces two pieces that `05-data-scripts` reuses for `seed-old`: the target guard (`scripts/lib/target-guard.ts`) and v1's category list (`lib/data/v1-categories.ts`).

## User-visible behaviour

For staff on staging (and developers locally): after `seed-dummy` runs, the Clients, Products, Orders and Order Items lists each span more than one page at the default page size (25), and every other list except Users has data. Every order and docket status and every production-stage state can be seen, the order-items columns per category match v1's, and docket creation works because the sender client (`FROM_CLIENT_ID`) exists. Nothing in the data resembles a real client.

For developers and operators:

- **`scripts/seed-dummy.ts --target <local|staging> [--seed <n>] [--yes]`** (`npm run seed:dummy -- --target …`; `package.json` gets `"seed:dummy": "tsx scripts/seed-dummy.ts"`, like `create-user`)
  - **Wipes and replaces** all app data: empties every app table except `users`, `login_attempts` and the Atlas revisions table, then fills them with the synthetic dataset. Existing users are unchanged.
  - `--target` is required and must be `local` or `staging`. It only labels the target for the safety guards; the connection always comes from `DATABASE_URL_UNPOOLED` (a direct connection, like migrations).
  - `--seed` is an integer, default `1`. The same seed always produces the same data.
  - **`--target local`** only accepts a local database host (see Target guard). `FROM_CLIENT_ID` defaults to `1`, matching `.env.tpl` and CI.
  - **`--target staging`** requires `PRODUCTION_DB_HOST` and `FROM_CLIENT_ID` to be set explicitly; `FROM_CLIENT_ID` must be the value in Vercel's Preview environment, so the staging app's docket sender exists. It then asks the operator to type `staging` to confirm. A run with no terminal exits non-zero before connecting, unless `--yes` is given.
  - With `--target local`, reads `.env` if present (like `create-user`), so locally it needs no extra setup. With `--target staging`, `.env` is not read: the operator sets the staging branch's `DATABASE_URL_UNPOOLED`, `PRODUCTION_DB_HOST` and `FROM_CLIENT_ID` for the session only (never in a committed file), so a stale local `.env` never mixes into a staging run. An empty `PRODUCTION_DB_HOST` or `FROM_CLIENT_ID` counts as unset.
  - Prints a summary: rows inserted per table, the seed, and the target.
  - Exits non-zero with a clear message on any refusal or error, and leaves the database unchanged.
- **Never from CI.** No workflow runs `seed-dummy`. On staging an operator runs it, after `deploy.yml` has migrated the schema.
- On staging, `seed-dummy` replaces any real reference data loaded by `seed-old`. `seed-old --target staging --wipe-orders` (spec 05) puts the real reference data back.

## Design

### Code layout
- **`scripts/seed-dummy.ts`** exports two functions, and its CLI entry point only parses arguments, runs the target guard (and the staging prompt), connects, and calls them:
  - `buildDataset(seed: number, fromClientId: number)`: pure, returns every row to insert, grouped by table. No database access.
  - `seedDummy(client: pg.Client, dataset)`: runs the transaction under Writing, and returns the row counts.
- **`scripts/lib/target-guard.ts`**: the target guard below, shared with `seed-old` (spec 05).
- **`lib/data/v1-categories.ts`**: v1's category names and their `show_*` flags, copied once from `../fib-om-v2-reference/migrations/data-dml-updates.sql` (the four renames, the four added categories and the per-category `UPDATE … SET show_*` statements). `seed-dummy` creates its categories from it, and `seed-old` (spec 05) uses it for the same mapping.

### Dataset
Generated in TypeScript from a small seeded PRNG (no new dependency) and the `--seed` value. Names are obviously fake (for example "Dummy Client 07", "DMY-0042"), and no field holds a real-looking ABN, ACN, phone number or address.

**Dates** come from a fixed anchor date (2026-01-01), never from today: every date column (`orders.date`, `orders.due_date`, `delivery_dockets.date`) is set explicitly, and no column default is relied on.

Coverage, so every screen and every later feature has something to show:

- **Reference data:** at least 30 clients. One category per entry in `lib/data/v1-categories.ts`, with v1's names and `show_*` flags, plus two dummy categories: "Dummy All Columns" (every flag on) and "Dummy No Columns" (every flag off). Product types with and without `millimetres_per_pleat`; product media with and without `pleat_spacing`. At least 60 products spread over every category, with `notcher` both true and false and `efficiency` both set and NULL.
- **Sender client:** a client with id `FROM_CLIENT_ID` is always present, named "Fibatron (dummy)", so docket creation (spec 02) works.
- **Client ids:** `buildDataset` assigns every client id itself: the sender gets `FROM_CLIENT_ID`, and the dummy clients get the other ids from 1 upward, skipping it. Other tables take ids from their sequences.
- **Orders:** at least 60, in every `order_status` (`new`, `complete`, `archived`), with due dates before and after the anchor date, with and without a delivery docket.
- **Order items:** at least 300, spread over every category; every value of every enum column (`clip_type`, `clip_position`, `wire_mesh`, `wire_sides`, `media_mats`, `gasket`) and NULL for each nullable column; both values of every boolean column, including all seven stage statuses; zero and non-zero dimensions; non-ASCII text and `/` in at least one `comment` and `part_number`.
- **Delivery dockets:** at least 20, in both `docket_status` values, sent from the sender client; some with several orders, some with none.
- **Notcher feed:** the conditions the feed filters on (order `new`, frame status not done, product `notcher` set) each appear both met and not met, so the feed built in spec 04 returns some items and leaves others out.

### Writing
One transaction; any error rolls back the whole run:

1. One `TRUNCATE … CONTINUE IDENTITY` of every app table except `users`, `login_attempts` and the Atlas revisions table. They must go in a single statement, because Postgres refuses to truncate a table that another table not in the statement references.
2. `ALTER SEQUENCE … RESTART` for the reference tables' and `delivery_dockets`' identity sequences only.
3. **`orders` and `order_items` keep their sequences**, and their rows take ids from them. Once `seed-old` has set those sequences above the legacy maximum (spec 05), `seed-dummy` never lowers them, so new ids never reuse ids the notcher software has already seen.
4. Insert the dataset in FK order: reference tables → delivery dockets → orders → order items. Every client is inserted with its assigned id using `OVERRIDING SYSTEM VALUE`, and the `clients` sequence is then set above the highest client id.

Uses `pg` over `DATABASE_URL_UNPOOLED`, like the test helpers and migrations. No app code paths (Server Actions) are used.

### Target guard (shared with spec 05)
`scripts/lib/target-guard.ts` runs before any database connection is opened. Every refusal exits non-zero with a message naming the rule.

- Parses `--target`; a missing or unknown value is refused.
- **Local hosts:** with `--target local`, the host in `DATABASE_URL_UNPOOLED` must be `localhost`, `127.0.0.1` or `db.localtest.me`; any other host is refused. This also applies to `seed-old --target local`.
- **Production host:** `PRODUCTION_DB_HOST` (the production Neon branch's endpoint host) is required whenever `--target` is `staging` or `production`. When the host in `DATABASE_URL_UNPOOLED` matches it and `--target` isn't `production`, the script refuses.
- **`seed-dummy`'s own rules:** `--target production` is refused; the production host is refused whatever `--target` says; `--target staging` requires `FROM_CLIENT_ID` and the typed confirmation (or `--yes`).

### Changes from the original
- **Contract-test link removed.** The original said `seed-dummy` was "built on the notcher contract-test fixture from spec 03" and that the notcher contract test must pass against its output. That fixture doesn't exist yet (it is built in spec 04), and the contract test has its own fixture and golden file. Instead, the dataset covers the conditions the feed filters on (Dataset, above), and spec 04 can extend `seed-dummy` if its screens need more.
- **Sender client added.** The original didn't mention `FROM_CLIENT_ID`. Without that client, creating a docket on seeded data fails.
- **`login_attempts` kept.** The table is added by spec 01; like `users`, it isn't app data.
- **Determinism made explicit:** `--seed` with a default, and a fixed anchor date for every date column.
- **Categories from v1.** The original asked for "every category attribute value"; the categories now use v1's real names and flags, plus two edge-case categories.
- **Stricter guard:** local hosts only for `--target local`, `FROM_CLIENT_ID` required and a typed confirmation for `--target staging`.
- **`.env` only for local** (decided 2026-11-01, task review): `--target staging` uses the session environment alone.

## Acceptance criteria

Automated. The integration tests that run `seed-dummy` use a **throwaway database** created and migrated (Atlas, `db/migrations`) for the test run and dropped afterwards, never the shared test database the other integration tests use.

1. **AC-1** `seedDummy` with `buildDataset(1, 1)` fills every app table except `users` and `login_attempts`, covering everything listed under Dataset: every order status, docket status, enum value and NULL in each nullable column, both values of every boolean column, every v1 category with v1's flags plus the two dummy categories, the sender client with id `1`, and the notcher-feed conditions both met and not met; clients, products, orders and order items each have more than 25 rows.
2. **AC-2** Running it twice with the same seed produces identical data: compared table by table and ordered by id, every row matches, ignoring the `orders` and `order_items` ids (and the order and item references to them), which come from sequences that aren't reset. A different seed produces different data. `buildDataset` called twice with the same arguments returns equal values.
3. **AC-3** Any clients, products, orders, order items and dockets that existed beforehand are gone afterwards; existing `users` and `login_attempts` rows are unchanged.
4. **AC-4** If the `orders` and `order_items` sequences were set to start at 100000 before the run, every inserted order and order-item id is at least 100000 and the sequences are not lowered; the reference tables' and `delivery_dockets`' ids start again at 1. With `FROM_CLIENT_ID` set to `20` (inside the range the dummy clients use), the run succeeds, the sender has id 20, no two clients share an id, and the next `clients` id is above the highest.
5. **AC-5** `seedDummy` given a dataset with one invalid row (an order item whose `product_id` doesn't exist) fails, and the database is exactly as it was before the run.
6. **AC-6** Run as a CLI with `DATABASE_URL_UNPOOLED` set to a non-local host that never resolves (`postgres://x@seed-guard.invalid:1/none`; `.invalid` is reserved), each of these exits non-zero with the guard's message on stderr and no connection error (proving it refused before connecting): `--target production`; no `--target`; `--target prod`; `--target local` with a non-local host; `--target staging` with `PRODUCTION_DB_HOST` unset; `--target staging` with `FROM_CLIENT_ID` unset; `--target staging` with no terminal and no `--yes`.
7. **AC-7** With `DATABASE_URL_UNPOOLED` set to `postgres://x@seed-guard.invalid:1/none` and `PRODUCTION_DB_HOST=seed-guard.invalid`, `--target staging --yes` (with `FROM_CLIENT_ID` set) exits non-zero with the guard's message and no connection error. `--target local` with `localhost`, `127.0.0.1` and `db.localtest.me` hosts on an unused port passes the guard: it exits non-zero with a connection error, not the guard's message.
8. **AC-8** The dataset contains no ABN or ACN values and no phone numbers or addresses that look real (test: pattern checks on `buildDataset`'s output).
9. **AC-9** No file under `.github/workflows/` runs `seed-dummy`.
10. **AC-10** `lib/data/v1-categories.ts` lists every category name in v1 after its renames and additions, with the flags from `data-dml-updates.sql` (test: a committed list of expected names and a spot check of flags for three categories).

Operational (recorded check, not CI):

11. **AC-11** Staging has been seeded by an operator: the Clients, Products, Orders and Order Items lists each show more than one page at the default page size, and a docket can be created on the seeded data.

## Out of scope

- `seed-old`, `snapshot.sh`, the notcher capture and cutover (`05-data-scripts`).
- Running `seed-dummy` against production, or from CI.
- Creating users (`create-user`, spec 01).
- Running the notcher contract test against seeded data (the contract test keeps its own fixture, spec 04).
- Derived columns (`calculated_id`, `pleats`, `wire_metres`, `wire_height`, `order_items_packed`): they are views added in spec 04 and are computed from the seeded columns automatically.

## Open questions

1. ~~**OQ-1 `seed-dummy` on staging**~~ — resolved 2026-10-31 (carried over from spec 05's OQ-2): wipe and replace all app data (users kept). `seed-old --wipe-orders` (never on production) reloads real reference data afterwards.
2. ~~**OQ-2 Confirmation prompt on staging**~~ — resolved 2026-11-01: `--target staging` asks the operator to type `staging`; a run with no terminal exits non-zero before connecting unless `--yes` is given. `--target local` never prompts.
