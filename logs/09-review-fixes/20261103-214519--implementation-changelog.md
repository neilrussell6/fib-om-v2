# Implementation changelog — 09-review-fixes

- Date: 20261103-214519
- Feature: 09-review-fixes
- Phase: 3 (Implementation)

## 20261103-214519 — implement

### Shared refactors (tasks §1)

- **`lib/order-items/stages.ts`:** no longer re-exports `isId`. `panel-queries.ts` and
  `panel-actions.ts` import it from `@/lib/ids` (AC 13).
- **`fieldErrorsFrom(issues)`:** added to `lib/resources/schema.ts`, replacing the loops in
  `actions.ts` and `panel-actions.ts` (AC 13).
- **`deleteUserChecked`:** takes `Queryable` (AC 13).
- **`components/resource/list-params.ts`:** new, holding `first`, `newHref`, `queryWithout`,
  `listParamsFromUrl` and `SearchParams`, moved out of `pages.tsx` with no server-only imports.

### B1 — reference API input (AC 1, AC 2)

- **`searchReferences`:** throws `UnknownKeyError` for an `id` or `clientId` that fails
  `isId`, before any SQL.
- **The reference route:** returns `400 { error: "invalid id" }` with `Cache-Control: no-store`
  and doesn't search.

### B3 — ids in actions (AC 5)

- **`saveRecord` (edit) and `deleteRecord`:** return `<singular> not found` for a malformed
  id. In `saveRecord` the check comes before validation, so no input can mask it, and neither
  action sends a query.
- **`recordOr404`:** uses `isId`.

### B2 — docket To Client rule (AC 3, AC 4)

- **`applyRules`:** takes a `Queryable` and the record id.
- **Transactions:** delivery dockets, and orders that set a docket, run `applyRules` and the
  write in one `tx()`. Other resources write as before, through a `Queryable` wrapper around
  `query`.
- **Docket edit:** locks the docket `FOR UPDATE`. A `to_client_id` with any order for another
  client refuses with "delivery docket has orders for another client".
- **Order save:** reads the docket `FOR SHARE`, so it waits for an in-flight docket edit and
  then checks against the committed To Client.
- **Note on the AC-4 test:** the written-first version held the docket `FOR UPDATE` and passed
  on the old code, because the order's foreign-key check already waits on that lock. It was
  rewritten during "write tests" to model the real race: an uncommitted To Client change. The
  rewritten test fails on the old code (no wait; it saves) and passes now (it waits, then
  refuses).

### P1 — list query (AC 6, AC 7, AC 14)

- **`lib/db/list-query.ts`:** exports its pure builder: `filterWhere(key, filters, offset)`,
  `statusCondition(key, status, param)` and `orderBy(key, sort?, dir?)`.
- **`listRecords`:** runs the ids query and `count(*)` in parallel, then
  `SELECT … WHERE id = ANY($1::bigint[])`, reordered in JS. There's no `count(*) OVER ()`, and
  `total` is the real count past the last page.
- **Order oracle:** `tests/helpers/legacy-list-query.ts` keeps the old single-statement query
  for AC 6's order comparison.
- **`Pagination`:** shows `Showing 0–0 of <total>` past the end, with Prev enabled.
- **`scripts/bench-lists.ts` (`npm run bench:lists`):**
  - creates a throwaway database and seeds 45,000 orders and 100,000 items (3 per order on the
    first 10,000, then 2);
  - times the All and New tabs (one warm-up, five runs);
  - closes the app pool, then drops the database in `finally`;
  - no workflow runs it.
- **Benchmark result:** All median **84 ms**, New median **56 ms**, limit 300 ms (AC 14 met).

### P2 — one `users` query per auth check (AC 8, AC 9)

- **`getSessionUser(userId)`:** returns `{ sessionVersion, name, email } | null`, with an `isId`
  guard. It replaces `getSessionVersion`, and `getUserDisplay` is removed.
- **`checkSessionVersion`:** takes the row lookup. A valid session gets the current name and
  email copied in; a lookup error keeps the token unchanged.
- **`lib/auth/callbacks.ts` (new):** `jwtCallback(params, lookup)` (sign-in sets `name`) and
  `sessionCallback` (exposes `user.name`). `lib/auth.ts` wires them with `getSessionUser`.
- **Sign-in name:**
  - `findUserByEmail` selects `name`.
  - `verifyCredentials` includes `name` only when it's set, so its existing exact-shape unit
    tests stay as they are.
- **`SidebarUser`:** shows `session.user.name ?? email` and makes no query.

### Code quality — Order Items on `ResourceListPage` (AC 12)

- **`ResourceListPage` props:** gains optional `loadRecord`, `renderTable`, `renderPanel`,
  `renderCreate`, `className` and `panelAttr`.
- **`OrderItemsListPage`:** now renders `ResourceListPage` with its own table, panel and create
  dialog, and has no list-loading code. The not-found toast uses `singularLabel(ui)`
  (`Order item`).

### P3 — server-given reference labels (AC 10, AC 11)

- **`FieldDef.displayLabel`:** set on `products.type_id`, `products.media_id` and
  `order_items.order_id`.
- **`referenceLabel(field, row)`:** added to `lib/resources/index.ts`.
- **`ReferenceCombobox`:**
  - takes `label`, anchored to the value it was given with;
  - a new label re-anchors after a server render;
  - with no matching label it fetches as before.
- **Labels passed in:**
  - `FieldControl` takes `refLabel`.
  - `ResourceForm` and `RecordPanel` pass `referenceLabel(f, record)`.
  - `OrderItemPanel` passes the product name and `order_number · client_name`.
- **Filter labels:** `ResourceListPage` resolves them with `searchReferences` in parallel with
  the list queries, and `FilterBar` hands them to its comboboxes.

### Coverage and CI (AC 15)

- **`vitest.config.mts`:**
  - v8 coverage, with the spec's include and exclude globs;
  - `lib/**` threshold: lines 85 / branches 75, applied through a glob that leaves out
    `lib/auth.ts` and `lib/db/index.ts`. Checked with picomatch against `git ls-files lib`;
  - lines 90 for each of the six helper files.
- **`test:coverage`:** `vitest run --coverage --project unit --project integration`.
- **`ci.yml`:** a Coverage step after the integration step, with `continue-on-error: true`, and
  an always-run upload of `coverage/`.
- **Measured:**
  - the `lib/**` group: 96.6% lines, 86.3% branches;
  - all six helper files: 100% lines;
  - `lib/auth.ts` 0% and `lib/db/index.ts` 61% (reported, outside the threshold).

  No threshold needed the fallback.

### T — integration → unit (AC 18)

- **I1:**
  - `scripts/create-user.ts` exports `createUserPreflight`, and `scripts/seed-dummy.ts` exports
    `seedPreflight`. Every check before connecting runs on an injectable environment,
    env-file directory and terminal flag, and `confirmTarget` takes `isTTY`.
  - The refusal cases moved to `tests/unit/create-user-guard.test.ts` (9) and
    `tests/unit/seed-dummy-guard.test.ts` (16).
  - Each CLI keeps one spawned refusal.
- **I2:**
  - `scripts/create-user.ts` exports `createUser(email, password)`, and `main` uses it.
  - The AC-14 cases call it in-process, and one spawned AC-14 run is kept.
  - "does not take the password from the command line" is covered by `create-user-args`.
- **I3:**
  - The invalid-value, unknown-key and status-rule cases are now unit tests of the builder
    (`tests/unit/list-query-builder.test.ts`).
  - Integration keeps "injection is data", "valid values still filter" and one invalid-value
    case.
  - The P1 rewrite was run against the full, unmoved integration suite before these cases moved.
- **I5:** `db.test` is renamed "lib/db (direct pg locally)".

### T — e2e → lower layers (AC 16, AC 17)

- **E1–E14:** done as the spec's table describes. Every removed or merged test is mapped in
  `tests/MOVED.md`, which `tests/unit/moved-map.test.ts` checks.
- **E2 cleanup:** `crud.spec` drops the eight removed cases' definitions.
- **E6 cleanup:** `list-panels` keeps the "IB" item that the Back-after-closing tests use, but
  drops its unused variable.
- **New lower-level tests:**
  - `proxy-matcher.test.ts` (Next's `unstable_doesMiddlewareMatch`, plus the handler's redirect)
  - `record-panel-fields.test.tsx`
  - `crud-lifecycle.test.ts`
  - `sign-in-action.test.ts`
- **New e2e:**
  - AC 3 is extra steps in the existing docket panel test.
  - AC 11 is one new test (`reference-labels.spec.ts`).

### Measurements

- **E2E count:** `npx playwright test --list` reports **145** tests. AC 16's cap is ≤ 145; the
  estimate was 144. The difference is E4: the old deep-link loop covered 9 resources, not 10,
  so it removed 7 tests, not 8. Every E-row is done.
- **Test counts:**

  | Layer | Before | After |
  |---|---|---|
  | unit | 277 | 396 |
  | integration | 185 | 223 |

  Both include this spec's other new tests.
- **Integration run time:**
  - `npm run test:integration`: vitest reports **43.4 s**.
  - The per-file sum (the same measure as the ~50 s baseline) is **30.2 s**.
  - That is **over AC 19's ≤ 25 s target**. What remains:
    - `seed-dummy` (6.6 s, a throwaway Atlas-migrated database);
    - bcrypt at cost 12 in `actions` (4.7 s) and in-process `createUser`;
    - the two spawned CLI tests the spec keeps (~4 s);
    - the new integration tests for B2, P1 and parity (~5 s).
  - None of these is a pyramid move.
- **E2E run time:** recorded in the test log.
- **Axe sweep fix (found on the first e2e run):** the merged sweep (E14) waited for "an h1 or a
  Sign in button". On `/login` that matched both, and Playwright's strict mode failed the
  wait. Every app page had already passed axe by then. The wait is now the page's h1, which
  `/login` also has; the axe rules are unchanged.
