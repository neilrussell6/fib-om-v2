# Implementation changelog — 07-list-panels

- Date: 20261102-110808
- Feature: 07-list-panels
- Phase: 3 (Implementation)

## 20261102-110808 — implement

**Config and data**
- `ResourceUi.titleField` on every resource, plus `recordTitle` (email fallback) and
  `singularLabel` in `lib/resources/index.ts` (AC-1, AC-6, AC-12).
- `list.statusTabs` is now `{ key, options }`: order_items `order_status`, orders and
  delivery_dockets `status` (AC-2). The orders and dockets Status filters are removed from the
  resource configs and `QUERIES` (AC-2).
- `QueryConfig.statusColumn` (server-side allowlist); `listRecords({status})` and
  `countByStatus` use it and the resource's options instead of the hard-coded `order_status`
  (AC-3).
- `FieldDef.chips` on the orders and dockets `status` fields (AC-8, AC-9).
- A shared `dueInDays()` select expression; orders now select `due_in_days` (AC-5).
- `statusColors.current` (the New pair) and the "status pill current" contrast pair (AC-4).

**Shared list pieces**
- `components/resource/status-tabs.tsx` and `status-pill.tsx` (moved from order-items) take
  `options`; `not-found-toast.tsx` takes a label (AC-2, AC-4, AC-6).
- `components/resource/panel/history.ts`: `openPanel`, `markOpenedFromList`, `closePanel`
  (back to the list when opened from it, else replace; after a save it refreshes once the Back
  navigation has landed), `clearOpenedMarker(ownHref)` (fix 2, AC-17).
- `DataTable`: the `onRowOpen` prop became `panel` (`titleKey`, `title`, `baseQuery`,
  `linkClassName`). The title cell is a link to `?item=` that calls `openPanel`; row clicks
  call `openPanel`; no Edit column (AC-1).
- `components/resource/cells.tsx` (`DueCell`, `pillCell`) and `resource-table.tsx` (per-resource
  pills and the orders Due line) (AC-4, AC-5).

**Shared panel**
- `components/resource/panel/panel-shell.tsx`: the frame moved out of the Order Items panel
  (side panel with `max-lg:hidden` for fix 3, sheet below 1024px, hydration fieldset, focus,
  Escape, discard dialog, footer) and `usePanelCloser` (fix 2). On unmount without a close it
  clears its own marker (AC-14, AC-17, AC-18).
- `panel-section.tsx`, `use-panel-errors.ts`, `status-chips.tsx`, `saved-toast.ts` (the
  "Moved to <Status>." toast with View) (AC-10, AC-13).

**Order Items**
- `order-item-panel.tsx` rebuilt on the shared parts; its item-specific content is unchanged.
- Fix 1: the panel sends `order_due_date`/`order_status` only when either is dirty;
  `panelSchema` makes them optional; `saveOrderItemPanel` leaves the order alone without them
  and returns the stored status (AC-16).
- `order-items-table.tsx` uses `DataTable`'s panel mode and the shared cells.

**Generic panel and list page**
- `components/resource/record-panel.tsx`: every edit-form field through `FieldControl`
  (with `refFilter` dependents; password optional), `chips` fields as `StatusChips`, read-only
  detail-only fields at the top, the form heading and one collapsed section per group, the
  orders/dockets client sub-link, "View <singular>" footer link. Saves through `saveRecord`;
  errors toast "Could not edit <Singular>: <message>" (AC-6 – AC-13).
- `ResourceListPage` loads `getRecord` for `?item=`, the tabs and counts for resources with
  `statusTabs`, and renders `StatusTabs`, `ResourceTable`, `RecordPanel` (keyed by id, so a tab
  or filter change keeps it and its edits) and the not-found toast. `queryWithout` and
  `isItemId` are shared with Order Items (AC-1, AC-2, AC-6, AC-14).

**Tests**
- New: `tests/unit/panel-history.test.ts`, `tests/integration/list-panels.test.ts`,
  `tests/e2e/list-panels.spec.ts`; AC-15 axe checks added to `tests/e2e/shell.spec.ts`.
- Updated for spec 07 (superseded behaviour, see spec → Impact on earlier specs):
  - `tests/unit/resources-config.test.ts`: orders/dockets filter lists without Status; the
    statusTabs objects; new titleField, recordTitle and chips checks.
  - `tests/unit/theme-contrast.test.ts`: `current` pair.
  - `tests/integration/list-query.test.ts`: the spec 02 invalid-value checks for the orders and
    dockets `status` filter now use the `status` (tab) param.
  - `tests/e2e/crud.spec.ts`: every list's row opens the panel; detail and edit pages are
    reached by URL.
  - `tests/e2e/lists.spec.ts`: the "row opens the detail page / Edit action" and "title link
    goes to the detail page" checks now expect the panel.
- Test correction (my own new test): `list-panels.test.ts` counted orders with the
  `order_number` filter `-LATE`, which is a "contains" filter and also matched `-LATER`; it
  now uses `-TODAY`.
- AC-18 is checked with the app's script chunks blocked (server HTML plus Next's inline
  streaming scripts) rather than with JavaScript disabled entirely: with JavaScript off, the
  streamed list never replaces its loading fallback, so neither panel state could be observed.
  The check is the same: before hydration the side panel is hidden at 800px and shown at 1280px.

## 20261102-111648 — fix

Failures from `20261102-111648--tests--FAIL.md`. All three were mistakes in tests written in
this phase, not in the implementation; the assertions keep their meaning.

- **AC-14 sheet:** the locator for the panel heading also matched the sheet's `sr-only`
  `SheetTitle` (an h2 "Edit client", present since spec 06). It now selects the level-2 heading
  by the record's name.
- **AC-18 (both lists):** the route that blocks the app's scripts matched every file under
  `/_next/static/chunks/`, which is also where Next serves the CSS, so `max-lg:hidden` never
  applied. It now blocks only `.js` chunks, so the server HTML is shown with its stylesheets,
  as a user sees it before hydration.

## 20261102-112821 — fix

Failure from `20261102-112821--tests--FAIL.md`, again a timing bug in a test written in this phase.

- **AC-4/AC-5 orders Due line** (and the same pattern in the AC-1 Products title-column test):
  the header texts were read with `allTextContents()` before the table rendered. Both tests now
  wait for their row first and assert the header they index by is present.
