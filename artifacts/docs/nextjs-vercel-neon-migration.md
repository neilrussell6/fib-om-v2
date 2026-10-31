# FIB OM migration to Next.js + Vercel + Neon: overview

- Author: Neil Russell (original draft `migration-spec-nextjs-vercel-neon.md`, 2026-10-31)
- Last revised: 2026-10-31

This is the shared background for the migration. The work itself is specified in four feature specs, built in this order:

| # | Feature spec | Contents |
|---|---|---|
| 1 | [`01-users-auth`](../specs/01-users-auth/spec.md) | Scaffold, CI/deploy, theme, app shell, login, sessions, Dashboard, `create-user` script |
| 2 | [`02-basic-crud`](../specs/02-basic-crud/spec.md) | Full schema, shared list/form/detail building blocks, plain CRUD for every resource including Users, error messages, print styles |
| 3 | [`03-custom-behaviour`](../specs/03-custom-behaviour/spec.md) | Everything that deviates from basic CRUD: order items panel, category-driven columns, stage toggles, derived columns, docket print layout and order management, the notcher feed |
| 4 | [`04-data-scripts`](../specs/04-data-scripts/spec.md) | `snapshot.sh`, `seed-old`, `seed-dummy` (run from a trusted machine), and cutover |

Each spec refers to sections here as **O1–O9**. Every **(improvement)** in the specs was approved by the product owner on 2026-10-31.

**Repos.** New app: `fib-om-v2` (this repo). Legacy app: `../fib-om`. Every `packages/…`, `bin/…` or `sql/…` path refers to the legacy repo.

---

## O1. Summary

FIB OM is an internal order-management tool for Fibatron, a filter manufacturer. Staff use it to manage clients and the product catalogue, take orders, track production of each order item through its stages (cut, sow, frame, media, wire, assemble, package), and print delivery dockets.

**Production today is a PHP app (Zend Framework 2 + Doctrine, AngularJS front end) on MySQL** (`legacy-prod/`, gitignored because it contains credentials). A first rewrite, **v1** (`../fib-om`: web3 on react-admin, PostgREST, DigitalOcean Postgres, an Express notcher API), never went live; it runs as five separate pieces on DigitalOcean. **v1 is the reference for every feature; production is the reference only for the notcher feed (`/vw-notcher-api`) and is the source of the real data.** The migration replaces all of them with one Next.js App Router app on Vercel, backed by Neon Postgres, with shadcn/ui for the interface. The reference data (clients and the product catalogue) is copied over once. Orders, order items, delivery dockets and invoices start empty in the new system.

## O2. v1 (`../fib-om`): the feature reference

| Component | Location | Role |
|---|---|---|
| Web UI | `packages/web3` (CRA, react-admin 4, MUI 5) | Admin UI. This is the live UI (`web:start` points at it). `web` and `web2` are older versions, ignored here. Every screen is built by the generic builder `src/generic/react-admin/utils.jsx` from the configs in `src/domain/react-admin/resources/*`, using the components in `src/generic/react-admin/components/*`. **`src/pages/App/Order*.jsx`, `OrderItem*.jsx` and `User*.jsx` are dead code**: imported but never rendered, so they are not a reference. |
| API | `packages/delivery` → PostgREST container | Auto-generated REST API over the `api` schema. Logs in through `rpc/login`, which returns a JWT made by `pgjwt`. |
| DB | DigitalOcean managed Postgres (`fibom` db, `api` schema) | Tables, plus `*_rel` views that denormalise joins for the UI |
| Notcher API | `packages/notcher-api` (Express + pg) | Serves `GET /` (exposed to the external software as `/vw-notcher-api?key=…`): one nested JSON payload of every order item, for the VW notcher machine |
| Web server | `packages/nginx` | Serves the CRA build and proxies `/api/` → PostgREST and `/vw-notcher-api` → notcher API |
| Legacy import | `packages/migrate-old-data` | One-off MySQL → Postgres import (pgloader). Not needed again. |

### O2.1 Data model (inferred from UI resources and notcher query)

The DDL (`sql/migrations/schema.sql`, `views.sql`, `data-ddl-updates.sql`) is **not in the repo**. v1's schema and data are available outside this repo in `../fib-om-v2-reference/migrations/`, the final v1 reference (no newer v1 dump is coming): `data.sql` (a full `pg_dump`, schema and data, Postgres 12.7), then `data-ddl-updates.sql`, `data-dml-updates.sql` and `views.sql`, applied in that order. They contain real client data and are never copied into this repo. They are the authority for v1's columns, the view formulas (`views.sql`) and the derived-column fixture. Separately, the author will provide a **production MySQL dump**; it is the authority for the import mapping (spec 04) and the notcher capture check (spec 03). The tables below were reconstructed from the code and are checked against these files.

**In scope for data migration**

| Table | Columns used by the app |
|---|---|
| `api.clients` | `id`, `name`, `fullname`, `phone`, `addressshipping`, `addressbilling`, `abn`, `acn`, `fax`, `landline`, `labelreordertext`, `labelname`, `labelsubname`, `labeladdressline1`, `labeladdressline2`, `labelusepartnumber` (bool) |
| `api.products` | `id`, `name`, `category_id`, `type_id`, `size_id`, `media_id`, `notcher` (bool), `efficiency` (text; `'xxxxxx'` was written into it as a placeholder during the old pgloader import) |
| `api.product_categories` | `id`, `name`, ~40 `show_*` booleans that decide which order-item columns appear when the list is filtered to that category |
| `api.product_types` | `id`, `name`, `code`, `millimetres_per_pleat` |
| `api.product_sizes` | `id`, `name` (+ other columns returned by `to_json(ps.*)` in the notcher query; confirm from the DDL) |
| `api.product_media` | `id`, `name`, `code`, `pleat_spacing` (numeric) |

**Out of scope for data migration (new schema, starts empty)**

| Table | Notes |
|---|---|
| `api.orders` | `client_id`, `order_number`, `date`, `due_date`, `status` (int), `deliverydocket_id`, `invoice_id` |
| `api.orders_products` (order items) | `order_id`, `product_id`, `part_number`, `quantity`, `height`, `width`, `depth`, `comment`, category-specific attributes, 7 stage-status booleans, `cut_count`, `sow_count` |
| `api.delivery_dockets` | `fromclient_id`, `toclient_id`, `docket_number`, `date`, `status` |
| `api.delivery_dockets_orders` | join table from the legacy import. web3 links orders through `orders.deliverydocket_id`, so this table is dropped. |
| `api.invoices` | Not used by web3. Dropped. |
| `api.roles`, `api.old_users`, `api.old_users_roles` | Legacy MySQL users. Dropped. |
| `api.users` | The live app logins: `rpc/login` resolves to `api.login`, which checks `api.users`. Not migrated; accounts are recreated. |
| `basic_auth.users` | Loaded by the init scripts, but not used by the login. Dropped. |

**Derived values.** Four legacy read views feed the UI (writes go to the base tables):

| View | Used for | Derived / joined columns |
|---|---|---|
| `orders_rel` | orders list and detail, orders on a docket | `client_name`, `order_items_packed` |
| `orders_products_rel` | order-items list, detail, and the panel on an order | `client_id`, `client_name`, `order_number`, `order_date`, `order_due_date`, `order_status`, `product_category_id/name`, `product_name`, `product_type_code/name`, `product_size_name`, `product_media_code`, `calculated_id`, `pleats`, `wire_metres`, `wire_height` |
| `products_rel` | products list and detail | `category_name`, `type_name`, `type_code`, `size_name`, `media_name` |
| `delivery_dockets_rel` | dockets list and detail | `fromclient_name`, `toclient_name`, and `docket_number` |

The formulas are in v1's `views.sql` (`../fib-om-v2-reference/migrations/`).

## O3. Goals, non-goals and decisions

**Goals**
- Keep every feature web3 has today. This is a like-for-like rebuild **of behaviour**, not of implementation. The new build uses current conventions: Server Components, Server Actions, typed SQL, accessible shadcn components, and real database constraints. Where web3's behaviour is a workaround or a bug, the specs say what changes, and each change is marked **(improvement)**.
- One deployable: Next.js on Vercel. No Docker, droplets, nginx or PostgREST.
- Neon Postgres, with typed schema and migrations kept in the repo.
- Clients and product reference data copied over with the same IDs.
- Remove the secrets hardcoded in the codebase (O8).
- **Notcher feed unchanged:** same URL (scheme, host, port, path) and the same response the production PHP app gives today (filter, keys, format, headers), with removed fields emitted empty. The external software that reads it cannot be updated.

**Non-goals**
- Migrating orders, order items, delivery dockets or invoices. Old orders are never imported into the new app; the archived dump plus 30 days of the old system in read-only mode is enough.
- New business features, roles or permissions beyond "logged-in staff can do everything" (today's model).
- Keeping the PostgREST URL shape. (The notcher feed is the exception and must stay **exactly** as it is.)

**Data rules.** The product owner approved every **(improvement)** except the **new data rules**, which the client did not approve:
- no unique order number (per client or otherwise)
- no new `CHECK` constraints on quantities or dimensions

Constraints that already exist in web3's database stay: foreign keys that block deletes, and `NOT NULL` on required columns. Every order has a client, so `orders.client_id` is `NOT NULL`.

### O3.1 Decision log (2026-10-31)

| Topic | Decision |
|---|---|
| Reference systems | v1 (`../fib-om`) for every feature; production PHP + MySQL (`legacy-prod/`) only for `/vw-notcher-api` and as the data source |
| Notcher feed | Matches the production PHP output (filter, key order, `json_encode` format, headers); values come from the new schema, transformed in TypeScript; removed fields emitted empty (`null`) |
| Data source | Production MySQL (`mysqldump`), with v1's reference-data changes (category renames, added categories, `show_*` flags) applied on import |
| Open orders at cutover | Staff close them in the old system before cutover; they are not re-entered |
| Docket number / from-client | `docket_number` is the id zero-padded to 6 digits; `fromclient_id` comes from the `FROM_CLIENT_ID` env var (value set per environment at deploy time) |
| Users | Recreated, not migrated (no password hashes copied). A Users admin screen is in scope |
| Historical orders | Archived dump + 30 days of the old system read-only; no later import |
| Column names | Renamed to snake_case in the new schema; the notcher feed emits the legacy names via an explicit column list |
| Orphaned products | Skipped by the data import and logged |
| Branch | `main` everywhere; `STRATEGY.md` commits directly to `main` |
| Schema source | v1: `../fib-om-v2-reference/migrations/` (final); production: a MySQL dump the author will provide |
| Legacy data snapshot | A bash script connects to the legacy DB and takes a data dump |
| `seed-dummy` | Allowed locally and on staging; refuses production |
| Test tools | Vitest (unit, integration against a real Postgres), Playwright (end-to-end) |
| Sessions | JWT cookie, 8-hour rolling |
| Dashboard | A Dashboard page at `/`, empty for now. Sidebar: Dashboard first, Users last |
| Structure | Four feature specs, delivered in order (table above) |
| Notcher host | `https://fibatron.com`, which serves nothing besides this app |
| `www` | Vercel default: `fibatron.com` → `www.fibatron.com` (`308`), including the feed, if the notcher is proven on staging to follow it; otherwise the feed path is exempted from the redirect |
| Notcher source IP | Not stable; no Firewall IP allowlist |
| Data scripts | Run from a trusted machine only; legacy data never passes through CI |
| Calculated columns | Plain Postgres views |
| Login rate limit | 10 sign-in attempts/min per IP, enforced in the app (no Firewall rule) |
| Vercel plan | Hobby |
| Staging domain | `staging.fibatron.com` (repo variable `STAGING_DOMAIN`) |
| Postgres | 17 |
| Passwords | Minimum 12 characters, no other rules |

## O4. Target architecture

```
Browser ──► Vercel (Next.js App Router)
              ├─ Server Components: read pages (lists, detail, print)
              ├─ Server Actions: create / update / delete, stage toggles
              ├─ Route Handler: GET /vw-notcher-api?key=… (machine feed)
              └─ proxy.ts: auth gate on every route except /login, assets and the feed
                     │
                     ▼
              Neon Postgres (pooled connection, @neondatabase/serverless driver)
```

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript, Turbopack | Current Vercel default |
| UI | shadcn/ui (Tailwind v4) + TanStack Table for data tables | Replaces react-admin/MUI. shadcn has table, form, combobox, date-picker and dialog components. |
| Forms | react-hook-form + zod (shared schema for client and server validation) | Replaces react-admin `required()` validators |
| DB | Neon Postgres: branches `production` and `staging` | Managed and serverless; branching gives a staging copy |
| Data access | **Plain SQL, no ORM.** `@neondatabase/serverless`: the `neon()` tagged-template client for one-off queries, and `Pool` for transactions | Queries stay readable and portable, `json_build_object`/views are used directly, and the notcher SQL ports verbatim |
| Migrations | [Atlas](https://atlasgo.io) versioned migrations: SQL files written by hand plus `atlas.sum`, applied **only by CI** (O7) | Plain SQL, integrity-checked, with linting for destructive changes. Same setup as `sa-political-compass` |
| Row types | TypeScript types written by hand in `lib/db/types.ts`, plus zod schemas for anything entering the system (forms, query params) | Types stay in step with the SQL; no codegen step needed |
| Auth | Auth.js (NextAuth v5) Credentials provider with bcrypt, JWT cookie session (8-hour rolling) | Matches today's email/password model. No third-party sign-up needed. JWT avoids a sessions table. |
| URL state | `nuqs` for list filters, sort and pagination in the query string | Filters can be bookmarked or shared, as react-admin allows today |
| Tests | Vitest (unit and integration against a real Postgres), Playwright (end-to-end) | `.gitignore` already expects Playwright output |
| Hosting / CI | Vercel, deployed **only by GitHub Actions** (`vercel build` + `vercel deploy --prebuilt`): staging on every push to `main`, production on manual dispatch (O7) | Migrations and deploys run in one controlled pipeline, in order |

### O4.1 Repo layout

The new app is a single Next.js project at the root of the `fib-om-v2` repo. There's no monorepo. The spec that introduces each path is in brackets.

```
fib-om-v2/
  app/
    (auth)/login/page.tsx            [01]
    (app)/layout.tsx                 [01] sidebar + top bar, auth required
    (app)/page.tsx                   [01] Dashboard
    (app)/users/…                    [02]
    (app)/orders/…                   [02] list, [id], [id]/edit, new
    (app)/order-items/…              [02] list, [id], [id]/edit, new
    (app)/delivery-dockets/…         [02] list, [id], [id]/edit, new
    (app)/clients/…                  [02]
    (app)/products/…                 [02]
    (app)/product-categories/…       [02]
    (app)/product-types/…            [02]
    (app)/product-sizes/…            [02]
    (app)/product-media/…            [02]
    vw-notcher-api/route.ts          [03]
  components/ui/                     [01] shadcn generated
  components/data-table/             [02] generic table, filter bar, pagination
  lib/db/index.ts                    [01] sql (neon tagged template) + pool + tx() helper
  lib/db/types.ts                    [01] row types written by hand
  lib/db/queries/*.ts                [01/02] one file per resource
  lib/db/errors.ts                   [02] SQLSTATE → message mapping
  lib/db/sql/notcher-feed.sql        [03] legacy notcher query, ported
  lib/auth.ts                        [01]
  db/migrations/*.sql                [01+] Atlas versioned migrations, written by hand
  db/migrations/atlas.sum            [01+]
  scripts/db.sh                      [01] Atlas wrapper (migrate/status/validate/new/hash)
  scripts/create-user.ts             [01]
  scripts/snapshot.sh                [04] dump the legacy DB
  scripts/seed-old.ts                [04] load reference data from a snapshot
  scripts/seed-dummy.ts              [04] synthetic data
  tests/notcher-contract.test.ts     [03]
  proxy.ts                           [01]
  atlas.hcl                          [01]
  .vercelignore                      [01]
  .env.tpl                           [01]
  .github/workflows/ci.yml           [01]
  .github/workflows/deploy.yml       [01]
```

## O5. SQL conventions

- **Always parameterise.** Use the ``sql`… ${value} …` `` tagged template; values become `$n` parameters. Never build SQL by string concatenation.
- **Dynamic SQL from an allowlist only.** List filters and sorting need dynamic `WHERE`/`ORDER BY`. Map each allowed filter key to a fixed SQL fragment and parameter, and each sort key to a fixed column, in `lib/db/queries/<resource>.ts`. Reject unknown keys. Never put user input in identifiers.
- **Pagination:** `LIMIT $n OFFSET $m`, plus `count(*) OVER ()` for the total in the same query.
- **Joins for display** (e.g. product → category/type/size/media names) go in SQL views (`products_v`, `order_items_v`, `orders_v`, `delivery_dockets_v`), which replace the legacy `*_rel` views. Writes go to the base tables.
- **Transactions:** use a `tx(async (client) => …)` helper on `Pool`, e.g. for creating an order together with its items, or the data import.
- **Results:** queries return typed rows (`sql<Client[]>`); validate input with zod before it reaches SQL.
- **Tests:** query modules are tested against a real Postgres (a Neon branch, or a local `postgres` container with migrations applied), not mocks.

## O6. Schema conventions

- Columns are snake_case (`addressshipping` → `address_shipping`, `labelname` → `label_name`, …).
- Foreign keys use `ON DELETE RESTRICT`; required fields are `NOT NULL`; no extra `CHECK` or unique constraints beyond those needed to store enums.
- Status enums: order `new | complete | archived` (legacy ints `2/4/5`, used only by the notcher feed); docket `current | archived`.
- Migrations follow expand/contract (O7): every migration stays compatible with the code currently live.

## O7. Environments, migrations and deployment (CI only)

Schema migrations and Vercel deployments **only ever run from GitHub Actions**. Nobody runs `vercel deploy` or migrates staging/production from a laptop, and Vercel's Git auto-deploys are **off**. The setup follows `/home/neil/conjure-dev-PRJ/sa-political-compass` (`.github/workflows/deploy.yml`, `atlas.hcl`, `scripts/db.sh`).

### O7.1 Environments
| Env | Trigger | Vercel target | Neon branch | URL |
|---|---|---|---|---|
| Local | `npm run dev` | n/a | local Postgres container (or a personal Neon branch) | `http://localhost:3000` |
| Staging | every push to `main` | preview, aliased to a fixed staging domain | `staging` | `https://staging.fibatron.com` |
| Production | manual **Actions → Deploy → Run workflow** (`workflow_dispatch`) | production (`--prod`) | `production` | `https://www.fibatron.com` (primary); `fibatron.com` redirects to it with Vercel's default `308`. The notcher calls `https://fibatron.com/vw-notcher-api` and must be proven to follow that redirect (spec 04) |

There's a fixed `staging` Neon branch rather than one per preview, because CI applies migrations to a known database before each deploy.

### O7.2 Migrations: Atlas, versioned SQL
- Plain SQL files written by hand in `db/migrations/` (`<timestamp>_<name>.sql`), plus `db/migrations/atlas.sum`. There's no ORM and no desired-state schema.
- `atlas.hcl`:
  ```hcl
  env "local" {
    url = getenv("DATABASE_URL")
    dev = "docker://postgres/17/dev"
    migration {
      dir = "file://db/migrations"
    }
  }
  ```
  Match the `dev` image's major version to the Neon project's Postgres version.
- `scripts/db.sh` wraps Atlas, and `package.json` scripts call it: `db:migrate` (`atlas migrate apply`), `db:status`, `db:validate` (`atlas migrate validate`, needs no DB), `db:new <name>` (`atlas migrate new`), `db:hash` (`atlas migrate hash`).
- **Neon quirks** (both needed): always pass `--revisions-schema public` (Neon ignores `search_path`, ariga/atlas#2509); migrate over the **unpooled** connection string (SCRAM through Neon's PgBouncer pooler fails intermittently). The app's runtime keeps using the pooled `DATABASE_URL`.
- Locally, `db:migrate` runs against `DATABASE_URL` from `.env`. Editing a migration once it has been applied to staging is not allowed; add a new one instead.

### O7.3 CI workflows
- **`ci.yml`** runs on pushes to `main` (and on pull requests, if any are opened): `npm ci`, typecheck, lint, unit tests; `ariga/setup-atlas@v0`, `atlas migrate validate`, `atlas migrate lint --latest 1`; then integration tests against a `postgres` service container after `atlas migrate apply`.
- **`deploy.yml`**:
  - **`deploy-preview`** on `push` to `main`, GitHub environment `staging`: (1) fail if no production deployment exists yet (Vercel auto-promotes a new project's first deployment); (2) checkout, set the git author for Vercel, `setup-node`, `npm i -g vercel`; (3) `vercel pull --environment=preview`; (4) `ariga/setup-atlas@v0`, then `ariga/atlas-action/migrate/apply@v1` with `dir: file://db/migrations`, `url: ${{ secrets.DATABASE_URL_UNPOOLED }}`, `revisions-schema: public`; (5) `vercel build`, `vercel deploy --prebuilt`; (6) alias to the staging domain through the Vercel API (`vercel alias` fails with team-scoped tokens).
  - **`deploy-production`** on `workflow_dispatch`, environment `production`: the same with `--environment=production`, migrations against the production branch, `vercel build --prod`, `vercel deploy --prebuilt --prod`.
  - Migrations run *before* build/deploy and stop the job if they fail. The very first deploy must be a manual production run.
- **Data scripts** (`snapshot.sh`, `seed-old`, `seed-dummy`) never run in CI; an operator runs them from a trusted machine (spec 04).

### O7.4 Configuration
- **GitHub:** repo variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_EMAIL`, `STAGING_DOMAIN`; repo secret `VERCEL_TOKEN`; environments `staging` and `production`, each with secret `DATABASE_URL_UNPOOLED`. `SOURCE_DATABASE_URL` is **not** stored in GitHub; the operator supplies it on the trusted machine (spec 04).
- **Vercel:** one project (Next.js, Node 24), Git auto-deploys off; production domain on Production, staging domain assigned by CI; env vars per environment (Production and Preview): `DATABASE_URL` (pooled), `AUTH_SECRET` (different in each), `NOTCHER_API_KEY`, `FROM_CLIENT_ID`; secrets marked Sensitive (CI reads `DATABASE_URL_UNPOOLED` from GitHub, not Vercel). Plan: Hobby; no Firewall rules are relied on (sign-in rate limiting is in the app).
- **Neon:** one project with branches `production` and `staging`. Create staging from production after the reference data is loaded. If Neon was added through the Vercel Marketplace, turn off its per-preview branch creation.
- **Local:** `.env.tpl` → `.env`, with `DATABASE_URL` pointing at a local Postgres container. Install Atlas with `curl -sSf https://atlasgo.sh | sh`. `.vercelignore` excludes tooling directories (`.claude`, `.cursor`, test output), which break `vercel deploy --prebuilt`.

## O8. Security

- `packages/notcher-api/src/index.js` has a **hardcoded DigitalOcean DB connection string with a password**, committed to git history. **Rotate that password now**, whatever happens with the migration timeline (tracked in spec 01).
- `packages/delivery/sql/api-basic-auth-init.sql` hardcodes the JWT signing secret. This goes away with PostgREST, but rotate it if the old system keeps running for a while.
- `migrate-old-data/.env.tpl` has sample credentials. Delete it with the package.
- New app: every secret lives in Vercel env vars or GitHub secrets, and every mutation checks the session on the server. The notcher endpoint is protected only by its `key` query parameter, which must not be logged.

## O9. Open questions that span specs

None currently. Each spec lists its own.
