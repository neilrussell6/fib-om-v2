# Implementation changelog — 06-order-items-design

- Date: 20261101-230158
- Feature: 06-order-items-design
- Phase: 3 (Implementation)

## 20261101-230158 — implement

**Theme (AC-1, AC-2, AC-7)**
- `app/layout.tsx`: IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500) via `next/font/google` (self-hosted), as `--font-plex-sans` / `--font-plex-mono`.
- `app/globals.css`: the design palette replaces web3, plus new tokens (`subtle-foreground`, `icon-muted`, `label`, `primary-hover`, `surface`, `row-hover`, `row-selected`, `pill`, `warning`, `avatar`, `dash`). Sidebar width and collapse CSS (cookie `data-state` or the no-cookie media query); the order-items optional-column rule (AC-17).
- `lib/theme/palette.ts`: new `palette`, `statusColors` (new / complete / archived), and `contrastPairs` covering every body-size pair, all ≥4.5:1.
- **Second colour deviation (needs author decision):** white on the design's avatar `#d4762a` is 3.27:1 and fails AC-7. The avatar uses `#b06223` (4.55:1). The AC-2 unit test written from the spec table still expects `#d4762a`, and is left unchanged pending the author.
- shadcn primitives: buttons 36px, primary teal with hover; inputs, selects and input groups 38px with `#d3d8da` borders; labels 13px/500 `--label`; read-only inputs grey.

**Users name (AC-4, AC-10)**
- Migration `20261101230000_users_name.sql` (`users.name text`, nullable) and `atlas.sum`.
- Users resource: Name field first and a Name column; the query config's select, writable and sorts. `saveRecord` trims the name and stores a blank one as `NULL`. `getUserDisplay(userId)`.

**Shell (AC-3 – AC-6)**
- `nav-items.ts`: `NAV_GROUPS` (Operations / Catalogue / Admin, with the design's icons); `NAV_ITEMS` derived from it.
- `SidebarNav` renders the groups. Links keep `aria-label` and `title` when collapsed; labels carry `sidebar-label`.
- `SidebarFrame` (client): the toggle writes the `sidebar` cookie; the no-cookie default comes from `useSyncExternalStore` (hydration-safe). `Sidebar` (server) reads the cookie inside Suspense; the fallback is the same frame in its no-cookie layout. The footer shows the avatar, the name or email, and Sign out.
- `sidebar-state.ts`: the cookie name and type, in a plain module. Importing them from the client module gave the server a client-reference proxy instead of the string, so the cookie was never read; found during the first e2e run.
- `app/(app)/layout.tsx`: full-height flex row with no top bar at ≥768px; a slim mobile bar opens the grouped nav in the sheet.

**Shared list components (AC-8, AC-9, AC-11)**
- `ResourceUi.title`, `newLabel`, `list.statusTabs`, `ColumnDef.align`; `resourceTitle` / `resourceNewLabel` helpers ("New item" on order items).
- `PageHeader` 26px/600; list pages use the title and "New …" button. `listParamsFromUrl` extracted for reuse.
- `FilterBar`: 34px inline-label controls, dashed "+ Add filter", a link-style "Clear all". The URL contract is unchanged. `ReferenceCombobox` gains a `bare` trigger.
- `DataTable`: sticky header on `--surface`, an arrow only on the active sort, 48px rows. New optional props: `onRowOpen` (no Edit column), `selectedId` (`aria-selected`, tint and inset bar), `optionalColumns`, `renderCell`, `minWidth`, per-column `align`.
- `Pagination`: "Showing a–b of n", "‹ Prev" / "Next ›" (named Previous page / Next page), and the page size.

**Order Items list (AC-12 – AC-17)**
- Columns Client (link), Order, Product, Size, Qty (right), Due, Status. Client and Order filters always shown; Order Status filter removed; new sorts.
- `due_in_days` computed in SQL against `APP_TIME_ZONE = "Australia/Brisbane"` (`lib/time.ts`); `relativeDue` helper and tone classes.
- `listRecords({ status })`, allowlisted, for `statusTabs` resources only; `countByStatus` with the same filters and no status.
- `OrderItemsListPage`, `StatusTabs` (tablist, arrow keys), `StatusPill`, `OrderItemsTable` (mono Order link to `?item=`, Due and Status cells), `NotFoundToast`.

**Edit panel (AC-18 – AC-27)**
- `lib/order-items/panel-queries.ts` (`server-only`, not a Server Actions module): `getOrderItemPanel` with correlated `line_number` and `order_item_count`, plus the category stage flags.
- `lib/order-items/panel-actions.ts` (`"use server"`, each action calls `requireSession()`): `getProductPanelInfo`, `getOrderPanelInfo`, `saveOrderItemPanel`. Save splits item and order fields, updates the item, then updates the order the item now belongs to (read back from the row) in one transaction; FK errors become field errors.
- `lib/order-items/panel-schema.ts`: shared schema (item form + order due date and status).
- `OrderItemPanel`: design layout; Product and Order comboboxes refresh Size/Stages and the order fields; status radio chips; stage toggle chips (done-but-hidden stages listed, with a note, until saved); collapsible Details and Attributes (`FieldControl` reused) that expand, count and focus errors; discard dialog; Escape; focus to the heading on open and back to the row's Order link on close; a sheet below 1024px; the "Moved to <Status>." toast with View.
- `server-only` added as a dependency.

**Tests changed outside the new spec-06 tests**
- `tests/integration/list-query.test.ts`: the spec 02 order-items test used the `order_status` filter key, which spec 06 replaces with the `status` tab param. It now uses `status: "new"` and checks the same thing.
- `tests/e2e/form-helpers.ts`: `pickReference` takes an optional scope. The panel's Order combobox shares its name with the always-shown Order filter (both required by the spec), so the panel tests scope the lookup to the panel.
- `tests/e2e/shell.spec.ts`: the sidebar locator filters to the visible element, because a hidden streamed copy is briefly in the DOM while it replaces the Suspense fallback.

## 20261101-231136 — fix

From `logs/06-order-items-design/20261101-231048--tests--FAIL.md`:

- **e2e AC-20 / AC-25 (due date not saved):** a value typed into the panel before hydration was reset when React hydrated. The panel's controls now sit in a `<fieldset disabled>` until hydration (`useSyncExternalStore` with server snapshot `false`), so nothing can be typed and lost. Playwright, like a user, waits until the controls are enabled.
- **unit AC-2 (avatar `#d4762a`):** not changed. The test matches the spec's Theme table, but that value fails AC-7 (white text 3.27:1). Flagged to the author: the spec contradicts itself, and the test is only wrong if the author picks the darker shade.
- **Author decision (20261101-235243):** the avatar uses `#b06223`. The spec Theme table and the AC-2 test value were updated to match (`logs/06-order-items-design/20261101-235243--spec-revision-changelog.md`).

## 20261102-000414 — fix

From `logs/06-order-items-design/20261102-000414--tests--FAIL.md`:

- **AC-5 (sidebar jump with a cookie):** `app/layout.tsx` gets a tiny inline `<head>` script that copies the `sidebar` cookie to `<html data-sidebar>` before first paint. `globals.css` sizes the sidebar's Suspense fallback from it, and the no-cookie media query applies only when `<html>` has no `data-sidebar`. The first paint is now correct with or without a cookie, and the shell stays static. (`suppressHydrationWarning` on `<html>`, because the script sets an attribute before React hydrates.)
- **AC-7 (faded panel buttons before hydration):** the pre-hydration fieldset keeps its controls disabled but no longer faded (`[&_:disabled]:opacity-100`). The window is a fraction of a second, and axe no longer sees low-contrast buttons.

## 20261102-002229 — fix

- **Round 3 (AC-5, AC-6 e2e flakes):** reading the sidebar's width or visibility straight after `goto` could land on React's swap from the Suspense fallback to the streamed sidebar, while a hidden copy is briefly in the DOM. That gave a 0px reading or a strict-mode duplicate. Not an implementation defect: the frame-by-frame width sampling from first paint (AC-5) stays constant. The single reads in `tests/e2e/shell.spec.ts` now use `expect.poll`, and the mobile check asserts that no visible sidebar exists. Stable over 24 repeated runs.
