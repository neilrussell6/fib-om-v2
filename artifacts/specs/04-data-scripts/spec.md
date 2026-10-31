# Spec — 04-data-scripts

- Date: 20261031-140121
- Feature: 04-data-scripts
- Phase: 1 (Spec)

> Part 4 of 4 of the FIB OM migration. Read with the overview
> [`artifacts/docs/nextjs-vercel-neon-migration.md`](../../docs/nextjs-vercel-neon-migration.md)
> (sections O1–O9). Depends on `02-basic-crud` (schema) and `03-custom-behaviour`
> (contract-test fixture). Includes the cutover plan.

## Summary

Three scripts to get data into the new system, run by an operator from a trusted machine (never from CI), and the cutover plan. `scripts/snapshot.sh` connects to the legacy database and takes a full data dump. `scripts/seed-old.ts` loads the reference data (clients and the product catalogue) from a snapshot into the new schema, keeping ids, cleaning the data and verifying the result, and sets the order id sequences above the legacy maximum. `scripts/seed-dummy.ts` fills a local or staging database with synthetic data. Orders, order items, delivery dockets, invoices and users are never imported.

## User-visible behaviour

For staff, after `seed-old` runs: every legacy client and product-catalogue record (except orphaned products) appears in the new app with the same id and the same values (cleaned as below). Orders, order items and delivery dockets are empty. Open orders were closed in the old system before cutover and are not re-entered.

For developers and operators:

- **`scripts/snapshot.sh`**
  - Connects to the legacy DB (`SOURCE_DATABASE_URL`, read-only credentials) and runs `pg_dump` of the `api` schema, **schema and data**, in custom format, with `--no-owner --no-privileges`.
  - Writes `snapshots/<YYYYMMDD-HHMMSS>.dump` (the `snapshots/` directory is gitignored) and prints the path.
  - Never writes to the source; exits non-zero with a clear message if `SOURCE_DATABASE_URL` is unset or `pg_dump` fails.
- **`scripts/seed-old.ts --target <local|staging|production> <snapshot file>`** (`npm run seed:old -- …`)
  - Restores the snapshot into a scratch database (`SCRATCH_DATABASE_URL`, a local Postgres container on the operator's machine), then copies the reference tables into the target (`DATABASE_URL_UNPOOLED`). `--target` is required and only labels the target for the safety guards; the connection always comes from `DATABASE_URL_UNPOOLED`.
  - Prints a summary: rows copied per table, orphaned products skipped (with ids), `show_*` flags dropped, sequence values set, and the verification result.
- **`scripts/seed-dummy.ts --target <local|staging>`** (`npm run seed:dummy -- --target …`)
  - **Wipes and replaces** all app data: truncates every app table except `users` (so staff can still log in) and the Atlas revisions table, then fills them with synthetic data. **Refuses `--target production`**, and refuses to run without `--target`.
- **`seed-old --wipe-orders`**: needed to reload real reference data into a database that has (dummy) orders, e.g. staging after `seed-dummy`. Deletes all orders, order items and delivery dockets first. Rejected with `--target production`.
- **Trusted machine only (decided 2026-10-31).** Legacy data (client details and order history) never passes through GitHub Actions. There is **no** `migrate-reference-data.yml` workflow. An operator runs `snapshot.sh` and `seed-old` from a trusted machine with Docker, `pg_dump`/`pg_restore` and Node 24. This is a deliberate exception to "CI only", which still applies to schema migrations and deploys.
  - Credentials (`SOURCE_DATABASE_URL`, read-only; the target branch's `DATABASE_URL_UNPOOLED`) are supplied as environment variables for the session only, never written to a committed file. They are not stored as GitHub secrets.
  - Before loading staging or production, `seed-old --target staging|production` asks the operator to type the target name to confirm (skipped for `local`).
  - `seed-old` runs only after `deploy.yml` has migrated the target schema.
  - Snapshot files hold client details and order history: they stay on the trusted machine, under the gitignored `snapshots/` directory, and are deleted once cutover is verified (except the archive copy in cold storage).

## Design

### Source
The production DigitalOcean Postgres `fibom` database, `api` schema. Before cutover, a full `pg_dump` (schema and data) is kept in cold storage as the archive of order history; `snapshot.sh` produces exactly this kind of dump.

### `seed-old` steps
Inside one transaction on the target:

1. If the target has any orders, order items or delivery dockets: stop with an error, unless `--wipe-orders` was given (never allowed for production), in which case delete them. Then truncate the target reference tables, in dependency order (`products`, `clients`, `product_media`, `product_sizes`, `product_types`, `product_categories`).
2. Copy in FK order: `product_categories` → `product_types` → `product_sizes` → `product_media` → `products` → `clients`, mapping legacy column names to snake_case (O6).
3. **Keep primary keys:** insert with `OVERRIDING SYSTEM VALUE`. Old ids may be referenced on physical labels and by the notcher, and keeping them makes verification easy.
4. Reset each reference table's identity sequence to `max(id)+1`.
5. Apply the transforms below (during the copy).
6. Set the `orders` and `order_items` identity sequences to start above the **legacy** `max(id)` of `orders` and `orders_products` read from the snapshot (and above any existing target max), so new ids never reuse ids the notcher software has already seen.
7. Run the verification checks below; roll back if any fail.

The script is idempotent and safe to re-run up to cutover.

### Transforms
| Field | Transform |
|---|---|
| `products.efficiency` | `'xxxxxx'` placeholder → `NULL` |
| Text columns | Trim. Empty strings → `NULL` for optional fields. |
| `clients.labelusepartnumber`, `products.notcher`, `product_categories.show_*` | Cast to boolean (pgloader may have produced `smallint`) |
| Column names | Legacy → snake_case (O6) |
| Orphaned products | Products whose `category_id/type_id/size_id/media_id` point to missing rows: **skipped** (not inserted), each id logged |
| `product_categories.show_*` | Copy all flags; drop any flag for a column that no longer exists in the new order-items schema, and log it |

### Verification
- Row count of every migrated table matches the source (products: source minus skipped orphans).
- A checksum `md5(string_agg(row::text ORDER BY id))` over the compared columns matches, with the transforms applied the same way to both sides.
- Every product FK resolves.

### Not imported
`orders`, `orders_products`, `delivery_dockets`, `delivery_dockets_orders`, `invoices`, `roles`, `old_users`, `old_users_roles`, `api.users`, `basic_auth.users`. Order history lives only in the archived dump.

### `seed-dummy`
- Generates a deterministic (seeded) synthetic dataset for every table: reference data, orders, order items and delivery dockets, covering every order and docket status, every category attribute value, NULLs in every optional column, and both values of every stage status. It is built on the notcher contract-test fixture from spec 03.
- Wipe and replace: truncates every app table except `users` and the Atlas revisions table, in one transaction, then inserts the synthetic dataset. On staging this replaces the real clients and products until `seed-old --wipe-orders` is run again.
- Production guard: `--target` is required and must be `local` or `staging`; `production` is rejected before any connection is made.

### Cutover plan

**Notcher production host**
- The production notcher software calls **`https://fibatron.com`** (the apex domain, over HTTPS), i.e. `https://fibatron.com/vw-notcher-api?key=…`. Its setting stays untouched. Its source IP is not stable, so there is no Firewall IP allowlist; the feed is protected by its `key` only.
- `fibatron.com` serves nothing besides this app, so nothing else needs moving or rewriting.
- **Vercel default (decided 2026-10-31):** `www.fibatron.com` is the primary production domain and `fibatron.com` redirects to it with a `308`, for every path including the feed. The notcher's request to `https://fibatron.com/vw-notcher-api?key=…` therefore gets a `308` to `https://www.fibatron.com/vw-notcher-api?key=…` (path and query kept) and must follow it to get the data.
- **This must be proven before cutover** (AC-14, run (d)): on staging, a second domain is set up to redirect (`308`) to the staging domain the same way, the notcher is pointed at it, and it must read the feed successfully.
- **Fallback if the notcher does not follow the redirect:** remove the domain-level redirect and instead redirect `fibatron.com` → `www` with a host-based rule in `next.config` that excludes `/vw-notcher-api`, so the feed answers `200` directly on `fibatron.com`. Repeat run (d) against that setup before cutover.
- Change only the `fibatron.com` A record (Vercel's apex IP) and the `www` CNAME. Leave MX/TXT records (email, SPF/DKIM) alone.
- Lower the DNS TTL to 300s at least 48h before cutover. Add the domain in Vercel and wait for the certificate to be issued before switching DNS, so the software never sees a TLS error.
- The software already uses HTTPS, so no HTTP→HTTPS redirect check is needed.

**Steps**
1. **Build:** specs 01–03 complete on staging. Reference data loaded into `staging` by the operator (`snapshot.sh`, then `seed-old --target staging --wipe-orders`) from a recent snapshot.
2. **UAT:** staff check every screen against web3 (checklist built from specs 01–03), and the notcher machine is tested against the staging URL, including with an empty feed and with rows in a different order (AC-14).
3. **Agree a cutover point with the business.** Staff **close all open orders in the old system** before cutover; they are not re-entered.
4. **Cutover day:**
   - freeze client and product edits in the old system
   - run **Deploy → Production** (schema migrations), then, from the trusted machine, `snapshot.sh` and `seed-old --target production`
   - verify (checks above, plus a spot check of 10 clients and 10 products against the old UI)
   - create the staff users (`create-user`, then the Users screen)
   - point `fibatron.com` (A record) and `www.fibatron.com` (CNAME) at Vercel; the software's configured URL does **not** change
   - confirm one live request from the notcher software succeeds before going further
5. **Keep the old system read-only for 30 days** for historical order lookups.
6. **Decommission:** take a final `pg_dump` archive; shut down the droplets and the DO managed DB; rotate the legacy JWT secret if the old system ran on; delete `migrate-old-data/.env.tpl` with the package; archive the legacy `fib-om` repo (read-only) with a README pointing at `fib-om-v2`; delete the working snapshot files from the trusted machine.

## Acceptance criteria

Automated (integration tests against local Postgres containers playing source, scratch and target):

1. **AC-1** `snapshot.sh` against a fixture legacy DB writes `snapshots/<timestamp>.dump` containing schema and data of the `api` schema; the source DB is byte-for-byte unchanged afterwards (row counts and checksums); it exits non-zero with a message when `SOURCE_DATABASE_URL` is unset.
2. **AC-2** `snapshots/` is gitignored.
3. **AC-3** `seed-old` loads a snapshot and copies the six reference tables into the target with snake_case columns, preserving every primary key; afterwards each reference table's next identity value is `max(id)+1`.
4. **AC-4** It applies every transform: `'xxxxxx'` efficiency → NULL; text trimmed; empty optional strings → NULL; boolean columns are boolean; orphaned products are not inserted and each skipped id is logged; `show_*` flags with no matching column are dropped and logged.
5. **AC-5** After it runs, the next `orders` id is greater than the legacy max `orders.id`, and the next `order_items` id is greater than the legacy max `orders_products.id`.
6. **AC-6** Verification checks row counts (products minus skipped orphans), checksums and FK resolution; if a check fails (test: corrupt one row in the target mid-run), the whole transaction rolls back and the target is unchanged.
7. **AC-7** Running `seed-old` twice with the same snapshot leaves the target in the same state.
8. **AC-8** `seed-old` writes no rows to `orders`, `order_items`, `delivery_dockets` or `users`; against a target that has orders it exits non-zero and changes nothing unless `--wipe-orders` is given; with `--wipe-orders` it deletes the orders, order items and dockets and then loads; `--wipe-orders` with target production exits non-zero before connecting.
9. **AC-9** `seed-dummy --target local` fills every table with rows covering every order status, docket status, category attribute value, NULL optional columns and both values of every stage status; the notcher contract test (spec 03) passes against it; running it twice with the same seed produces identical data; any existing clients, products, orders and dockets are gone afterwards, while existing `users` rows are unchanged.
10. **AC-10** `seed-dummy --target production` and `seed-dummy` with no `--target` exit non-zero without opening a database connection.
11. **AC-11** `seed-old --target staging` and `--target production` refuse to proceed unless the operator types the target name at the prompt (non-interactive runs without confirmation exit non-zero before connecting); `seed-old` without `--target` exits non-zero.
12. **AC-12** No file under `.github/workflows/` runs `snapshot.sh`, `seed-old` or `seed-dummy`, and no workflow references `SOURCE_DATABASE_URL`.

Operational (recorded check, not CI):

13. **AC-13** Staging has been loaded from the trusted machine; the verification passed, and a side-by-side spot check of 10 clients and 10 products against the old UI matches.
14. **AC-14** UAT sign-off by staff against the checklist, and the notcher machine read the staging URL successfully in three recorded runs: (a) an empty feed `[]`, (b) a feed with several items, (c) the same items returned in a different order (via a temporary staging-only change or fixture), (d) the feed reached through a `308` domain redirect set up like production's `fibatron.com` → `www`, with the key in the query string. If (a) fails, cutover must enter at least one order before switching DNS; if (c) fails, `ORDER BY op.id` is confirmed as required; if (d) fails, production uses the fallback (feed path exempted from the redirect) and (d) is repeated against it.
15. **AC-15** Before cutover: the `fibatron.com` DNS TTL was lowered to 300s at least 48h ahead; `www.fibatron.com` (primary) and `fibatron.com` are added in Vercel with certificates issued; and against the production deployment before the DNS switch (e.g. `curl --resolve`), `https://fibatron.com/vw-notcher-api?key=<key>` behaves as proven in AC-14 run (d): either a `308` to the same path and query on `www` that then returns `200` with the feed, or (fallback) a direct `200`. MX/TXT records are unchanged after the switch.
16. **AC-16** On cutover day all open orders were closed in the old system first, production was loaded and verified, and one live request from the notcher software succeeded before any legacy component was decommissioned.
17. **AC-17** After 30 days: a final `pg_dump` archive exists in cold storage, the droplets and DO DB are shut down, the legacy repo is archived with a pointer README, and working snapshot files are deleted from the trusted machine.

## Out of scope

- Importing orders, order items, delivery dockets, invoices or users, now or later.
- Re-entering open orders in the new system.
- Copying legacy password hashes.
- Ongoing sync between the old and new systems.
- `seed-dummy` against production.
- Running any data script from CI.

## Open questions

1. ~~**OQ-1 Notcher host**~~ — resolved 2026-10-31: `https://fibatron.com`, which serves nothing besides this app; source IP not stable, so no allowlist. Vercel's default `fibatron.com` → `www` redirect is used, provided the notcher is proven to follow it (AC-14 run (d)); otherwise the feed path is exempted. The `key` value is handed over securely at deploy time, not in this doc.
2. ~~**OQ-2 `seed-dummy` on staging**~~ — resolved 2026-10-31: wipe and replace all app data (users kept). `seed-old --wipe-orders` (never on production) reloads real reference data afterwards.
3. ~~**OQ-3 Sequence start**~~ — resolved 2026-10-31: `seed-old` sets them from the legacy max ids in the snapshot (step 6).
4. ~~**OQ-4 Data through CI**~~ — resolved 2026-10-31: trusted machine only; no data workflow.
