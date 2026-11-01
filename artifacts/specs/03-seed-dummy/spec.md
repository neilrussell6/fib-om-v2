# Spec — 03-seed-dummy

- Date: 20261101-125349
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

`scripts/seed-dummy.ts` fills a local or staging database with a deterministic, synthetic dataset covering every table except `users`: clients, the product catalogue, orders, order items and delivery dockets. It wipes and replaces the existing app data, keeps the users so staff can still log in, and refuses to touch production. It also introduces the production guard (`PRODUCTION_DB_HOST`) that `05-data-scripts` reuses for `seed-old`.

## User-visible behaviour

For staff on staging (and developers locally): after `seed-dummy` runs, every list in the app has data spread over more than one page at the default page size (25), every order and docket status and every production-stage state can be seen, and docket creation works because the sender client (`FROM_CLIENT_ID`) exists. Nothing in the data resembles a real client.

For developers and operators:

- **`scripts/seed-dummy.ts --target <local|staging> [--seed <n>]`** (`npm run seed:dummy -- --target …`)
  - **Wipes and replaces** all app data: empties every app table except `users`, `login_attempts` and the Atlas revisions table, then fills them with the synthetic dataset. Existing users are unchanged.
  - `--target` is required and must be `local` or `staging`. It only labels the target for the safety guards; the connection always comes from `DATABASE_URL_UNPOOLED` (a direct connection, like migrations).
  - `--seed` is an integer, default `1`. The same seed always produces the same data.
  - Reads `.env` if present (like `create-user`), so locally it needs no extra setup. For staging, the operator sets the staging branch's `DATABASE_URL_UNPOOLED` and `PRODUCTION_DB_HOST` for the session only; they are never written to a committed file.
  - Prints a summary: rows inserted per table, the seed, and the target.
  - Exits non-zero with a clear message on any refusal or error, and leaves the database unchanged.
- **Never from CI.** No workflow runs `seed-dummy`. On staging an operator runs it, after `deploy.yml` has migrated the schema.
- On staging, `seed-dummy` replaces any real reference data loaded by `seed-old`. `seed-old --target staging --wipe-orders` (spec 05) puts the real reference data back.

## Design

### Dataset
Generated in TypeScript from a small seeded PRNG (no new dependency) and the `--seed` value. Dates are computed from a fixed anchor date (2026-01-01), not from today, so the output doesn't depend on when it runs. Names are obviously fake (for example "Dummy Client 07", "DMY-0042"), and no field holds a real-looking ABN, ACN, phone number or address.

Coverage, so every screen and every later feature has something to show:

- **Reference data:** at least 30 clients; one category for each name v1 knows (after v1's renames and additions, spec 05), with a varied mix of `show_*` flags, including one category with every flag on and one with every flag off; product types with and without `millimetres_per_pleat`, product media with and without `pleat_spacing`; at least 60 products spread over every category, with `notcher` both true and false and `efficiency` both set and NULL.
- **Sender client:** a client with id `FROM_CLIENT_ID` (from the environment, default `1`) is always present, named "Fibatron (dummy)", so docket creation (spec 02) works.
- **Orders:** at least 60, in every `order_status` (`new`, `complete`, `archived`), with due dates before and after the anchor date, with and without a delivery docket.
- **Order items:** at least 300, spread over every category; every value of every enum column (`clip_type`, `clip_position`, `wire_mesh`, `wire_sides`, `media_mats`, `gasket`) and NULL for each nullable column; both values of every boolean column, including all seven stage statuses; zero and non-zero dimensions; non-ASCII text and `/` in at least one `comment` and `part_number`.
- **Delivery dockets:** at least 20, in both `docket_status` values, sent from the sender client; some with several orders, some with none.
- **Notcher feed:** the conditions the feed filters on (order `new`, frame status not done, product `notcher` set) each appear both met and not met, so the feed built in spec 04 returns some items and leaves others out.

### Writing
- One transaction: `TRUNCATE` every app table except `users`, `login_attempts` and the Atlas revisions table, then insert the dataset in FK order (reference tables → delivery dockets → orders → order items). Any error rolls back the whole run.
- Reference tables and `delivery_dockets` are truncated with `RESTART IDENTITY`. The sender client is inserted with `OVERRIDING SYSTEM VALUE`, and the `clients` sequence is then set above the highest id.
- **`orders` and `order_items` are never truncated with `RESTART IDENTITY`**, and their rows take ids from the existing sequences. Once `seed-old` has set those sequences above the legacy maximum (spec 05), `seed-dummy` never lowers them, so new ids never reuse ids the notcher software has already seen.
- Uses `pg` over `DATABASE_URL_UNPOOLED`, like the test helpers and migrations. No app code paths (Server Actions) are used.

### Production guard (shared with spec 05)
In `scripts/lib/target-guard.ts`, so `seed-old` (spec 05) reuses it:

- Parses `--target` and rejects a missing or unknown value.
- The operator's environment sets `PRODUCTION_DB_HOST` (the production Neon branch's endpoint host). It is required whenever `--target` is `staging` or `production`.
- Compares the host in `DATABASE_URL_UNPOOLED` with `PRODUCTION_DB_HOST` before connecting.
- `seed-dummy`'s rules: `--target production` is rejected; with `--target staging`, an unset `PRODUCTION_DB_HOST` is rejected; whenever the host matches `PRODUCTION_DB_HOST`, the script refuses, whatever `--target` says. Every refusal happens before a database connection is opened.

### Changes from the original
- **Contract-test link removed.** The original said `seed-dummy` was "built on the notcher contract-test fixture from spec 03" and that the notcher contract test must pass against its output. That fixture doesn't exist yet (it is built in spec 04), and the contract test has its own fixture and golden file. Instead, the dataset covers the conditions the feed filters on (Dataset, above), and spec 04 can extend `seed-dummy` if its screens need more.
- **Sender client added.** The original didn't mention `FROM_CLIENT_ID`. Without that client, creating a docket on seeded data fails.
- **`login_attempts` kept.** The table is added by spec 01; like `users`, it isn't app data.
- **Determinism made explicit:** `--seed` with a default, and a fixed anchor date.

## Acceptance criteria

Automated (integration tests against the local Postgres container with migrations applied):

1. **AC-1** `seed-dummy --target local` fills every app table except `users` and `login_attempts`, covering everything listed under Dataset: every order status, docket status, enum value and NULL in each nullable column, both values of every boolean column, every category, the sender client with id `FROM_CLIENT_ID`, and the notcher-feed conditions both met and not met.
2. **AC-2** Running it twice with the same seed produces identical data: compared table by table and ordered by id, every row matches, ignoring the `orders` and `order_items` ids (and the order and item references to them), which come from sequences that aren't reset. A different seed produces different data.
3. **AC-3** Any clients, products, orders, order items and dockets that existed beforehand are gone afterwards; existing `users` and `login_attempts` rows are unchanged.
4. **AC-4** If the `orders` and `order_items` sequences were set to start at 100000 before the run, every inserted order and order-item id is at least 100000 and the sequences are not lowered.
5. **AC-5** If an insert fails partway (test: make one insert fail), the transaction rolls back and the database is exactly as it was before the run.
6. **AC-6** `seed-dummy --target production`, `seed-dummy` with no `--target` and `seed-dummy --target prod` all exit non-zero without opening a database connection.
7. **AC-7** With `DATABASE_URL_UNPOOLED` pointing at the host in `PRODUCTION_DB_HOST`, `seed-dummy --target local` and `--target staging` exit non-zero without connecting; `seed-dummy --target staging` with `PRODUCTION_DB_HOST` unset exits non-zero without connecting.
8. **AC-8** The dataset contains no ABN or ACN values and no phone numbers or addresses that look real (test: pattern checks on those columns).
9. **AC-9** No file under `.github/workflows/` runs `seed-dummy`.

Operational (recorded check, not CI):

10. **AC-10** Staging has been seeded by an operator: every list screen shows more than one page at the default page size, and a docket can be created on the seeded data.

## Out of scope

- `seed-old`, `snapshot.sh`, the notcher capture and cutover (`05-data-scripts`).
- Running `seed-dummy` against production, or from CI.
- Creating users (`create-user`, spec 01).
- Running the notcher contract test against seeded data (the contract test keeps its own fixture, spec 04).
- Derived columns (`calculated_id`, `pleats`, `wire_metres`, `wire_height`, `order_items_packed`): they are views added in spec 04 and are computed from the seeded columns automatically.

## Open questions

1. ~~**OQ-1 `seed-dummy` on staging**~~ — resolved 2026-10-31 (carried over from spec 05's OQ-2): wipe and replace all app data (users kept). `seed-old --wipe-orders` (never on production) reloads real reference data afterwards.
2. **OQ-2 Confirmation prompt on staging.** `seed-old --target staging|production` asks the operator to type the target name before writing. Should `seed-dummy --target staging` ask the same, since it wipes staging's reference data? Recommendation: yes, with the same rule as `seed-old` (non-interactive runs without confirmation exit non-zero before connecting). The original spec didn't require it.
