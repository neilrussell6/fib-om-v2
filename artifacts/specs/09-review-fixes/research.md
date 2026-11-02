# Research — 09-review-fixes

- Date: 20261102-180021
- Feature: 09-review-fixes
- Phase: 1 (Spec)

## Goal

The author asked (2026-11-02) for a review of the codebase and app focusing on test coverage, code
quality and performance. Then: "create a spec to fix the bugs and implement all the improvements".
This feature fixes the three bugs the review found, closes the test-coverage gaps, removes the
duplication it flagged, and makes the four performance changes. No visible behaviour changes for
staff, except that some errors become proper messages and big lists load faster.

## Current state

Baseline on 2026-11-02 (commit `796ebd7`): 462 unit and integration tests pass, about 150 e2e
tests exist, lint and typecheck are clean and `npm run build` succeeds.

### Bugs

**B1 — the reference API returns a 500 for a non-numeric `id` or `clientId`.**
`app/api/reference/[resource]/route.ts:12` passes `id` and `clientId` from the query string
straight to `searchReferences` (`lib/db/reference-search.ts:21`, `:29`). That function casts them
with `$n::bigint`. Verified: `searchReferences("clients", { id: "abc" })` throws Postgres `22P02`
(`invalid input syntax for type bigint: "abc"`), and the route doesn't catch it, so the response
is an unhandled 500. `q` is fine, since it's only used as an ILIKE pattern.

**B2 — editing a delivery docket's To Client leaves orders from the old client attached.**
On an order save, `applyRules` checks that the chosen docket's `to_client_id` matches the order's
`client_id` (`lib/resources/actions.ts:64-71`). On a docket edit it only drops `from_client_id` and
returns (`actions.ts:52`). Changing `to_client_id` on a docket that already has orders therefore
leaves those orders on a docket addressed to a different client. No database constraint or
trigger enforces the rule: the migrations contain no triggers, and the only CHECK is
`users_email_lowercase`. Found by reading the code; not yet reproduced by a test.

**B3 — save and delete actions don't check the record id.**
`saveRecord` (`actions.ts:76`) and `deleteRecord` (`actions.ts:109`) accept any `id` and pass it
to `updateRecord`, `deleteRecordById` or `deleteUserChecked`. A non-numeric id reaches Postgres as
`22P02`, and `mapDbError` turns that into "please provide a valid integer" (`lib/db/errors.ts:40`).
That message is misleading: no field was wrong, the record doesn't exist. `recordOr404`
(`components/resource/pages.tsx:54`) and `saveOrderItemPanel` (`lib/order-items/panel-actions.ts:72`)
already guard their ids. `recordOr404` uses its own `/^\d+$/` regex rather than `isId`
(`lib/ids.ts`).

### Test coverage (v8 coverage, unit + integration run together)

| Area | Lines |
|---|---|
| `lib/resources` | 97% |
| `lib/order-items` | 100% |
| `lib/db` | 86% (`index.ts` 61%) |
| `lib/db/queries/users.ts` | 32% |
| `components/**`, `app/**` | ~0% (only e2e reaches them) |

- **The Neon driver path has no automated tests.** Locally, in CI and in e2e,
  `usesDirectConnection()` is true, so `lib/db/index.ts` always runs node-postgres (memory:
  `local-db-direct-not-proxy`). The Neon HTTP `sql`/`query` path (`index.ts:63`, `:72`) and the
  WebSocket `Pool` transactions (`index.ts:79-90`) only run on Vercel. `deploy.yml` builds and
  deploys staging and production but runs no check against the deployed app.
- **Pure helpers in components have no unit tests:**
  - `queryWithout`, `listParamsFromUrl`, `newHref` and `first` in `components/resource/pages.tsx:25-50`
  - `components/resource/format.ts`
  - `savedToast` and `itemHref` in `components/resource/panel/saved-toast.ts` (the "Moved to …" decision)
  - `components/resource/panel/use-panel-errors.ts`
  - `components/app-shell/sidebar-state.ts`

  The pattern for testing client modules already exists: `tests/unit/panel-history.test.ts` covers
  `history.ts` at 85%, and `tests/unit/nav-items.test.tsx` renders a component under
  `// @vitest-environment jsdom`.
- **The reference route has no tests.** Nothing covers `app/api/reference/[resource]/route.ts` at
  unit or integration level: not its 401 or 404 responses, and not the B1 inputs.
- **The Auth.js callbacks in `lib/auth.ts:21-42` (jwt and session) are only exercised by e2e.** The
  decision logic inside them is unit tested (`session-version.test.ts`).
- **Coverage isn't measured in CI.** `@vitest/coverage-v8` is installed, but `vitest.config.mts` has
  no `coverage` block and `ci.yml` never runs coverage. Running coverage with a broad `include`
  that matches `scripts/db.sh` fails with a PARSE_ERROR, so the include list must be limited to
  `.ts` and `.tsx`.

### Code quality

- **`OrderItemsListPage` (`components/order-items/order-items-page.tsx:20-61`) repeats most of
  `ResourceListPage` (`components/resource/pages.tsx:64-107`).** Both do the same URL parsing,
  status validation, `Promise.all` of list, counts and record, `baseQuery`/`dialogQuery`, the
  `new` dialog and the not-found toast. The differences:
  - the panel loader (`getOrderItemPanel` vs `getRecord`)
  - the table (`OrderItemsTable` vs `ResourceTable`)
  - the panel and create components
  - the wrapper's `order-items` class and `data-panel-open` attribute
  - a hard-coded `"Order item"` label
- **The loop that turns zod issues into field errors appears twice:** `lib/resources/actions.ts:84-86`
  and `lib/order-items/panel-actions.ts:75-78`.
- **`deleteUserChecked` declares its own copy of the `Queryable` type inline**
  (`lib/db/queries/users.ts:51`) instead of importing it from `lib/db`.
- **`lib/order-items/stages.ts:20` re-exports `isId`,** and `panel-actions.ts` / `panel-queries.ts`
  import it from there.

### Performance

**P1 — list queries do a full join plus a window count.** `listRecords`
(`lib/db/list-query.ts:136-145`) runs:

```sql
SELECT <select>, count(*) OVER () AS __total FROM <source> WHERE … ORDER BY … LIMIT … OFFSET …
```

`order_items_v` joins 8 tables (`db/migrations/20261031210400_display_views.sql`), and its default
sort is a column of `orders`. Measured on local Postgres 17 by adding 20k orders and 200k items
inside a rolled-back transaction, page 1 of 25, times from `EXPLAIN ANALYZE`, three runs each:

| Variant | Time |
|---|---|
| Current: `*` + `count(*) OVER ()`, All tab | 793–990 ms |
| Current, New tab (67k matching rows) | ~400 ms |
| `*`, no window | 409–471 ms |
| `id` only, no window | 181–190 ms |
| Separate `count(*)` on the view | 158–164 ms |
| Current `countByStatus` (view) | ~140 ms |
| Status counts from `order_items JOIN orders` only | ~103 ms |
| Orders list today (20k orders) | ~38 ms |

The window function is the largest cost, because it materialises every matching wide row. The
second largest is carrying `*` through the sort. Picking the page's ids with a narrow query, then
loading those ≤100 rows by id, alongside a separate count, takes roughly 200 ms of wall time
instead of ~800 ms. A CTE that joined back to the view in the same statement was slower (~500 ms),
because the planner hash-joined the whole view. The rows have to be loaded by `id = ANY($1)` in a
second query. Today the local data is 360 order items and 73 orders, so none of this shows yet.

**P2 — auth costs several sequential database queries per request.**
- The proxy (`proxy.ts`) calls `auth()`, and the jwt callback runs `getSessionVersion` on every
  call (`lib/auth.ts:33`).
- In the page render, `Content` in `app/(app)/layout.tsx:7-10` awaits `requireSession()`, which
  runs the jwt callback again (a new request context), before it renders `children`. The page's
  data queries only start after that.
- `SidebarUser` (`components/app-shell/sidebar.tsx:17`) then runs `getUserDisplay`, a separate
  query for the name.

`partialPrefetching: true` (`next.config.ts`) means link prefetches also pass through the proxy,
and each one costs a database query.

**P3 — reference comboboxes fetch labels the page already has.** `ReferenceCombobox`
(`components/resource/reference-combobox.tsx:57-66`) has only `value` (an id). On mount it fetches
`/api/reference/<res>?id=<value>` for every field or filter that has a value, and each of those
requests runs `auth()` and therefore a session-version query. Call sites:
- `resource-form.tsx:116` (create/edit forms and `RecordPanel`)
- `filter-bar.tsx:78`
- `order-item-panel.tsx:193` and `:216`

The record rows already carry display columns (`FieldDef.display`: `client_name`, `product_name`,
`type_name`, …). Those values don't always match the combobox's label expression, though (see
Constraints).

**P4 — client JavaScript.** The largest shared chunk is 129 KB gzipped (403 KB raw), mostly zod,
cmdk and TanStack Table. That's acceptable for an internal staff app, and the review recommended
no action.

## Prior art

- `isId` (`lib/ids.ts`) is the existing id guard, already used by `panel-actions.ts`,
  `panel-queries.ts` and `pages.tsx`.
- `listRecords` already has a validation precedent: invalid filter values are dropped, not sent to
  Postgres (review 02 finding 1, `list-query.ts:44-68`).
- `saveRecord`'s `RuleError` (`actions.ts:32`) is the existing way to return a rule failure as a
  friendly error.
- `tests/helpers/throwaway-db.ts` creates and drops a temporary database. It could host a
  large-data performance test without touching the shared test database.
- `checkSessionVersion` (`lib/auth/session-version.ts`) is a pure function with dependency
  injection, which shows how to test the auth callbacks without Auth.js.
- Memory `designs-are-visual-reference` (not relevant here); memory `review-one-at-a-time` applies
  at the manual gates.

## Constraints & risks

- **Combobox label formats differ from the view display columns.** For example:
  - orders: combobox `order_number || ' · ' || client_name` vs display `order_number`
  - product types: `code || ' · ' || name` vs `type_name`
  - delivery dockets: `docket_number`

  Seeding the combobox with the display column would show a different label until the user opens
  it. Either the server must resolve labels with the same expression as `QUERIES[*].options.label`,
  or the views must expose it.
- **P1 must keep the current behaviour:**
  - stable order (`NULLS LAST, id`)
  - the allowlisted filters, sorts and status tabs
  - `total` as the count under the filters and the status tab
  - a page past the end
  - integration tests that assert the existing `listRecords` contract (`tests/integration/list-query.test.ts`,
    `order-items-list.test.ts`, `list-panels.test.ts`)

  Two queries instead of one means `total` and the rows can disagree under concurrent writes.
  That's acceptable for a staff list but is a small change in semantics.
- **P2 is security-sensitive.** The session-version check is how sign-out everywhere and user
  deletion take effect (spec 01). Fewer queries must not mean a revoked session gets through. The
  proxy and the render are separate requests, so React `cache` can't share one result between
  them. Any change to the `Content` gate in the layout must still render nothing without a session
  (`requireSession` stays in every Server Action and page path).
- **A Neon-path test needs credentials.** A CI job against a Neon branch, or a post-deploy smoke
  test, needs secrets that only `deploy.yml`'s environments have (`staging`/`production`).
  Production must never receive test writes.
- **B2's fix needs a choice of rule.** Either block changing the To Client while the docket has
  orders, or allow it and detach or move the orders. That's a product decision (open question 1).
- **Prefer Next.js APIs as installed.** AGENTS.md: read `node_modules/next/dist/docs/` before
  touching proxy, layout or caching code (Next 16.4 with `cacheComponents` and
  `partialPrefetching`).

## Open questions

1. **B2:** when a docket has orders and someone changes its To Client, should the save be refused
   with a message (e.g. "docket has orders for another client")? Or should the orders be detached
   from it?
2. **P1:** is a target like "Order Items page 1 ≤ 250 ms of database time at 200k items on local
   Postgres" acceptable, and should a large-data performance test run in CI or stay a local
   script? Roughly how many order items and orders does the v1 production data hold?
3. **Neon-path coverage:** a post-deploy smoke test on staging (read-only: sign in, load a list,
   load the reference API), or an integration run against a Neon branch in CI? The second needs a
   Neon API key in CI.
4. **Coverage in CI:** report only, or enforce thresholds? If thresholds, at what levels: the
   current `lib/` figures as a floor?
5. **P2:** is it acceptable for the sidebar name to come from the same query as the session-version
   check? That means `getSessionVersion` also returns `name`/`email`, held in request state rather
   than in the JWT.
