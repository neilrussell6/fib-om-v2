# Tasks — 06-order-items-design

- Date: 20261101-221557
- Feature: 06-order-items-design
- Phase: 2 (Tasks)

Built from `artifacts/specs/06-order-items-design/spec.md` (with `research.md` for the design's
measurements). References in brackets point at the spec's acceptance criteria (AC n) or Design
sections.

## Tasks

### 1. Theme

- [ ] Load IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500) with `next/font/google` in
  `app/layout.tsx`, exposed as `--font-sans` / `--font-mono` on `<html>`. Drop the system
  font stack from `globals.css` and add a `font-mono` utility mapping (Design: Theme; AC 1)
- [ ] Replace the web3 values in `app/globals.css` `:root` with the Design → Theme table. Add the
  new tokens (`--subtle-foreground`, `--icon-muted`, `--label`, `--primary-hover`, `--surface`,
  `--row-hover`, `--row-selected`, `--pill`, `--warning`, `--avatar`) to `:root` and `@theme
  inline`. Point the `--sidebar*` variables at the design's sidebar colours. Remove
  `--primary-dark` / `--primary-light` / `--muted-large`, updating every use (grep
  `primary-dark`, `muted-large`) to the new tokens (Design: Theme; AC 2)
- [ ] Rewrite `lib/theme/palette.ts`: the new `palette` values, `statusColors` keyed by
  `new` / `complete` / `archived`, and `contrastPairs` covering every body-size pair listed in
  Design → Theme (body/secondary/subtle on white; subtle on `#fafbfb`/`#f3f5f5`/`#eef5f6`;
  label on `#fafbfb`/`#f3f5f5`; teal on white and `#eef5f6`; white on teal; overdue and warning
  on white; count pill; three status pills) (Design: Theme; AC 2)
- [ ] Restyle the shadcn primitives in `components/ui/` that carry their own sizes and colours
  (`button`, `input`, `select`, `textarea`, `label`, `badge`, `checkbox`, `switch`, `table`,
  `popover`, `command`, `dropdown-menu`, `dialog`, `alert-dialog`, `sheet`) to the design's
  metrics: buttons 36px with 6px radius, primary teal with `--primary-hover`, outline with a
  `#d3d8da` border; inputs 38px, `#d3d8da` border on white; labels 13px/500 in `--label`
  (User-visible behaviour: detail and form pages; Design: Theme)

### 2. Users name (migration first: the shell reads it)

- [ ] Add an Atlas migration `ALTER TABLE users ADD COLUMN name text` (nullable) and update
  `atlas.sum` (`npm run db:hash`) (Design: Shell → Display name; AC 10)
- [ ] Users resource: add a `name` field ("Name", text, optional, first on the form), a Name list
  column before Email, `name` in the users query config's `select`, `writable` and `sorts`,
  and `name` in `UserRow` (Design: Shell → Display name; AC 10)
- [ ] In `saveRecord`'s users rule (`lib/resources/actions.ts`), trim `name` and turn a blank name
  into `NULL` (Design: Shell → Display name; AC 10)
- [ ] Add `getUserDisplay(userId)` to `lib/db/queries/users.ts`, returning `{ name, email }` for
  the sidebar (Design: Shell → Display name; AC 4)

### 3. Shell

- [ ] In `components/app-shell/nav-items.ts`, export `NAV_GROUPS` (Operations: Dashboard, Orders,
  Order Items, Delivery Dockets; Catalogue: Products, Product Categories, Product Types,
  Product Sizes, Product Media; Admin: Clients, Users) with the design's icons (`LayoutGrid`,
  `ShoppingCart`, `ListOrdered`, `Truck`, `Package`, `ListTree`, `Tags`, `Ruler`, `Layers`,
  `Building2`, `Users`). Derive `NAV_ITEMS` from it (Design: Shell → Navigation data; AC 3)
- [ ] Rewrite `SidebarNav` to render the groups: 11px uppercase group labels in
  `--subtle-foreground`, 34px items with the icon at 17px, the active item filled `--primary`
  with white text and `aria-current="page"`, hover `--accent`. In collapsed mode, hide labels
  and group headings but keep each link's accessible name and a `title` tooltip (AC 3, AC 5)
- [ ] Add the sidebar collapse state:
  - a `sidebar` cookie (`open` | `collapsed`, one year, `SameSite=Lax`)
  - a client toggle button labelled "Collapse sidebar" / "Expand sidebar" that writes the cookie
    and flips a `data-state` attribute
  - CSS that sizes the sidebar at 232px / 64px with a .18s width transition. With no
    `data-state`, a media query picks open at ≥1280px and collapsed from 768px to 1279px

  (Design: Shell → Collapse state; AC 5)
- [ ] Build `<Sidebar>`: "Fibatron" title, toggle, groups, and a footer slot. Read the cookie only
  inside a Suspense boundary. The Suspense fallback renders the same sidebar (groups, links,
  media-query width) with no cookie state and no user footer (Design: Shell → Collapse state;
  AC 5)
- [ ] Build the sidebar user footer, a server component inside its own Suspense boundary:
  - `requireSession()`, then `getUserDisplay`
  - shows the name if set and not blank, otherwise the email
  - a 30px round `--avatar` circle with the upper-cased first letter of what's shown
  - the existing `SignOutButton`, restyled as the design's small "Sign out" text button

  (Design: Shell → Display name; AC 4)
- [ ] Rewrite `app/(app)/layout.tsx` as a full-height flex row of `<Sidebar>` and `<main>`.
  Remove the top bar at ≥768px. Keep a slim mobile bar (<768px: menu button and "Fibatron")
  opening the grouped `SidebarNav` in the existing `Sheet`. `main` gets the design's padding
  and background (Design: Shell; AC 3, AC 6)

### 4. Shared list components

- [ ] Extend `ResourceUi` with optional `title` (default: `plural` with only its first letter
  capitalised) and `newLabel` (default: `New ${singular.toLowerCase()}`). Set `newLabel: "New
  item"` on order items. Also add `list.statusTabs?: boolean` to `ResourceUi` and set it to
  `true` on order items (Design: Shared list components; AC 8, AC 13)
- [ ] Restyle `PageHeader` (26px/600 title, `items-end` row, design padding) and switch
  `ResourceListPage` to `ui.title` and `ui.newLabel` for the button, rendered as a primary
  `LinkButton` (AC 8)
- [ ] Restyle `FilterBar` into compact 34px inline-label controls:
  - reference: `Label Select… ⇅`, or the value with a ✕ clear button
  - select and text: the label inside the control
  - date and number ranges: each From/To input with its label inside
  - "+ Add filter": dashed `#c3c9cc` border
  - "Clear all": a text button

  Keep the URL contract, ids, debouncing and accessible names unchanged (Design: Shared list
  components; AC 9)
- [ ] Restyle `ReferenceCombobox`'s trigger so it can render in the inline-label form (label
  prop shown inside the trigger, `--subtle-foreground` placeholder, `--icon-muted` chevron)
  (AC 9)
- [ ] Restyle `DataTable`:
  - no outer border
  - sticky header row on `--surface` with 12px uppercase `--subtle-foreground` labels; header
    sort buttons show an arrow only on the active column
  - 48px rows with `--pill` dividers and `--row-hover`; the identifying cell and link cells in
    teal

  Keep the existing behaviour (row → detail, Edit link) when `onRowOpen` isn't passed (Design:
  Shared list components; AC 11)
- [ ] Add optional `DataTable` props:
  - `onRowOpen(id)`: replaces row navigation and removes the Edit column
  - `rowLink(row)`: the href for the identifying cell, so Order Items can point it at
    `?item=<id>`
  - `selectedId`: `--row-selected` background plus an inset 3px `--primary` bar
  - `hiddenColumns`
  - per-column `align: "right"` with tabular figures
  - per-column `render(row)` for custom cells
  - `minWidth`, with the wrapper scrolling horizontally

  (Design: Shared list components; AC 16, AC 17)
- [ ] Restyle `Pagination` into the footer: "Showing a–b of n" (or "No results"), "‹ Prev" and
  "Next ›" (disabled on the first and last page), and the page-size control, using the same
  URL params (AC 11)

### 5. Order Items list

- [ ] Add `APP_TIME_ZONE = "Australia/Brisbane"` (e.g. `lib/time.ts`) (Design: Order items: data;
  AC 15)
- [ ] Order items query config: add sorts for `product_name`, `product_size_name` and `quantity`.
  Remove the `order_status` filter. Make `select` add
  `order_due_date - (now() AT TIME ZONE '<APP_TIME_ZONE>')::date AS due_in_days` (Design: Order
  items: data; AC 12, AC 15)
- [ ] Order items UI config: columns `client_name` (link `/clients/:client_id`), `order_number`,
  `product_name`, `product_size_name` (label "Size"), `quantity` (label "Qty", right-aligned),
  `order_due_date` (label "Due"), `order_status` (label "Status"). Default sort `order_due_date`
  desc. Filters: `client` and `order` always shown, then Due/Created ranges, Type Code, Part
  Number, H/W/D ranges. Drop the `order_status` filter (Design: Order items: data; AC 12, AC 14)
- [ ] Extend `listRecords` with an optional `status` param, allowlisted against `ORDER_STATUS`
  (unknown values are ignored), adding `order_status = $n::order_status`. Add
  `countByStatus(key, filters)`: one `SELECT order_status, count(*) … GROUP BY order_status`
  with the same filter WHERE and no status condition. Both are enabled only for resources that
  declare `statusTabs` (order items) (Design: Order items: data; AC 13)
- [ ] Add a `StatusTabs` client component: a tablist of All / New / Complete / Archived, each with
  a count pill. The active tab is underlined `--primary`. It writes `?status=` through nuqs
  (`shallow: false`), clearing `page`, and is keyboard operable (arrow keys, Enter/Space)
  (User-visible behaviour: Tabs; AC 13)
- [ ] Add the Due cell renderer: the date (`formatDate`) with a 12px relative line from
  `due_in_days`. Overdue → "Nd overdue" (`--destructive`); 0 → "due today" (`--warning`); 1–7 →
  "in Nd" (`--warning`); more than 7 → "in Nd" (`--muted-foreground`); order status complete or
  archived → "—" (`--subtle-foreground`). Write it as a pure `relativeDue(dueInDays, status)`
  helper (AC 15)
- [ ] Add a `StatusPill` component using `statusColors` (12px/500, 10px radius) for the Status
  column and the panel (AC 15)
- [ ] Add an `OrderItemsListPage` used by `app/(app)/order-items/page.tsx`. It builds on the
  shared pieces:
  - header with "New item"
  - `StatusTabs` with counts
  - `FilterBar`
  - `DataTable` with `onRowOpen`, an Order cell (IBM Plex Mono, `--muted-foreground`) linking to
    `?item=<id>`, a Client link that stops propagation, the Due and Status renderers,
    `selectedId` from `?item`, and min-width 880px or 600px
  - `Pagination`

  Other list params are kept on open (User-visible behaviour: Order Items list; AC 12, AC 16)
- [ ] Hide Size and Qty while the panel is open unless the viewport is ≥1400px and the sidebar is
  collapsed. Use CSS driven by the sidebar's `data-state` and a media query, so nothing reflows
  after hydration (AC 17)

### 6. Edit panel

- [ ] Add `lib/order-items/panel-queries.ts` (`import "server-only"`, **not** `"use server"`, so
  nothing in it is callable from the browser):
  - `getOrderItemPanel(id)`, used only by the list page (behind `requireSession()`): one query of the item from `order_items_v`, the category's seven
    `show_*_status` flags, `order_date`, `order_due_date` and `order_status`, plus the
    correlated `line_number` and `order_item_count` subqueries from Design → Order items: panel.
    Returns `null` for a non-numeric or unknown id
- [ ] Add `lib/order-items/panel-actions.ts` (`"use server"`): `getProductPanelInfo(productId)`
  and `getOrderPanelInfo(orderId)`, each calling `requireSession()` first and returning `null`
  for unknown ids

  (Design: Order items: panel; AC 18, AC 21, AC 22, AC 27)
- [ ] In `OrderItemsListPage`, read `?item=` on the server and call `getOrderItemPanel`. Valid →
  render `<OrderItemPanel>` beside the list. Unknown numeric id → no panel, and pass a flag that
  shows the toast "Order item not found". Non-numeric → no panel, no toast (AC 18)
- [ ] Build the `<OrderItemPanel>` frame:
  - width `min(400px, 42vw)`, min 320px, `--surface` background, left border
  - below 1024px, rendered in the right-hand `Sheet` instead (full width below 640px)
  - the header: mono "`<order number>` · line `<n>`" caption, × Close, 22px product name,
    client link
  - the footer: "View order ↗" (`/orders/<order id>`), Cancel, Save
  - on open, focus the heading; on close, return focus to the row's Order link
  - open and close through nuqs `item` (`shallow: false`, `history: "push"`), so Back closes it

  (User-visible behaviour: Edit panel; AC 18, AC 24, AC 26)
- [ ] Build the panel form: react-hook-form plus a zod schema of `buildSchema("order_items")`
  extended with `order_due_date` (date, required) and `order_status` (`ORDER_STATUS` enum),
  with defaults from the loaded row. Main fields in the design's layout:
  - Product and Order: `ReferenceCombobox`
  - Size: read-only
  - Quantity: number input, 110px wide, beside Size
  - Created: read-only, grey
  - Due: date input
  - Status: three chips New / Complete / Archived in the design's chip style, the selected one
    filled with its `statusColors`
  - under Due and Status, the help text "Due date and status apply to all N items on order X"

  (User-visible behaviour: Edit panel; AC 18)
- [ ] When Product changes, call `getProductPanelInfo`, update Size and the category stage flags,
  and keep every stage value. When Order changes, call `getOrderPanelInfo` and reset Created,
  Due, Status, the help text, the caption's order number, the client link and the "View order"
  target to the new order's values (AC 21, AC 22)
- [ ] Add the Stages section: chip toggles (`aria-pressed`, a text label, filled when done) in the
  fixed order Cut, Sow, Frame, Media, Wire, Package, Assemble. List a stage when its category
  flag is true or its value is true. A shown-but-hidden stage gets "Not used by this category".
  Show "No production stages for this category" when nothing is listed (User-visible behaviour:
  Stages; AC 22)
- [ ] Add the collapsible Details (Part Number, Height, Width, Depth, Comment) and Attributes
  (every `group: "Attributes"` field of the item form) sections, collapsed by default, reusing
  the existing field renderers from `ResourceForm` (extract them if needed) (User-visible
  behaviour: Edit panel; AC 18)
- [ ] Add `saveOrderItemPanel(id, values)` (Server Action):
  1. `requireSession()` and validate with the extended schema.
  2. Split item fields from order fields (`order_due_date`, `order_status`).
  3. In one `tx`: `updateRecord("order_items", id, itemFields, client)`. Then read
     `order_id, due_date, status` for the item's order after the update (by joining from the
     item row). If the due date or status differ, `UPDATE orders SET due_date, status WHERE id =
     <that order id>`.
  4. Map FK errors on `order_id` / `product_id` to field errors, using `mapDbError`.
  5. `revalidatePath("/order-items")`.
  6. Return `SaveResult` with "Order Item successfully updated" plus `orderStatus`.

  (Design: Order items: panel → Save; AC 19, AC 20, AC 21, AC 23, AC 27)
- [ ] Wire Save in the panel:
  - on success: close the panel, show the toast, and if `orderStatus` no longer matches the
    active `status` tab, append "Moved to <Status>." with a View action that sets
    `?status=<orderStatus>&item=<id>`
  - on field errors: show them inline, expand each collapsed section that holds one, show
    "<Section> · N error(s)" on its header, and focus the first error
  - on other errors: show a form-level message

  (User-visible behaviour: After Save; AC 19, AC 23, AC 25)
- [ ] Add the unsaved-changes guard: Cancel, × and Escape close at once when the form isn't
  dirty. Otherwise they open an `AlertDialog` "Discard changes?" with Discard / Keep editing
  (AC 24)

### 7. Tests

Unit (vitest):

- [ ] Rewrite `tests/unit/theme-contrast.test.ts`: `palette` equals the new values, and every
  body-size `contrastPairs` entry, including the three status pills and the pairs listed in
  Design → Theme, is ≥4.5:1 (AC 2)
- [ ] Update `tests/unit/nav-items.test.tsx`: `NAV_GROUPS` has exactly the three groups, items and
  icons in order, and `NAV_ITEMS` is the flattened list (AC 3)
- [ ] `relativeDue`: overdue, due today, 1–7 days, more than 7 days, and complete/archived → "—",
  each with the right colour token (AC 15)
- [ ] `ResourceUi` defaults: `title` and `newLabel` for every resource ("New item" for order
  items, "New product size", "Product categories") (AC 8)
- [ ] Update `tests/unit/resources-config.test.ts` for the new order-items columns, filters and
  sorts, the users `name` field, and `statusTabs` set only on order items (AC 10, AC 12,
  AC 13, AC 14)

Integration (vitest, test database):

- [ ] Migration: `users.name` exists, nullable `text`. Saving a user with a blank name stores
  `NULL` (AC 10)
- [ ] `listRecords("order_items", { status })` filters by order status, and an unknown status is
  ignored. `countByStatus` returns counts that respect other filters and ignore the status
  (AC 13)
- [ ] `due_in_days`: compute today in `APP_TIME_ZONE` with
  `Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" })`, insert orders due today,
  today − 2 and today + 10, and check `due_in_days` is 0, −2 and 10. Retry once if the date
  changed during the run (AC 15)
- [ ] `getOrderItemPanel`: `line_number` is the position by id within the order,
  `order_item_count` is right, the category flags are returned, and non-numeric or unknown ids
  return `null` (AC 18)
- [ ] `saveOrderItemPanel`:
  - a quantity change persists (AC 19)
  - a due date or status change updates the order (AC 20)
  - moving the item and changing Due in one save updates only the new order (AC 21)
  - an unknown `order_id` gives a field error and writes nothing (AC 21)
  - a failing order update rolls back the item update (AC 23)
  - `updateRecord` never receives the order fields: assert with a spy (Design: Save step 2)
  - calls without a session are rejected, as are calls to `getProductPanelInfo` and
    `getOrderPanelInfo`; `lib/order-items/panel-queries.ts` contains no `"use server"`
    directive (AC 27)

E2E (Playwright, dummy seed data):

- [ ] Update `tests/e2e/shell.spec.ts`:
  - fonts: computed font families for body and the Order cell, and no requests to
    `fonts.googleapis.com` or `fonts.gstatic.com` (AC 1)
  - palette variables (AC 2)
  - groups, items and `aria-current` at 1440px, with no top bar (AC 3)
  - the footer avatar, name or email fallback, and Sign out (AC 4)
  - collapse toggles 232px ↔ 64px, accessible names kept, persisted over a reload; no-cookie
    defaults at 1440px and 1024px; width at first paint equals width after load at 1440px
    (AC 5)
  - mobile sheet (AC 6)
- [ ] Update the axe test to cover the dashboard, every list page, an item create page and
  `/order-items?item=<id>` (AC 7)
- [ ] Update `tests/e2e/lists.spec.ts` and `crud.spec.ts`:
  - titles and the "New …" buttons (AC 8)
  - inline-label filters with spec 02's filter behaviour (AC 9)
  - sticky header, single sort arrow, footer text and Prev/Next disabled states, page sizes
    (AC 11)
  - order items no longer expects row → detail or an Edit column
- [ ] Users e2e: set a name and see it in the Users list and sidebar; clear it and see the email
  (AC 4, AC 10)
- [ ] New `tests/e2e/order-items.spec.ts`, list:
  - exact columns, the Client link, Qty right-aligned, default sort (AC 12)
  - tabs and counts with and without a client filter, `?status` in the URL, page reset, reload,
    unknown status (AC 13)
  - always-shown filters and no Order Status filter (AC 14)
  - a Due cell and a status pill colour (AC 15)
  - row click and Order link open the panel with `?item`, the row is selected, there is no
    navigation, and keyboard reach (AC 16)
  - Size/Qty hidden at 1280px with the panel open, and shown at 1440px with the sidebar
    collapsed (AC 17)
- [ ] `tests/e2e/order-items.spec.ts`, panel:
  - deep link contents, plus non-numeric and unknown ids and the toast (AC 18)
  - `?status=archived&item=<id of an item on a New order>`: the panel opens with that item, no
    row is selected, and closing keeps the Archived tab (AC 18)
  - a quantity save, toast and row update (AC 19)
  - a Due/Status save updating every item of the order and the counts (AC 20)
  - changing Order reloads the order fields and saves the move (AC 21)
  - changing Product updates Size and Stages; a hidden done stage can be unticked (AC 22)
  - an empty Part Number expands Details with an error count and focus (AC 23)
  - the discard dialog, focus return, and Back closing the panel (AC 24)
  - the "Moved to Complete." toast and its View action (AC 25)
  - "View order", and the sheet at 900px (AC 26)

### 8. Finish

- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` and
  `npm run test:e2e`, and fix failures (all ACs)

## Not in this feature

- A per-item status, or a status derived from stages. Status is the order status (decided
  2026-11-01).
- The design's Due preset ("Next 30 days"). Due and Created stay ordinary range filters.
- Spec 04's category-driven columns and inline list stage toggles. They come later, on top of this
  list.
- Edit panels on lists other than Order Items.
- A redesign of detail and form page layouts (only their styling changes).
- Dark mode.
- A `--name` option for `scripts/create-user.ts`, and profile self-editing.
- The design's "Variations" file (`Order Items Variations.dc.html`).
