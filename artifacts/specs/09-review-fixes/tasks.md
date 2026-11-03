# Tasks — 09-review-fixes

- Date: 20261102-212114 (revised 20261103-205246)
- Feature: 09-review-fixes
- Phase: 2 (Tasks)

Built from `artifacts/specs/09-review-fixes/spec.md`, with `research.md` for file and line
references. References in brackets point at the spec's acceptance criteria (AC n) or Design
sections (B1–B3, P1–P3, Code quality, Tests and CI, T).

Order:
- Small shared refactors come first, so later tasks build on them.
- Then the bugs, then performance.
- The test-pyramid moves come last, because they depend on the new helpers, P1's exported
  builder and P2's callbacks.

## Tasks

### 1. Shared refactors

- [ ] Remove the `isId` re-export from `lib/order-items/stages.ts`. Change every caller to
  import from `@/lib/ids` (Code quality; AC 13)
- [ ] Add `fieldErrorsFrom(issues)` to `lib/resources/schema.ts`. Replace the loops in
  `lib/resources/actions.ts` (~:84) and `lib/order-items/panel-actions.ts` (~:76) with it
  (Code quality; AC 13)
- [ ] Type `deleteUserChecked` in `lib/db/queries/users.ts` with `Queryable` from `lib/db`,
  instead of its inline type (Code quality; AC 13)
- [ ] Move `queryWithout`, `listParamsFromUrl`, `newHref` and `first` from
  `components/resource/pages.tsx` to a new `components/resource/list-params.ts`, with no
  server-only imports. Update their importers (Tests and CI)

### 2. B1 — reference API input

- [ ] In `searchReferences`, throw `UnknownKeyError` when `id` or `clientId` is present and
  non-empty but fails `isId`, before any SQL (B1; AC 2)
- [ ] In `app/api/reference/[resource]/route.ts`, validate `id` and `clientId` with `isId`. On a
  failure, return `400 { error: "invalid id" }` with `Cache-Control: no-store` and don't call
  `searchReferences`. Keep 401 for signed-out requests and 404 for an unknown resource (B1; AC 1)

### 3. B3 — ids in actions

- [ ] In `saveRecord` (edit mode) and `deleteRecord`, return
  `{ ok: false, error: "<singular> not found" }` when `!isId(id)`, before any database call
  (B3; AC 5)
- [ ] Make `recordOr404` in `components/resource/pages.tsx` use `isId` instead of its own regex
  (B3)

### 4. B2 — docket To Client rule

- [ ] Make `applyRules` take a `Queryable` and run its queries on it (B2)
- [ ] In `saveRecord`, run `applyRules` and the write inside one `tx()`:
  - for `delivery_dockets` edits
  - for `orders` saves that set `delivery_docket_id`

  Other resources keep their current path (B2; AC 4)
- [ ] Docket edit rule:
  - lock the docket with `SELECT 1 FROM delivery_dockets WHERE id = $1 FOR UPDATE`;
  - when `to_client_id` is in the values, check
    `SELECT 1 FROM orders WHERE delivery_docket_id = $1 AND client_id <> $2 LIMIT 1`;
  - a row throws `RuleError("delivery docket has orders for another client")`.

  (B2; AC 3)
- [ ] Order rule: make the existing docket check read the docket `FOR SHARE` inside the same
  transaction (B2; AC 4)

### 5. P1 — list query

- [ ] In `lib/db/list-query.ts`:
  - export the pure where-clause builder (`filterWhere`);
  - factor the status-tab and sort checks into pure exported functions that return SQL
    fragments and values, or throw `UnknownKeyError`.

  The behaviour is unchanged (P1; T I3)
- [ ] Before the rewrite, copy the current single-statement query as a test helper. AC 6 compares
  the new ordering against it (P1; AC 6)
- [ ] Rewrite `listRecords`:
  - run the ids query (`ORDER BY <col> <dir> NULLS LAST, id <dir> LIMIT/OFFSET`) and
    `SELECT count(*)::int` in parallel;
  - then `SELECT <select> … WHERE id = ANY($1::bigint[])` only when ids came back;
  - reorder the rows in JS to the ids' order;
  - return the real `total` even past the last page;
  - drop `count(*) OVER ()`.

  AC 6's "existing tests pass unchanged" applies to the cases that stay in integration after
  §11 I3. Run the rewrite green against the full, unmoved integration suite before doing I3.
  The moved cases keep their titles in their unit file, and `tests/MOVED.md` maps them
  (P1; AC 6, AC 7)
- [ ] Update `Pagination` to show `Showing 0–0 of <total>` whenever
  `(page - 1) * pageSize >= total` and `total > 0`. Keep Prev enabled there. Keep
  `No results` when the total is 0 (User-visible 4; AC 7)
- [ ] Add `scripts/bench-lists.ts` and the `npm run bench:lists` script:
  - create a throwaway Atlas-migrated database, following the `tests/helpers/throwaway-db.ts`
    pattern;
  - insert the sender client, 30 clients, the reference data, 60 products, 45,000 orders and
    100,000 order items (2–3 per order, ~2.2 on average, statuses spread evenly);
  - time `listRecords("order_items", …)` for the All and New tabs (default sort, page 1, size
    25): one warm-up, then 5 runs each;
  - print the medians and drop the database;
  - exit 1 if either median is over 300 ms;
  - local only: add it to no workflow. Set `DATABASE_URL` to the throwaway database before
    importing `lib/db`, so it never touches `.env`'s database, and drop the database in a
    `finally`.

  Extend `tests/unit/seed-dummy-dataset.test.ts` AC-9 ("no workflow runs seed-dummy") to also
  assert that no workflow runs `bench:lists` (P1; AC 14)

### 6. P2 — one `users` query per auth check

- [ ] Replace `getSessionVersion` with `getSessionUser(userId)` in `lib/db/queries/users.ts`:
  - it returns `{ sessionVersion, name, email } | null`;
  - its SQL is `SELECT session_version, name, email FROM users WHERE id = $1`;
  - an `isId` guard returns `null` for a non-id.

  (P2; AC 9)
- [ ] Change `checkSessionVersion`'s lookup type to the row shape:
  - compare `row.sessionVersion` with `token.sv`;
  - on a valid session, return `{ ...token, name: row.name, email: row.email }`;
  - keep the token unchanged on a lookup error.

  (P2; AC 8)
- [ ] Move the jwt and session callbacks to `lib/auth/callbacks.ts` as functions that take
  their lookup as a parameter:
  - the sign-in branch also sets `token.name = user.name ?? null`;
  - the session callback copies `token.name` to `session.user.name`.

  Wire them up in `lib/auth.ts` with `getSessionUser` (P2; AC 8)
- [ ] Make `SidebarUser` in `components/app-shell/sidebar.tsx` read the name and email from
  `requireSession()` and show `name ?? email`. Remove `getUserDisplay` (P2; AC 9)

### 7. Code quality — Order Items on `ResourceListPage`

- [ ] Give `ResourceListPage` optional `loadRecord`, `renderTable`, `renderPanel`,
  `renderCreate`, `className` and `panelAttr` props. Their defaults are `getRecord`,
  `ResourceTable`, `RecordPanel` and `RecordCreateForm` (Code quality; AC 12)
- [ ] Rewrite `components/order-items/order-items-page.tsx` to render `ResourceListPage` with its
  own table, panel and create dialog. It should make no direct call to `listRecords`,
  `countByStatus`, `queryWithout` or `listParamsFromUrl`. The not-found toast uses
  `singularLabel(ui)` (Code quality; AC 12)

### 8. P3 — server-given reference labels

- [ ] Add `FieldDef.displayLabel?: string[]` and set it on:
  - `products.type_id` → `["type_code", "type_name"]`
  - `products.media_id` → `["media_code", "media_name"]`
  - `order_items.order_id` → `["order_number", "client_name"]`

  (P3)
- [ ] Add `referenceLabel(field, row)` to `lib/resources/index.ts`:
  - join the non-empty `displayLabel` columns (or `[display]`) with `" · "`;
  - return `null` when any listed column is null.

  (P3; AC 10)
- [ ] Add `label?: string | null` to `ReferenceCombobox`:
  - when a label is given for the current `value`, show it and make no `?id=` request;
  - still fetch when the value changes with no picked label, or when no label was passed.

  (P3; AC 11)
- [ ] Pass the labels into the edit views:
  - `ResourceForm` and `RecordPanel` pass `referenceLabel(field, record)` for each reference
    field;
  - `OrderItemPanel` passes `product_name` and `order_number · client_name` from its panel
    data;
  - create dialogs stay unchanged.

  (P3; AC 11)
- [ ] In `ResourceListPage` (which now serves Order Items too, after §7), resolve labels for reference
  filters that have a value:
  - one `searchReferences(ref, { id })` call per such filter, run in parallel with the list
    queries;
  - pass `labels: Record<filterKey, string>` to `FilterBar`, which hands each to its combobox.

  (P3; AC 11)

### 9. New and updated tests for B1–B3, P1–P3 and the helpers

- [ ] Integration test for the reference route, importing `GET` directly with `@/lib/auth`
  mocked:
  - `?id=abc` and `?clientId=1x` return 400 `{ error: "invalid id" }` without calling
    `searchReferences` (spy);
  - `?id=5` and `?q=a` work;
  - signed out returns 401;
  - an unknown resource returns 404.

  (AC 1)
- [ ] Integration test: `searchReferences("clients", { id: "abc" })` rejects with
  `UnknownKeyError` and sends no SQL (AC 2)
- [ ] Integration tests for the docket rule (AC 3):
  - refusal with B, and the row unchanged;
  - success with A;
  - success with B after the order moves;
  - a docket with no orders can change.
- [ ] Integration test: with the docket row held `FOR UPDATE` on a second connection, the order
  save waits until it's released (AC 4)
- [ ] Integration test: `saveRecord(k, "abc", …)` and `deleteRecord(k, "abc")` return
  `<singular> not found` for every key, with no query sent (spy) (AC 5)
- [ ] Integration tests for `listRecords` (AC 6, AC 7):
  - no SQL with `OVER (` (spy on `query`);
  - the same order as the reference query, for every list's default sort plus one ascending
    and one descending column sort;
  - `total` equals `SELECT count(*)`;
  - past the last page: `rows: []` and the real total.
- [ ] Unit test of `Pagination` (jsdom):
  - `Showing 0–0 of <total>` past the end, with Prev enabled;
  - `No results` at 0.

  (AC 7)
- [ ] Unit tests of `lib/auth/callbacks.ts` (AC 8, AC 9):
  - a matching version sets name and email;
  - a mismatch returns null;
  - a missing user returns null;
  - a lookup error keeps the token unchanged;
  - sign-in sets `token.name`;
  - the session callback exposes `user.name`.
- [ ] Update `tests/unit/session-version.test.ts` for the new lookup shape. Keep the rejection
  cases and add a name-and-email copy case (Tests and CI; AC 8)
- [ ] Rewrite the `06 AC-4 getUserDisplay` block in `tests/integration/users-name.test.ts` for
  `getSessionUser`, keeping its label and its three cases:
  - a known id returns `{ sessionVersion, name, email }`
  - an unknown id returns `null`
  - `"abc"` returns `null`

  (AC 9)
- [ ] Label parity integration test: for every reference field of every resource,
  `referenceLabel` on a fixture row equals the `searchReferences` label for that id (AC 10)
- [ ] Unit test of `referenceLabel`: the default `[display]`, joined `displayLabel` columns, and
  `null` when a column is null (Tests and CI)
- [ ] Unit tests for the helpers (Tests and CI; AC 15):
  - `list-params.ts`
  - `format.ts`
  - `itemHref` and `savedToast`, with `sonner` mocked
  - `use-panel-errors.ts`, via `renderHook`
  - `sidebar-state.ts`
- [ ] Unit test of `fieldErrorsFrom` (AC 13)
- [ ] E2E (AC 3): add steps to the existing `list-panels.spec.ts` test "delivery dockets:
  read-only values, To client link, and a To Client change persists", not a new test. Editing
  the docket's To Client while it holds another client's order shows
  `Could not edit Delivery Docket: delivery docket has orders for another client`, and nothing
  is saved
- [ ] E2E (AC 11):
  - opening an order's edit panel with a docket, the order-item panel, and
    `/orders?client=<id>` makes no `/api/reference/*?id=` request (request listener);
  - each label is visible as soon as the panel or filter bar renders, both on a row click and
    on a direct load;
  - choosing another option still shows its label;
  - clearing a filter shows "Select…".
- [ ] Check the existing `users-name` and `session` e2e still pass with the session-based
  sidebar (AC 9)

### 10. Coverage and CI

- [ ] Check that `@vitest/coverage-v8` (already a dev dependency) matches the installed vitest
  version. Configure coverage in `vitest.config.mts`:
  - provider v8;
  - the `include` and `exclude` globs from the spec;
  - thresholds: `lib/**` lines 85 / branches 75, excluding `lib/auth.ts` and
    `lib/db/index.ts`;
  - lines 90 for each of the six named helper files.

  (Tests and CI; AC 15)
- [ ] Add the `test:coverage` script:
  `vitest run --coverage --project unit --project integration` (Tests and CI; AC 15)
- [ ] In `.github/workflows/ci.yml`, add a coverage step after "Unit tests" and "Integration
  tests", with `continue-on-error: true`, plus an always-run upload of the HTML report as an
  artifact (Tests and CI; AC 15)
- [ ] Extend `tests/unit/project-config.test.ts` to assert the coverage step, its
  `continue-on-error`, and the always-run upload (AC 15)
- [ ] Measure coverage once all tests exist. Lower any threshold that isn't met to the measured
  figure rounded down to the nearest 5, and record that in the implementation changelog (Tests
  and CI; AC 15)

### 11. T — integration → unit

- [ ] I1: move the CLI refusal and argument cases into unit tests of `checkTarget`,
  `parseTarget`, `parseCreateUserArgs` and `parseCliArgs`:
  - 8 of the 9 `create-user --target` cases;
  - 15 of the 16 `seed-dummy-cli` cases.

  Each CLI keeps one spawn test: a refusal exits non-zero with one line, no stack trace and no
  connection attempt (T I1; AC 18)
- [ ] I2: export `createUser(email, password)` from `scripts/create-user.ts` and have `main` call
  it. Change the `create-user` AC-14 cases to call it in-process, keeping one spawn case
  (T I2; AC 18)
- [ ] I3: move to unit tests of the exported builder from task 5:
  - the `list-query` finding-1 invalid-value cases (all but one);
  - the unknown filter and sort key cases;
  - the `list-panels` "rejects status … without status tabs" and "old status filter is gone"
    cases.

  Keep in integration: "injection string is data", "valid values still filter", and one
  invalid-value case (T I3; AC 18)
- [ ] I5: rename the `db.test` describe to "lib/db (direct pg locally)" (T I5; AC 18)

### 12. T — e2e → lower layers

- [ ] E1: add `tests/unit/proxy-matcher.test.ts`. It asserts the same 8 paths with
  `unstable_doesMiddlewareMatch` from `next/experimental/testing/server` against `proxy.ts`'s
  `config`, with `@/lib/auth` mocked. Then remove the 8 path tests from `routes.spec.ts`,
  keeping the static-asset and spec 01 AC-19 tests (T E1; AC 16, AC 17)
- [ ] E2: add `tests/integration/crud-lifecycle.test.ts`. For all 10 keys it runs `saveRecord`
  create → `listRecords` finds it → `getRecord` → `saveRecord` edit → `deleteRecord` → gone,
  checking the success messages. Then cut `crud.spec.ts` down to Users and Order Items
  (T E2; AC 16, AC 17)
- [ ] E3: cut `lists.spec.ts` AC-6 to Clients and Order Items (T E3; AC 16)
- [ ] E5: add `tests/unit/record-panel-fields.test.tsx` (jsdom), with server-only and action
  modules mocked. It renders `RecordPanel` for each of the 10 resources from a fixture record
  and asserts every edit-form field (labels, switches, comboboxes). Then remove the "each panel
  holds every field" test from `list-panels.spec.ts` (T E5; AC 16, AC 17)
- [ ] E4: cut `list-panels.spec.ts` 07 AC-6 deep links to Clients and Orders (T E4; AC 16)
- [ ] E6: remove `list-panels.spec.ts` 07 AC-16 "no stale order writes" (T E6; AC 16)
- [ ] E7, E8: in `login.spec.ts`:
  - keep only the `//evil.example` bad-callback case;
  - remove "email in a different case signs in".

  (T E7, E8; AC 16)
- [ ] E9: add `tests/integration/sign-in-action.test.ts`, with `next/headers` and `@/lib/auth`'s
  `signIn` mocked. 10 attempts reach `signIn`; the 11th returns the too-many-attempts message
  without calling `signIn`. Then remove `login.spec.ts` spec 01 AC-19 (T E9; AC 16, AC 17)
- [ ] E10: remove from e2e (T E10; AC 16):
  - `lists.spec.ts` AC-11;
  - `lists.spec.ts` "Review 02 finding 1";
  - `forms.spec.ts` AC-23 "filtering products by type".
- [ ] E11: remove `forms.spec.ts` AC-24 and AC-25 (T E11; AC 16)
- [ ] E12: add an `/order-items?item=abc` case to `list-panels.spec.ts` "bad ids open nothing".
  Remove `order-items.spec.ts` 06 AC-18 "non-numeric and unknown ids open no panel"
  (T E12; AC 16)
- [ ] E13: remove `create-dialogs.spec.ts` 08 AC-9 (T E13; AC 16)
- [ ] E14: replace `shell.spec.ts`'s 13 per-page axe tests and `forms.spec.ts` AC-30 with one
  sweep test in `shell.spec.ts`:
  - it covers the union of both page lists and both rule sets (critical, `color-contrast`,
    `label`, `select-name`, `button-name`);
  - it loads and analyses each page once.

  The panel, dialog and Order Items axe tests stay (T E14; AC 16)
- [ ] Write `tests/MOVED.md` listing every removed or merged e2e and integration test by its old
  title, with the file and title of the test that now covers it (T; AC 16, AC 18)
- [ ] Add a unit test that parses `tests/MOVED.md` and fails if a mapped target file or test
  title doesn't exist (T; AC 16)

### 13. Verify

- [ ] `npx playwright test --list` reports ≤ 145 tests, with ~144 expected. If it reports more,
  find which E-row was missed before adding anything (AC 16)
- [ ] `npm run test:integration` takes ≤ 50 s (relaxed from ≤ 25 s at PR validation) on the author's machine. Record the e2e run time in
  the implementation changelog (AC 19)
- [ ] `npm run bench:lists` exits 0, with the All and New medians ≤ 300 ms (AC 14)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`,
  `npm run build` and `npm run test:e2e` all pass. Run e2e with `PORT=3100` after the build
  (AC 20)

## Not in this feature

- **The proxy-plus-render double session check.** They're separate requests, so they can't share
  a cache. Skipping the check in the proxy for prefetches would weaken sign-out everywhere.
- **Reworking the layout's `Content` gate for parallel data fetching.**
- **`countByStatus` and detail-page queries.**
- **Client bundle size** (zod, cmdk, TanStack).
- **A database constraint or trigger for the docket–order client rule.**
- **A Neon driver smoke test.** Dropped at spec validation.
- **Keyset pagination or estimated counts.**
- **Coverage thresholds that fail CI.** They're report-only for now.
- **Moving pre-SQL integration tests to unit** (no session, unknown resource, validation).
- **Changing what the e2e tests that stay assert**, beyond the merges in E12 and E14.
