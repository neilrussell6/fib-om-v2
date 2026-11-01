# Research — 06-order-items-design

- Date: 20261101-214031
- Feature: 06-order-items-design
- Phase: 1 (Spec)

## Goal

Bring the app in line with the author's Claude Design mock-up, "Order Items" (project
`338369ce-2e1a-45a7-bb17-43ffbba7c267`, file `Order Items.dc.html`), in two ways:

1. **Look.** Restyle the whole app to match the design: IBM Plex Sans and IBM Plex Mono, the
   design's palette, and a light, collapsible, grouped sidebar with the user at the bottom and no
   top bar. Every list page gets the new header, filter bar and table look.
2. **Behaviour (Order Items).** Status tabs with counts (All (12), New (5), …). Clicking a row
   opens an edit panel on the right, without leaving the list. Rows show product, size, quantity,
   due date with relative time, and a coloured status pill.

The audience is the Fibatron staff who use the order-items list every day to track production.

The design file's companion `support.js` is only the design tool's rendering runtime
(`dc-runtime`): it holds no app styles or behaviour and is ignored.

## Current state

- **Theme.** `app/globals.css:52-87` holds the web3 palette (`--primary #0780b0`,
  `--foreground #676767`, grey sidebar `#8e989b`) and the system font stack. It is mirrored in
  `lib/theme/palette.ts` and pinned by `tests/unit/theme-contrast.test.ts` (spec 01 AC-12/13).
  No web fonts are loaded (`app/layout.tsx`).
- **Shell.** `app/(app)/layout.tsx`: a 56px grey top bar (product name, email, a "Sign out"
  button) above a 240px grey sidebar (`components/app-shell/app-nav.tsx`). The sidebar is a flat,
  ungrouped list (`components/app-shell/nav-items.ts`) with a different order from the design.
  Below `md` it becomes a sheet opened from the top bar.
- **Lists.** Every list uses the shared `ResourceListPage` (`components/resource/pages.tsx:30`):
  a `PageHeader` with a "Create" button, a `FilterBar` of labelled inputs above the fields
  (`components/resource/filter-bar.tsx`), a bordered shadcn `DataTable` whose rows open the detail
  page and which has an "Edit" link per row (`components/resource/data-table.tsx`), and
  `Pagination`. Filters, sort and page all live in the URL (nuqs, `shallow: false`).
- **Order items list.** Configured at `lib/resources/index.ts:215-270`. Columns: Client, Order
  Number, Created, Due, Status (the **order's** status). Filters: Client, Order, Order Status, and
  Due/Created/dimension ranges.
- **Order items data.** `db/migrations/20261031210200_order_items.sql`: each item has 7 boolean
  production stages (`cut_status` … `assemble_status`). There is **no per-item status**. Status
  is on the order (`order_status` enum `new | complete | archived`, `20261031210100_orders.sql`).
  An order may be on a delivery docket (`orders.delivery_docket_id`). The view `order_items_v`
  (`20261031210400_display_views.sql:36`) already joins client, order dates and status, product
  name, `product_size_name` and category.
- **No line numbers.** Items have no position within their order. The design's "line 2" has to be
  derived.
- **Editing.** Only the full-page forms (`/order-items/[id]/edit`, `ResourceForm`), saved through
  the generic `saveRecord` Server Action (`lib/resources/actions.ts`). The success toast reads
  "Order Item successfully updated".
- **Users** have only `email` (no name column). The design's "Neil Russell" plus avatar initial
  has to come from the email.
- **Dates** are formatted `24 Dec 2026` (`components/resource/format.ts`), the same as the
  design. Nothing in the app is time-zone aware. Date columns stay `YYYY-MM-DD` strings
  (`lib/db/index.ts:35`).
- **Spec 04 (written, not built)** changes the same list: category-driven columns, inline stage
  toggles, and an always-shown Order Status filter (04 AC-7/8). It also edits `order_items_v`.

## The design, extracted

- **Fonts:** IBM Plex Sans 400/500/600 (UI), IBM Plex Mono 400/500 (order numbers, the panel's
  "order · line" caption). Icons: Lucide (already used through `lucide-react`).
- **Colours:** text `#1d2326`, secondary text `#5e686d`, subtle text `#7d878b`, placeholder and
  icon `#8a9397`, label `#2c3438`. Primary/link `#0f5566` (hover `#0a3b47`). Borders `#e4e7e8`
  (dividers), `#d3d8da` (inputs), `#c3c9cc` (dashed "Add filter"), `#eef0f0` (row dividers).
  Surfaces: sidebar `#f3f5f5`, hover `#e6eaeb`, table header and panel `#fafbfb`, row hover
  `#f4f7f7`, selected row `#eef5f6` with an inset 3px `#0f5566` bar, count pill `#eef0f0`. Avatar
  `#d4762a`.
- **Status pills (bg / fg):** New `#e8eef8/#2b4f8a`, In production `#fbf0dc/#8a5a12`, Ready
  `#e3f2ea/#1f6b45`, Dispatched `#eceaf6/#4b3f8a`, Archived `#eef0f0/#5e686d`.
- **Relative due:** overdue `#b3261e` ("2d overdue"), due within 7 days `#8a5a12` ("in 3d"),
  later `#5e686d`. "—" in `#8a9397` once dispatched or archived.
- **Metrics:** radius 6px (pills 10px). Controls 34px (filters), 36px (buttons), 38px (panel
  inputs). Rows 48px. Page padding 28px/32px, title 26px/600, panel title 22px/600, body 14px,
  captions 12–13px, table header 12px uppercase with letter-spacing .06em.
- **Layout:** sidebar 232px open / 64px collapsed (an icon toggle, a .18s width transition, open
  by default at ≥1280px), groups **Operations** (Dashboard, Orders, Order Items, Delivery
  Dockets), **Catalogue** (Products, Product Categories, Product Types, Product Sizes, Product
  Media), **Admin** (Clients, Users). The active item is filled `#0f5566` with white text. The
  user (avatar, name, "Sign out") is pinned to the bottom.
- **Main area:** "Order items" title plus a "New item" button. An underlined tab row, where the
  Dispatched count includes Archived. A filter row: Client ⇅, Order ⇅, "Due Next 30 days ▾",
  dashed "+ Add filter". A sticky-header grid table with columns Client (link), Order (mono),
  Product, Size, Qty (right-aligned), "Due ↓" (date and relative), Status (pill). Footer:
  "Showing 1–12 of 12" and "‹ Prev / Next ›".
- **Edit panel:** right column `min(400px, 42vw)`, min 320px, background `#fafbfb`. Header: mono
  "DMY-2578 · line 2", close ×, product (22px), client link. Body: Product (combobox), Size
  (select) beside Quantity (number, 110px), Created (read-only, grey) beside Due (date), Status
  (five chips; the selected one takes the pill colours). Footer: "View order ↗" link, Cancel,
  Save (primary).
- **Responsive:** while the panel is open, Size and Qty are hidden unless the viewport is ≥1400px
  and the sidebar is collapsed. Table min-width is 880px (all columns) or 600px (reduced).

## Prior art

- `ResourceListPage`, `FilterBar`, `DataTable`, `Pagination` and `ReferenceCombobox` are shared
  by every list. Restyling them restyles the whole app in one place.
- nuqs URL state is used for every filter. An open panel can follow the same pattern
  (`?item=<id>`) so it survives a reload and can be linked to.
- `saveRecord` plus `buildSchema` already validate and write order items. The panel can reuse
  them rather than duplicate validation.
- The `Sheet` component (`components/ui/sheet.tsx`) can host the panel on narrow screens.
- `next/font/google` (Next 16) self-hosts Google fonts without a runtime request to Google.

## Constraints & risks

- **Accessibility (spec 01 AC-13).** axe must find no contrast failures. Three design greys fail
  WCAG AA for text: `#7d878b` on `#fafbfb` (table header, 3.55:1), `#7d878b` on `#f3f5f5` (nav
  group labels, 3.36:1), and `#8a9397` on white ("Select…" placeholder and "—", 3.13:1). The
  nearest same-hue shade that passes on every design surface is `#697175` (4.51:1 on `#f3f5f5`).
  Every other design pair passes (checked: body 15.9, secondary 5.71, link and primary button
  8.36, the pills 4.99–7.43, the count pill 4.99).
- **Status model (decided by the author, 2026-11-01): derive it from stages.** There is no schema
  change. Status comes from the order status, docket link and stage booleans, so it is read-only
  in the panel, and stages are edited instead. It must be computed in SQL (the view) so tab
  counts, filtering and sorting stay on the server.
- **"Ready" depends on which stages count.** Categories choose which stages they show
  (`product_categories.show_*_status`). Counting all 7 would make items whose category hides
  stages never Ready.
- **Due in the panel edits the order.** Every item on that order moves. The UI must say so.
- **Existing tests pin the old UI.** These will need updating, not deleting: spec 01 shell tests
  (AC-9/10/12, theme-contrast), spec 02 list tests (the "Create" label, the Edit column, row click
  → detail for order items), `tests/unit/nav-items.test.tsx`.
- **Spec 04 overlap (decided: 06 is the base and 04 builds on it).** 04's "no category picked"
  column set and its always-shown Order Status filter are superseded. 04 will need a revision
  before it is built.
- **Cache Components.** The shell streams behind Suspense. Reading a sidebar-collapse cookie must
  stay inside a Suspense boundary, or it makes the whole layout dynamic.

## Open questions

- **Time zone for "today"** (relative due, the Due presets): the app has no time-zone setting.
  Australia/Sydney is assumed (en-AU formatting); the author should confirm.
- **User display name:** users have no name. Show the email's local part (e.g. "neil") or add a
  `name` column? Assumed: the email, with no schema change.
- **Default Due filter:** the mock-up shows "Next 30 days" applied. Is that the default, or just
  the example state? Assumed: example only (the default is "Any time", so nothing is hidden).
