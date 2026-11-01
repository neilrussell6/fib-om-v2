# Implementation changelog — 03-seed-dummy

- Date: 20261101-135619
- Feature: 03-seed-dummy
- Phase: 3 (Implementation)

## 20261101-135619 — write tests

- `tests/unit/v1-categories.test.ts`: v1 names, renames, 36 `show_*` columns, flags for three categories (AC-10).
- `tests/unit/seed-dummy-dataset.test.ts`: determinism (AC-2), client ids with the sender at 1 and 20 (AC-4), dummy-only ABN/ACN, phones and addresses (AC-8), no workflow runs `seed-dummy` (AC-9).
- `tests/integration/seed-dummy-cli.test.ts`: each guard rule refused with its own message and no connection attempt, using `seed-guard.invalid`; local hosts let through to a connection error (AC-6, AC-7).
- `tests/integration/seed-dummy.test.ts`: coverage (AC-1), identical data per seed (AC-2), wipe and keep users (AC-3), sequences and `FROM_CLIENT_ID=20` (AC-4), rollback (AC-5), all against a throwaway database.
- `tests/helpers/throwaway-db.ts`: creates a database, migrates it with Atlas, force-drops it; clear error when `atlas` is missing.

## 20261101-135619 — implement

- `lib/data/v1-categories.ts`: `SHOW_COLUMNS`, `V1_CATEGORY_RENAMES`, `V1_CATEGORIES` with v1's flags, and `flagsWith` (Design: Code layout; AC-10).
- `scripts/lib/target-guard.ts`: `parseTarget`, `checkTarget` (local hosts only for `local`; `PRODUCTION_DB_HOST` required for staging/production; production host refused unless `production`), `isProductionHost`, `envValue` (empty counts as unset); every refusal is a `GuardError` starting "Refused:" (Design: Target guard; AC-6, AC-7).
- `scripts/seed-dummy.ts`:
  - `buildDataset(seed, fromClientId)`: mulberry32 PRNG, fixed 2026-01-01 anchor for every date; 37 clients with explicit ids (sender at `fromClientId`), 10 categories (v1's 8 plus "Dummy All Columns"/"Dummy No Columns"), 8 types/sizes/media, 72 products, 24 dockets sent to clients with orders, 72 orders, 360 order items; enum values cycled with NULL; fixed edge-case rows for booleans, zero dimensions, non-ASCII and `/`, and the four notcher-feed combinations (AC-1, AC-2, AC-4, AC-8).
  - `seedDummy(client, dataset)`: one transaction; one `TRUNCATE … CONTINUE IDENTITY`; restarts and then sets the reference and docket sequences after explicit-id inserts; orders inserted one by one so order items map by position; rollback on any error (AC-3, AC-4, AC-5).
  - CLI: `.env` only for `--target local`; guard; `FROM_CLIENT_ID` required for staging; visible readline confirmation unless `--yes`; prints rows per table (AC-6, AC-7).
- `package.json`: `seed:dummy` script.
- Reference tables and dockets carry explicit ids (1…n) as well as clients, so products and dockets can point at them directly and AC-5 can use a missing `product_id`; the sequences are restarted and then set past the highest id, which keeps AC-4's "start again at 1".

## 20261101-171508 — fix (environment)

- No change to this feature's code. The first full run failed 4 CRUD browser tests on the 30 s timeout. Every local query went through the local Neon proxy, which re-authenticates for each query (~200–350 ms). By author decision, every local connection now goes straight to Postgres and the proxy is removed (commit `2dbddae`, `logs/01-users-auth/20261101-171508--spec-revision-changelog.md`).
- Unit test count is 167 (was 168): the `LOCAL_DB_VIA_PROXY` opt-in case went with the proxy.
