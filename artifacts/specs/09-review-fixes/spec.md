# Spec — 09-review-fixes

- Date: 20261102-180021
- Feature: 09-review-fixes
- Phase: 1 (Spec)

> Research: [`research.md`](research.md), which has the measurements and file/line references.
> Source: the 2026-11-02 codebase review (test coverage, code quality, performance). The author's
> brief: "create a spec to fix the bugs and implement all the improvements". Depends on specs
> 01, 02, 06, 07 and 08. Touches no designs.

## Summary

This feature fixes the review's three bugs, closes its test-coverage gaps, removes the
duplication it flagged, and makes three performance changes.

**Bugs**
- The reference API returns a 400, not a 500, for a malformed id.
- A delivery docket's To Client can't be changed away from the client of the orders already on
  it.
- The save and delete actions say "not found" for a malformed id, without querying the database.

**Performance**
- List pages load a page of ids first, then just those rows, and get the total from a separate
  count. That removes the `count(*) OVER ()` that made Order Items ~800 ms at 200k rows.
- The sidebar name comes from the session check's own query, so there's no second `users` query
  per page.
- Reference comboboxes are given their label by the server, so they don't fetch it on mount.

**Tests and CI**
- New unit and integration tests for the untested helpers, the reference route and the Auth.js
  callbacks.
- CI runs coverage with thresholds and uploads the report. A missed threshold is reported, but
  it doesn't fail CI.
- The test pyramid is rebalanced:
  - e2e drops from 201 to about 143 tests. Behaviour already checked at a lower level, and
    loops that repeat a shared component for every resource, move down or go.
  - CLI guard cases move from spawned processes to unit tests.
  - Coverage stays similar. Every removed e2e test maps to the test that now covers it.

## User-visible behaviour

Staff see the same screens. What changes:

1. **Docket To Client.** Editing a delivery docket that has orders, and choosing a To Client
   other than those orders' client, fails with the toast
   `Could not edit Delivery Docket: delivery docket has orders for another client`. Nothing is
   saved. A docket without orders, or one whose orders all belong to the new To Client, saves as
   before. This applies on the edit page and in the edit panel.
2. **Malformed ids.**
   - `/edit` pages and panels already 404 or show the not-found toast for these.
   - A Server Action called with a non-numeric id (only possible by hand-crafting a request) now
     returns `<Singular> not found` instead of "please provide a valid integer".
3. **Reference labels show at once.** On edit forms, edit panels and filtered lists, a reference
   field's chosen value shows its label in the first render. Today it shows "Select…" until a
   browser request returns. The label text is exactly what the combobox's options show for that
   record (e.g. an order as `ORD-123 · Acme`).
4. **Pagination past the end** (e.g. `?page=999` with 312 matching rows) still shows
   `No results` in the table. The footer now reads `Showing 0–0 of 312`, and Prev stays enabled,
   so staff can page back. Today the footer says `No results` because the total comes back as 0.
   `Pagination` shows `0–0` whenever `(page - 1) * pageSize >= total` and `total > 0`.
5. **Big lists are faster.** Order Items page 1 at 100k items, about 3.5× v1 production today,
   takes ≤ 300 ms of query time locally (AC-14). At 200k items the current query took ~800 ms. Nothing else visibly changes.

## Design

### B1 — reference API input

- `app/api/reference/[resource]/route.ts` checks `id` and `clientId` with `isId`
  (`lib/ids.ts`) when they're present and non-empty.
- If either fails, the route returns `400 { error: "invalid id" }` with `Cache-Control: no-store`
  and never calls `searchReferences`.
- `searchReferences` gets the same guard and throws `UnknownKeyError` (from `list-query.ts`) for
  a non-id, so other callers can't send one to Postgres either.
- `ReferenceCombobox` already treats a non-OK response as no options.

### B2 — docket To Client rule

- `saveRecord` runs `applyRules` and the write inside one `tx()` for `delivery_dockets` (edit) and
  for `orders` (when `delivery_docket_id` is set). `applyRules` takes the transaction's client
  for its queries.
- **Docket edit:**

  ```sql
  SELECT 1 FROM delivery_dockets WHERE id = $1 FOR UPDATE
  ```

  Then, if `to_client_id` is in the values:

  ```sql
  SELECT 1 FROM orders WHERE delivery_docket_id = $1 AND client_id <> $2 LIMIT 1
  ```

  A row means `RuleError("delivery docket has orders for another client")`.
- **Order save:** the existing docket check reads the docket with `FOR SHARE`, so a concurrent
  To Client change can't slip between the check and the write.
- No migration or trigger. The rule stays in the action layer, beside the existing order rule.

### B3 — ids in actions

- In `saveRecord`'s edit mode and in `deleteRecord`, `!isId(id)` returns
  `{ ok: false, error: "<singular> not found" }` before any database call.
- `recordOr404` uses `isId` instead of its own regex.

### P1 — list query

`listRecords` keeps its signature and `ListResult`. Internally it runs:

1. **Ids** (in parallel with 2):

   ```sql
   SELECT id FROM <source> WHERE <filters/status> ORDER BY <col> <dir> NULLS LAST, id <dir> LIMIT $n OFFSET $m
   ```
2. **Count** (in parallel with 1):

   ```sql
   SELECT count(*)::int AS n FROM <source> WHERE <filters/status>
   ```
3. **Rows**, only when step 1 returned ids:

   ```sql
   SELECT <select> FROM <source> WHERE id = ANY($1::bigint[])
   ```

   The rows are returned in step 1's order (reordered in JS by id).

- `total` is always the real count under the filters and the status tab, including past the last
  page. Before this change it was 0 there.
- `rows` and `total` come from two statements, so they can disagree by a few rows under
  concurrent writes. That's accepted.
- `countByStatus` and `getRecord` are unchanged.
- A benchmark script, `scripts/bench-lists.ts` (`npm run bench:lists`), checks the gain:
  1. Creates a throwaway database (`tests/helpers/throwaway-db.ts` pattern, Atlas-migrated).
  2. Inserts the sender client, 30 clients, the reference data, 60 products, 45,000 orders and
     100,000 order items (2–3 per order, ~2.2 on average, statuses spread evenly).
     - Sizing: v1 production (MySQL, checked 2026-11-02) holds 28,484 order items and 13,275
       orders, growing by ~9,500 items and ~4,400 orders a year since 2024, at ~2.1 items per
       order.
     - So 100k items is about 3.5× today, or roughly 10 years at the current rate. Order data
       isn't migrated, so v2 starts empty.
  3. Times `listRecords("order_items", …)` for the All and New tabs, default sort, page 1, size
     25: one warm-up, then 5 runs each.
  4. Prints the medians and drops the database.
  5. Exits 1 if either median is over 300 ms.

  It runs locally only (not in CI), with `DATABASE_URL` pointed at the throwaway database
  (direct `pg`).

### P2 — one `users` query per auth check

- `getSessionVersion` becomes `getSessionUser(userId)`:

  ```sql
  SELECT session_version, name, email FROM users WHERE id = $1
  ```

  It returns `{ sessionVersion, name, email } | null`.
  An `isId` guard runs before the query, so a non-id returns `null`.
- **`checkSessionVersion`** (`lib/auth/session-version.ts`) changes its lookup type to:

  ```ts
  lookup: (userId: string) => Promise<{ sessionVersion: number; name: string | null; email: string } | null>
  ```

  - It compares `row.sessionVersion` with `token.sv`, as today.
  - When the session is valid it returns `{ ...token, name: row.name, email: row.email }`.
  - On a lookup error it returns the token unchanged, as today.
- **Sign-in:** the jwt callback's `if (user)` branch also sets `token.name = user.name ?? null`.
- The session callback copies `token.name` to `session.user.name`.
- **Sidebar:**
  - `SidebarUser` takes the name and email from `requireSession()` and shows
    `session.user.name ?? session.user.email`.
  - So a token issued before this change, with no `name`, or one kept after a lookup error,
    still shows something. The first successful check fills in the name.
  - It no longer calls `getUserDisplay`, which is removed.
- A rename shows on the next request: the callback runs on every `auth()` call, and Auth.js
  passes the returned token to the session callback for that request.
- **Rejection rules are unchanged:**
  - a version mismatch signs out
  - a missing user signs out
  - a lookup error keeps the session for that request
- The callbacks move to `lib/auth/callbacks.ts` as functions that take their lookup as a
  parameter, so they can be unit tested without Auth.js. `lib/auth.ts` wires them up.

### P3 — server-given reference labels

- **`FieldDef.displayLabel?: string[]`** names the row columns whose non-empty values, joined
  with `" · "`, make the same label the combobox's SQL builds (`QUERIES[ref].options.label`).
  Without it the label is `[display]`. It's set where the formats differ:
  - `products.type_id` → `["type_code", "type_name"]`
  - `products.media_id` → `["media_code", "media_name"]`
  - `order_items.order_id` → `["order_number", "client_name"]`
  - `orders.delivery_docket_id` → `["delivery_docket_number"]` (same as `display`; no change
    needed)
- **`referenceLabel(field, row)`** in `lib/resources` builds the label, or returns `null` when
  any listed column is null.
- **`ReferenceCombobox`** gets `label?: string | null`. When `label` is given for the current
  `value`, it's shown and no `?id=` request is made. It still fetches when the value changes and
  no label was picked, or when no label was passed.
- **Forms and panels.**
  - `ResourceForm` and `RecordPanel` pass `referenceLabel(field, record)` for each reference
    field of the record.
  - Create dialogs are unchanged. Their reference fields start empty, and an option picked there
    keeps its label in the combobox's own state.
  - `OrderItemPanel` passes the product and order labels from its panel data (`product_name`;
    `order_number · client_name`).
- **Filters.**
  - `ResourceListPage` and the Order Items page resolve labels for reference filters that have a
    value. They call `searchReferences(ref, { id })` in parallel with the list queries, at most
    one call per such filter.
  - They pass `labels: Record<filterKey, string>` to `FilterBar`, which hands each to its
    combobox.
- **Parity test.** An integration test checks that, for every reference field of every resource,
  `referenceLabel(field, row)` matches `searchReferences(field.ref, { id: row[field.name] })[0].label`
  on a fixture row.

### Code quality

- **`OrderItemsListPage` reuses `ResourceListPage`.** It gains optional props:
  - `loadRecord(id)`, default `getRecord`
  - `renderTable(props)`, default `ResourceTable`
  - `renderPanel(record, props)`, default `RecordPanel`
  - `renderCreate(props)`, default `RecordCreateForm`
  - `className` and `panelAttr` for the wrapper

  The Order Items page passes its own pieces. The not-found toast label comes from
  `singularLabel(ui)` everywhere (`Order item`, unchanged text).
- **`fieldErrorsFrom(issues)`** in `lib/resources/schema.ts` replaces the two loops in
  `actions.ts` and `panel-actions.ts`.
- **`deleteUserChecked`** takes `Queryable` from `lib/db`.
- **`stages.ts`** drops its `isId` re-export. Callers import from `@/lib/ids`.

### Tests and CI

- **Unit tests** (`tests/unit/`, jsdom where needed) for:
  - `queryWithout`, `listParamsFromUrl`, `newHref` and `first` (moved from `pages.tsx` to
    `components/resource/list-params.ts` so they can be imported without server-only modules)
  - `format.ts`
  - `itemHref` and `savedToast`, with `sonner` mocked
  - `use-panel-errors.ts`, via `renderHook`
  - `sidebar-state.ts`
  - `lib/auth/callbacks.ts`
  - `referenceLabel`
  - `checkSessionVersion`: `tests/unit/session-version.test.ts` is updated for the new lookup
    shape. Its rejection-rule cases are kept, and one new case checks that name and email are
    copied in.
- **Integration tests:**
  - the reference route (`GET` imported directly; `@/lib/auth` mocked for the signed-in and
    signed-out cases)
  - B2 and B3
  - the label parity test
  - the new `listRecords` behaviour (order, total past the end, no `OVER (` in the SQL sent,
    checked with a spy on `query`)
- **Coverage** (`vitest.config.mts`):
  - provider v8
  - `include`: `lib/**/*.ts`, `components/**/*.{ts,tsx}`, `app/**/*.{ts,tsx}`
  - `exclude`: `components/ui/**`, `**/*.d.ts`
  - thresholds per glob:
    - `lib/**`: lines ≥ 85, branches ≥ 75. `lib/auth.ts` (NextAuth wiring) and
      `lib/db/index.ts` (whose Neon branch runs only on Vercel) are left out of this threshold
      but still appear in the report.
    - lines ≥ 90 for each of:
      - `components/resource/list-params.ts`
      - `components/resource/format.ts`
      - `components/resource/panel/saved-toast.ts`
      - `components/resource/panel/use-panel-errors.ts`
      - `components/app-shell/sidebar-state.ts`
      - `lib/auth/callbacks.ts`

      `referenceLabel` lives in `lib/resources/index.ts`, so the `lib/**` threshold covers it.
  - **Fallback:** if a measured figure is below its threshold once this feature's tests exist,
    lower that threshold to the measured figure rounded down to the nearest 5. Record the change
    in the implementation changelog.
  - **Report only:** the thresholds are reported but don't fail CI. Vitest exits non-zero on a
    missed threshold, so the CI step that runs `npm run test:coverage` has
    `continue-on-error: true`. Tests themselves fail CI through the separate unit and
    integration steps.

  `npm run test:coverage` runs `vitest run --coverage --project unit --project integration`. In
  CI it runs after the "Unit tests" and "Integration tests" steps, which stay as they are. The
  HTML report is always uploaded as an artifact.

### T — test pyramid

**Baseline (2026-11-02):**

| Layer | Tests | Run time |
|---|---|---|
| e2e | 201 (incl. `auth.setup`) | ~10 min |
| integration | 185 | ~50 s, of which ~37 s is spawning `npx tsx` in the CLI tests |
| unit | 277 | ~5 s |

**Rule:**
- A behaviour leaves e2e only when a named unit or integration test asserts it.
- E2E keeps what needs a real browser and server:
  - history and Back
  - focus return
  - discard guards
  - the sheet below 1024px, and no panel flash before hydration
  - debounced combobox search
  - print media
  - toast wording
  - Moved-to-tab with View
  - double-click-creates-one
  - session cookies
  - one real sign-in and sign-out
  - axe
- Each e2e loop over resources keeps 2 representative resources:
  - one simple: Clients
  - one with references or custom pieces: Orders or Order Items, as named below

**E2E changes:**

| # | E2E today | After | Covered by |
|---|---|---|---|
| E1 | `routes.spec`: 6 public-path and 2 protected-path tests | Removed. The static-asset test and the spec 01 AC-19 test stay | New unit `tests/unit/proxy-matcher.test.ts`: `unstable_doesMiddlewareMatch` from `next/experimental/testing/server` (the installed name; the docs call it `unstable_doesProxyMatch`) against `proxy.ts`'s `config`, for the same 8 paths. `@/lib/auth` is mocked so `proxy.ts` can be imported. Plus `isPublicPath` (existing) |
| E2 | `crud.spec`: lifecycle ×10 resources | Users and Order Items only | New integration `tests/integration/crud-lifecycle.test.ts`, for all 10 keys: `saveRecord` create → `listRecords` finds it → `getRecord` → `saveRecord` edit → `deleteRecord` → gone, with the success messages |
| E3 | `lists` AC-6 ×10 lists | Clients and Order Items | `resources-config` AC-6 (columns, default sort, New label). Every list renders through `ResourceTable` |
| E4 | `list-panels` 07 AC-6 deep link ×10 lists | Clients and Orders | Same shared `RecordPanel`. New unit test E5 |
| E5 | `list-panels` "each panel holds every field of the resource's edit form" | Removed | New unit (jsdom) `tests/unit/record-panel-fields.test.tsx`: renders `RecordPanel` for each of the 10 resources from a fixture record and asserts every edit-form field (labels, switches, comboboxes). Server-only and action modules are mocked |
| E6 | `list-panels` 07 AC-16 stale order write | Removed | Integration `list-panels.test` "07 AC-16 fix 1" (existing) |
| E7 | `login` AC-4: 3 bad callbackUrls | Only `//evil.example` stays | Unit `callback-url.test` (existing) |
| E8 | `login` AC-5 "email in a different case signs in" | Removed | Unit `credentials.test` "matches the email case-insensitively" (existing) |
| E9 | `login` spec 01 AC-19: 11 sign-ins | Removed | New integration `tests/integration/sign-in-action.test.ts`: `signInAction`, with `next/headers` and `@/lib/auth`'s `signIn` mocked. 10 attempts reach `signIn`; the 11th returns the too-many-attempts message without calling `signIn`, even with the right password |
| E10 | `lists` AC-11, `lists` "Review 02 finding 1", `forms` AC-23 filter by type | Removed | Integration `list-query` AC-11, AC-23 and finding 1 (existing). Unit `list-params` (this spec) |
| E11 | `forms` AC-24, AC-25 | Removed | Unit `resources-config` AC-24/25 (existing) and E5 |
| E12 | `order-items` 06 AC-18 "non-numeric and unknown ids open no panel" | Merged into `list-panels` "bad ids open nothing", which adds an `/order-items?item=abc` case | Integration `order-item-panel` (null for `abc`) |
| E13 | `create-dialogs` 08 AC-9 Users dialog | Removed | Integration `create-dialogs` 08 AC-9 (existing) |
| E14 | `shell` 06 AC-7: 13 per-page axe tests, and `forms` AC-30 sweep | One sweep test in `shell.spec`: the union of both page lists and both rule sets (critical, `color-contrast`, `label`, `select-name`, `button-name`), each page loaded and analysed once | — |

The panel, dialog and Order Items axe tests stay as they are.

**Integration → unit:**

| # | Today | After |
|---|---|---|
| I1 | `create-user --target`: 9 spawned cases. `seed-dummy-cli`: 16 spawned cases | The refusal and argument cases move to unit tests of `checkTarget`, `parseTarget`, `parseCreateUserArgs` and `parseCliArgs`. Each CLI keeps one spawn test: a refusal exits non-zero with one line, no stack trace, and no connection attempt |
| I2 | `create-user` AC-14: 5 cases spawning the CLI | `scripts/create-user.ts` exports `createUser(email, password)`, and `main` calls it. The cases call it in-process (still integration). One spawn case stays |
| I3 | `list-query` finding 1 (8 invalid-value cases), unknown filter and sort key; `list-panels` "rejects status … without status tabs" and "old status filter is gone" | `lib/db/list-query.ts` exports its pure builder (`filterWhere`, plus the status and sort checks the P1 rework factors out). Unit tests assert the `where`/`values` it returns or the `UnknownKeyError` it throws. Integration keeps "injection string is data", "valid values still filter" and one invalid-value case |
| I5 | `db.test` describe "lib/db through the Neon-compatible proxy" | Renamed "lib/db (direct pg locally)". The proxy was removed |

Tests that fail before any SQL (no session, unknown resource, validation) stay in integration. Their
"writes nothing" checks read the database.

**Expected counts:**

| Layer | Before | After the pyramid changes |
|---|---|---|
| e2e | 201 | ~143 |
| integration | 185 | ~161 |
| unit | 277 | ~330 |

These counts don't include the other new tests in this spec. Run times are expected to be ~15–20 s
for integration and ~7–8 min for e2e, measured after the change.

**Mapping file:** `tests/MOVED.md` lists every removed or merged e2e and integration test by its
old title, with the file and title of the test that now covers it.

## Acceptance criteria

1. **AC-1** `GET /api/reference/clients?id=abc` and `…?clientId=1x` (signed in) return 400
   `{ "error": "invalid id" }`. `searchReferences` is not called (spy). `?id=5` and `?q=a` behave
   as before. Signed out returns 401. An unknown resource returns 404.
2. **AC-2** `searchReferences("clients", { id: "abc" })` rejects with `UnknownKeyError` and sends
   no SQL.
3. **AC-3** Docket rule. Take a docket with an order for client A:
   - Saving it with `to_client_id` B returns
     `{ ok: false, error: "delivery docket has orders for another client" }`, and the row is
     unchanged.
   - Saving it with A, or with B after the order moves to B, succeeds.
   - A docket with no orders can change To Client.
   - The same rule holds through the edit panel (e2e: the toast text from User-visible §1).
4. **AC-4** The docket check and the order check each run in the same transaction as their
   write. An integration test holds the docket row `FOR UPDATE` on a separate connection and
   shows the order save waits for it (it completes only after the lock is released).
5. **AC-5** `saveRecord(k, "abc", …)` and `deleteRecord(k, "abc")` return
   `{ ok: false, error: "<singular> not found" }` for every resource key, with no query sent
   (spy).
6. **AC-6** `listRecords` sends no SQL containing `OVER (`. It returns rows in the same order as
   before for every list's default sort and for one ascending and one descending column sort
   (comparing against a reference query on fixture data). It returns `total` equal to
   `SELECT count(*)` under the same filters and status. All existing `list-query`,
   `order-items-list` and `list-panels` integration tests pass unchanged.
7. **AC-7** Past the last page, `listRecords` returns `rows: []` and the real `total`. The footer
   reads `Showing 0–0 of <total>`, or `No results` when the total is 0 (unit test of
   `Pagination` with jsdom).
8. **AC-8** P2 callbacks (unit tests of `lib/auth/callbacks.ts`):
   - a matching version keeps the token and sets `name`/`email` from the lookup
   - a mismatch returns null
   - a missing user returns null
   - a lookup error keeps the token unchanged
   - the session callback exposes `user.name`
9. **AC-9** `getUserDisplay` no longer exists. `SidebarUser` reads the name from the session and
   shows the email when the name is missing. The existing `users-name` e2e (rename shows in the
   sidebar) and `session` e2e (sign out everywhere, deleted user) pass.
   - The `06 AC-4 getUserDisplay` block in `tests/integration/users-name.test.ts` is rewritten
     for `getSessionUser`, keeping its label and its three cases:
     - a known id returns `{ sessionVersion, name, email }`
     - an unknown id returns `null`
     - `"abc"` returns `null`
   - The sign-in branch sets `token.name` (unit test).
10. **AC-10** Label parity: for every reference field of every resource, `referenceLabel` on a
    fixture row equals the `searchReferences` label for that id.
11. **AC-11** No label fetch on mount. Opening the edit panel for an order with a docket, the
    order-item panel, and `/orders?client=<id>` makes no `/api/reference/*?id=` request (e2e,
    request listener). Each combobox shows its label as soon as the panel or filter bar renders,
    both when opened by clicking a row and on a direct load of the URL (`toHaveText` with no
    wait on a network response). Choosing a
    different option still shows its label. Clearing a filter still shows "Select…".
12. **AC-12** `ResourceListPage` serves Order Items with its own table, panel and create dialog.
    `components/order-items/order-items-page.tsx` holds no list-loading code (no direct call to
    `listRecords`, `countByStatus`, `queryWithout` or `listParamsFromUrl`). All Order Items and
    list-panels e2e pass.
13. **AC-13** The field-error loop exists once (`fieldErrorsFrom`, unit tested).
    `deleteUserChecked` uses `Queryable`. No file imports `isId` from `lib/order-items/stages`.
14. **AC-14** `npm run bench:lists` seeds 100,000 order items and 45,000 orders, and exits 0 on
    the author's machine. The All and New medians are each ≤ 300 ms. The research baseline was
    ~800 ms and ~400 ms at 200k items.
15. **AC-15** Coverage:
    - The unit tests listed under Tests and CI exist and pass.
    - `vitest.config.mts` declares the thresholds above, with any fallback lowering recorded in
      the implementation changelog.
    - `npm run test:coverage` runs only the `unit` and `integration` projects and writes the
      HTML report.
    - CI runs it with `continue-on-error: true` and always uploads the report. A
      `project-config` unit test that parses `ci.yml` checks this.
16. **AC-16** E2E pyramid:
    - `npx playwright test --list` reports ≤ 145 tests.
    - Every row E1–E14 is done as described.
    - `tests/MOVED.md` maps every removed or merged e2e test title to an existing test file and
      title. A unit test parses the file, and fails if a mapped target file or title doesn't
      exist.
17. **AC-17** New lower-level tests exist and pass:
    - `proxy-matcher.test.ts`: the 8 paths match or don't match as the old `routes.spec` asserted
    - `record-panel-fields.test.tsx`: 10 resources
    - `crud-lifecycle.test.ts`: 10 keys
    - `sign-in-action.test.ts`: the 11th attempt returns the limit message, and `signIn` isn't
      called
18. **AC-18** Integration → unit:
    - `create-user.test.ts` and `seed-dummy-cli.test.ts` each spawn the CLI in at most 2 tests:
      one refusal, plus one AC-14 run for create-user.
    - Every removed spawn case has a unit counterpart listed in `tests/MOVED.md`.
    - `list-query` invalid-value, unknown-key and status-rule cases are unit tests of the
      exported builder, with the three integration cases from I3 kept.
    - `db.test` is renamed (I5).
19. **AC-19** `npm run test:integration` takes ≤ 50 s on the author's machine, by vitest's reported Duration (baseline ~50 s; relaxed from ≤ 25 s at PR validation, 2026-11-03).
    The e2e run time is measured and recorded in the implementation changelog, with no gate.
20. **AC-20** `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`,
    `npm run build` and `npm run test:e2e` all pass.

## Out of scope

- **The proxy-plus-render double session check.** They're separate requests, so they can't share
  a cache. Skipping the check in the proxy for prefetches would weaken sign-out everywhere.
- **Reworking the layout's `Content` gate for parallel data fetching.** Next's docs say layouts
  and pages render in parallel. The review didn't measure a waterfall, so none is assumed.
- **`countByStatus` and detail-page queries.** They're within budget (~140 ms at 200k).
- **Client bundle size** (zod, cmdk, TanStack). That's acceptable for a staff app (review P4).
- **A database constraint or trigger for the docket–order client rule.**
- **A Neon driver smoke test.** Dropped at spec validation. The staging deploy remains the real
  check of the Neon path.
- **Keyset pagination or estimated counts.**
- **Coverage thresholds that fail CI.** They're report-only for now.
- **Moving pre-SQL integration tests to unit** (no session, unknown resource, validation). That
  saves under 1 s, and their "writes nothing" checks need the database.
- **Changing what the e2e tests that stay assert**, beyond the merges in E12 and E14.

## Open questions

None. Settled at spec validation (2026-11-02):
- B2 refuses the save (no detach).
- The benchmark is 100k items / 45k orders at ≤ 300 ms, sized from v1 production's counts.
- Coverage thresholds are report-only.
- The Neon smoke test is dropped.
