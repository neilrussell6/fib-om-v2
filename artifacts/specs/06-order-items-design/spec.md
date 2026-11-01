# Spec — 06-order-items-design

- Date: 20261101-214031 (revised 20261101-221500)
- Feature: 06-order-items-design
- Phase: 1 (Spec)

> Source design: Claude Design project `338369ce-2e1a-45a7-bb17-43ffbba7c267`, file
> `Order Items.dc.html`. Research, including every colour and size taken from it:
> [`research.md`](research.md). Depends on `01-users-auth` (theme, shell) and `02-basic-crud`
> (lists, forms, `order_items_v`). **Built before `04-custom-behaviour`**, which then builds on
> this list and panel (see "Impact on earlier specs").
>
> **The design is a visual reference, not a field or data specification** (author, 2026-11-01).
> Fonts, colours, spacing, layout and interaction patterns come from it. The fields, statuses,
> wording and filters come from the app's real data and existing forms. For example, the design's
> status chips set the chip *style*; the statuses themselves are the real order statuses. The
> design's "Due: Next 30 days" control is not used.

## Summary

Restyle the whole app to match the "Order Items" design: IBM Plex Sans and IBM Plex Mono, the
design's palette, and a light, collapsible, grouped sidebar with the user at the bottom and no top
bar. Every list page gets the new page header, filter bar, table and footer. The Order Items list
also gets the design's behaviour:

- status tabs with counts, using the real order statuses: All / New / Complete / Archived
- design-style columns with relative due dates and coloured status pills
- clicking a row opens an edit panel on the right, without leaving the list

The panel is a complete, in-place edit form for the item, including its order's due date and
status. Users get an optional `name` so the sidebar can show a name, as in the design.

## User-visible behaviour

### Whole app

- **Type and colour.** All text uses IBM Plex Sans. Order numbers and the panel's "order · line"
  caption use IBM Plex Mono. Colours are the design's (see Design → Theme). Links are dark teal
  `#0f5566`, underlined on hover.
- **Sidebar** (≥768px), on `#f3f5f5`:
  - "Fibatron" at the top, with a collapse toggle (labelled "Collapse sidebar" or "Expand
    sidebar").
  - Navigation in three labelled groups: **Operations** (Dashboard, Orders, Order Items, Delivery
    Dockets), **Catalogue** (Products, Product Categories, Product Types, Product Sizes, Product
    Media) and **Admin** (Clients, Users). Each entry has its Lucide icon. The current section is
    filled teal with white text.
  - At the bottom: a round orange avatar with the user's initial, the user's name (or their email
    if no name is set) and a "Sign out" button.
  - **Collapsed**, the sidebar is 64px wide and shows icons only. Each icon still has its name as
    a tooltip and an accessible name. The width animates.
  - Open/collapsed is remembered per browser. Until the user chooses, it is open at ≥1280px and
    collapsed from 768px to 1279px. The sidebar never changes width while the page loads.
- **No top bar** at ≥768px. Below 768px a slim bar (menu button and "Fibatron") opens the same
  grouped navigation in a sheet, as today.
- **Every list page**:
  - **Header.** A sentence-case title (26px, semibold), e.g. "Order items", "Product categories".
    On the right, a primary "New <singular in lower case>" button, e.g. "New item" (Order Items),
    "New client", "New product size". This replaces "Create".
  - **Filter bar.** Each filter is a compact 34px control with its label inside, e.g.
    `Client  Select… ⇅`, or `Client  Acme ✕` when set (✕ clears it). Range filters (dates,
    numbers) show their From/To inputs the same way. Optional filters come from a dashed
    "+ Add filter" button. "Clear all" appears when any filter is set. Which filters exist is
    unchanged from spec 02, except on Order Items (below).
  - **Table.** No outer border. A sticky header row on `#fafbfb` with 12px uppercase labels; each
    header is a sort button, and only the active one shows an arrow (↑/↓). Rows are 48px with
    hairline dividers, a hover tint, and the identifying cell as a teal link.
  - **Footer.** "Showing a–b of n" on the left and "‹ Prev" / "Next ›" on the right, plus the page
    size control. Page size still defaults to 25 and accepts 10/25/50/100 from the URL.
  - Lists other than Order Items keep today's behaviour: a row click opens the detail page, and
    there's an Edit link per row.
- **Detail and form pages** use the new fonts, colours and controls (38px inputs with a `#d3d8da`
  border on white, 13px medium labels, primary and outline buttons as in the panel). Their layout
  and behaviour don't change.
- **Users form:** a new optional **Name** field (the first field). The Users list shows a Name
  column before Email.

### Order Items list (`/order-items`)

- **Tabs** under the header: **All**, **New**, **Complete**, **Archived**. These are the order
  statuses. Each has its count in a grey pill, e.g. `New (5)`. The active tab is underlined teal;
  the others are grey.
  - The counts reflect every other active filter but not the selected tab.
  - The selected tab is in the URL (`?status=new|complete|archived`; absent = All), and changing it
    goes back to page 1.
  - The tabs are a keyboard-operable tablist.
- **Filters:**
  - always shown: **Client** and **Order**
  - from "+ Add filter", the same as today: Due From/To, Created From/To, Type Code, Part Number,
    and Height, Width and Depth ranges
  - The **Order Status filter is removed**; the tabs replace it.
- **Columns:** Client · Order · Product · Size · Qty · Due · Status. Default sort: Due,
  descending (as today).
  - **Client** is a link to the client.
  - **Order** is the order number in mono grey, and is a link that opens the panel.
  - **Product** is the product name.
  - **Size** is the product's size name.
  - **Qty** is right-aligned, in tabular figures.
  - **Due** shows the date (`30 Oct 2026`) with a small relative line under it: "2d overdue" in
    red, "due today" or "in 3d" in amber when 0–7 days away, "in 18d" in grey when further out,
    and "—" when the order is Complete or Archived.
  - **Status** is the order status as a pill (New blue, Complete green, Archived grey).
- **Row click** (anywhere except the client link) opens that item in the **edit panel**. It does
  not open the detail page. There is no Edit column. The open row is tinted `#eef5f6` with a 3px
  teal bar on its left edge.
- While the panel is open, **Size and Qty are hidden**, unless the viewport is ≥1400px and the
  sidebar is collapsed. The table scrolls horizontally rather than squashing (min-width 880px with
  every column, 600px reduced).
- "New item" opens the existing create page.

### Edit panel

The panel holds **every field of the order item form**, plus the order's due date and status.

- **Opening.** Opening a row sets `?item=<id>` in the URL, so a reload or shared link reopens the
  same panel. The list stays in place beside it.
  - Width `min(400px, 42vw)`, at least 320px, on `#fafbfb` with a left divider.
  - Below 1024px it slides over the list as a right-hand sheet (full width below 640px).
  - Focus moves to the panel heading. Closing returns focus to the row's Order link.
  - The panel opens even if the item isn't on the current page or tab.
- **Header:**
  - a mono caption "`<order number>` · line `<n>`", where n is the item's position (by id) in its
    order
  - a close button (×, "Close")
  - the product name (22px, semibold)
  - the client as a link
- **Main fields**, in the design's layout:
  - **Product:** a searchable combobox.
  - **Order:** a searchable combobox.
  - **Size:** read-only, the selected product's size. It updates when Product changes.
  - **Quantity:** a number input, 110px wide, beside Size.
  - **Created:** read-only (grey field), the selected order's date.
  - **Due:** a date input for the selected order's due date.
  - **Status:** three chips in the design's chip style: **New**, **Complete** and **Archived**.
    The current status is filled in its pill colours. Clicking a chip selects that status.
  - Due and Status belong to the **order**. Under them, the help text "Due date and status apply
    to all N items on order X" (N = that order's item count).
  - Changing Order reloads Created, Due, Status and the help text from the newly selected order.
- **Stages:** chip toggles in the same chip style (`aria-pressed`, filled when done). It lists
  every stage the product's category shows, plus any stage that is done although the category
  hides it. A hidden stage gets the note "Not used by this category" and can be unticked. If
  nothing is listed, the section reads "No production stages for this category". Changing
  Product refreshes this list from the new category and keeps every stage's value.
- **Details,** collapsed by default: Part Number, Height, Width, Depth, Comment.
- **Attributes,** collapsed by default: the attribute fields of today's item form.
- **Footer:**
  - "View order ↗", a link to the selected order's detail page
  - **Cancel**, which closes without saving. If there are unsaved changes, it asks first with
    "Discard changes?" and the buttons Discard and Keep editing. Escape and × behave the same.
  - **Save** (primary), which validates with the same rules as the item form. It saves the item,
    then the order's due date and status if they changed, in one transaction.
- **After Save:**
  - **Success:** the panel closes, the toast "Order Item successfully updated" appears, and the
    rows and tab counts refresh.
  - **Moved out of the tab:** if the item no longer matches the current tab, the toast adds
    "Moved to <Status>." with a **View** action that switches to that tab and reopens the item.
  - **Error:** the panel stays open. Field errors show inline. Any collapsed section that holds
    an error expands, focus moves to the first field with an error, and each section header shows
    its error count (e.g. "Details · 1 error") until fixed. Other errors show as a form-level
    message.
- **Bad links.** If `?item=` is not a numeric id, or names an item that doesn't exist, no panel
  opens and the list renders normally. A missing item also shows the toast "Order item not found".

## Design

### Theme

- **Fonts:** `next/font/google` loads IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500),
  self-hosted, as the CSS variables `--font-sans` and `--font-mono`, set on `<html>` in
  `app/layout.tsx`. No runtime request goes to Google.
- **Palette:** replace the web3 palette in `app/globals.css` and `lib/theme/palette.ts`, mapped
  onto the shadcn variables so every existing component picks it up:

  | Token | Value | Use |
  | --- | --- | --- |
  | `--background` / `--card` / `--popover` | `#ffffff` | page, inputs |
  | `--foreground` | `#1d2326` | body text |
  | `--muted-foreground` | `#5e686d` | secondary text |
  | `--subtle-foreground` (new) | `#697175` | table headers, nav group labels, placeholders, "—" (the design's `#7d878b`/`#8a9397` darkened to pass AA; see research) |
  | `--icon-muted` (new) | `#8a9397` | decorative chevrons/icons only, `aria-hidden` |
  | `--label` (new) | `#2c3438` | form labels, nav items |
  | `--primary` / `--ring` | `#0f5566` | buttons, links, active nav, focus, selected-row bar |
  | `--primary-hover` (new) | `#0a3b47` | link/button hover |
  | `--primary-foreground` | `#ffffff` | |
  | `--border` | `#e4e7e8` | dividers |
  | `--input` | `#d3d8da` | control borders; dashed "Add filter" `#c3c9cc` |
  | `--muted` | `#f3f5f5` | sidebar, read-only fields |
  | `--accent` | `#e6eaeb` | hover on sidebar items and icon buttons |
  | `--surface` (new) | `#fafbfb` | table header, panel |
  | `--row-hover` / `--row-selected` (new) | `#f4f7f7` / `#eef5f6` | table rows |
  | `--pill` (new) | `#eef0f0` | count pills, row dividers |
  | `--destructive` | `#b3261e` | errors, overdue |
  | `--warning` (new) | `#8a5a12` | due within 7 days |
  | `--avatar` (new) | `#d4762a` | user avatar |
  | `--radius` | `0.375rem` (6px) | pills use 10px |

  The sidebar variables (`--sidebar*`) point at `#f3f5f5` / `#2c3438` / `#0f5566` / `#e6eaeb` /
  `#e4e7e8`. Light mode only, as before.
- **Status colours** (bg / fg), keyed by `order_status` value, in `lib/theme/palette.ts` as
  `statusColors`:
  - `new`: `#e8eef8 / #2b4f8a` (the design's "New")
  - `complete`: `#e3f2ea / #1f6b45` (the design's "Ready" green)
  - `archived`: `#eef0f0 / #5e686d` (the design's "Archived")
- `contrastPairs` is rewritten for the new palette. Every pair used for body-size text must be
  ≥4.5:1, including:
  - body, secondary and subtle text on white
  - subtle text on `#fafbfb`, `#f3f5f5` and `#eef5f6`
  - label `#2c3438` on `#fafbfb` and `#f3f5f5`
  - teal link `#0f5566` on white and on `#eef5f6`
  - white on `#0f5566`
  - overdue and warning text on white
  - the count pill
  - each of the three status pills

  The design's three failing greys are replaced by `#697175`; this is the one intended deviation
  from the design's colours.
- The fixed 16px root size stays (spec 01 AC-12).

### Shell

- `app/(app)/layout.tsx` becomes a full-height flex row: `<Sidebar>` and `<main>`. The top bar is
  removed at ≥768px and kept only as the mobile bar. The signed-in user moves into the sidebar
  footer, still inside its own Suspense boundary (it reads the session).
- **Navigation data.** `nav-items.ts` exports `NAV_GROUPS: { label, items: NavItem[] }[]` in the
  design's order. `NAV_ITEMS` stays as the flat list derived from it. The design's icons are
  `LayoutGrid`, `ShoppingCart`, `ListOrdered`, `Truck`, `Package`, `ListTree`, `Tags`, `Ruler`,
  `Layers`, `Building2` and `Users` (from `lucide-react`).
- **Collapse state.**
  - A `sidebar` cookie (`open` | `collapsed`, one year, `SameSite=Lax`) is set by the toggle.
  - With no cookie, CSS media queries decide (open ≥1280px, collapsed 768–1279px).
  - The cookie is read only inside the sidebar's Suspense boundary, so the static shell stays
    prerenderable (Cache Components).
  - The Suspense **fallback renders the full sidebar in its no-cookie layout** (same groups,
    links and media-query widths, without the user footer). The streamed sidebar replaces it and
    differs in width only when a cookie overrides the default.
- **Display name.**
  - New Atlas migration: `ALTER TABLE users ADD COLUMN name text` (nullable, expand-only).
  - The users resource gains `name` ("Name", text, optional, first on the form) and a Name list
    column. `name` is trimmed, and a blank name is saved as `NULL`.
  - The sidebar footer looks up the signed-in user's `name` by session user id, inside its
    Suspense boundary (no change to the session/JWT). It shows `name` if set and not blank, otherwise the email.
    The avatar letter is the first letter of whichever is shown, upper-cased.
  - `scripts/create-user.ts` is unchanged (name stays empty until set on the Users form).

### Shared list components

- `PageHeader`: new typography. The button label comes from `ResourceUi.newLabel`, defaulting to
  `New ${singular.toLowerCase()}`; order items set `"New item"`. Titles come from a new
  `ResourceUi.title` (sentence case), defaulting to `plural`, first letter only capitalised.
- `FilterBar`: restyled into compact inline-label controls. The URL contract is unchanged:
  filter keys, debouncing, "back to page 1", Add filter, Clear and Clear all.
- `DataTable`: restyled (the column definitions don't change). It gains optional props:
  - `onRowOpen(id)`, which replaces row → detail navigation and the Edit column when present
  - `selectedId`
  - `hiddenColumns`
  - per-column `align`
  - `render` for custom cells: the Due cell with its relative line, and the status pill
- `Pagination`: restyled into the footer described above, with the same URL params.

### Order items: data

- **No view change.** `order_items_v` already has everything the list needs: `client_id`,
  `client_name`, `order_number`, `product_name`, `product_size_name`, `quantity`,
  `order_due_date`, `order_status`, `order_date`. Window functions are deliberately kept out of
  the view (they would stop list filters being pushed down).
- **Tab filter.** The `status` URL param maps to `order_status = $1`. It is allowlisted against
  `ORDER_STATUS`: unknown values are ignored, which means All. The `order_status` filter key is
  removed from the list's filters.
- **Counts.** One extra query in the same request:
  `SELECT order_status, count(*) … GROUP BY order_status`, with the list's WHERE minus the status
  condition.
- **Relative due.** `APP_TIME_ZONE = "Australia/Brisbane"` (one constant). The list query returns
  `due_in_days = order_due_date - (now() AT TIME ZONE 'Australia/Brisbane')::date`, so server and
  client render the same text with no hydration mismatch.
- **Order items list config:**
  - columns `client_name` (link `/clients/:client_id`), `order_number`, `product_name`,
    `product_size_name`, `quantity` (right-aligned), `order_due_date`, `order_status`; all
    sortable
  - filters `client`, `order` (always shown), then Due/Created ranges, Type Code, Part Number, and
    the H/W/D ranges

### Order items: panel

- **Loading.** The list page reads `?item=` on the server.
  - If it's a valid numeric id, the page loads in one query: the item from `order_items_v`, the
    product category's seven `show_*_status` flags, and the order fields (`order_date`,
    `order_due_date`, `order_status`). It also loads two correlated counts:
    `(SELECT count(*) FROM order_items WHERE order_id = oi.order_id AND id <= oi.id) AS
    line_number` and
    `(SELECT count(*) FROM order_items WHERE order_id = oi.order_id) AS order_item_count`.
  - That data goes to a client `<OrderItemPanel>`.
  - An invalid or unknown id renders no panel (unknown: the toast "Order item not found", via a
    flag).
- **URL state.** Opening and closing use nuqs (`item`, `shallow: false`, `history: "push"`), so
  Back closes the panel. Other list params are kept.
- **Form.** react-hook-form with the zod schema from `buildSchema("order_items")` (every item form
  field, `order_id` included), extended with `order_due_date` (date, required) and `order_status`
  (enum `ORDER_STATUS`).
- **Server reads** (`lib/order-items/panel.ts`, session required, return `null` for unknown ids):
  - `getProductPanelInfo(productId)` returns `{ product_size_name, show_*_status flags }`. It is
    called when Product changes.
  - `getOrderPanelInfo(orderId)` returns `{ order_number, order_date, order_due_date,
    order_status, order_item_count, client_id, client_name }`. It is called when Order changes.
    The form's due date and status are reset to the returned values.
- **Save.** A new Server Action, `saveOrderItemPanel(id, values)`:
  1. Checks the session, and validates with the extended schema.
  2. Splits the validated values into item fields and order fields (`order_due_date`,
     `order_status`). Only the item fields go to `updateRecord`; the order fields are used only in
     step 3. A unit test checks that `updateRecord` never receives the order fields.
     In one `tx`: updates the item through the existing allowlisted `updateRecord`. `order_id` is
     validated by the schema and the foreign key, and an unknown order becomes a field error on
     Order.
  3. Then, if `order_due_date` or `order_status` differ from that order's stored values,
     `UPDATE orders SET due_date = $1, status = $2 WHERE id = <the item's order_id after the
     update>`. That id is read back from the updated item row, never taken as a separate client
     value. So moving an item to another order and changing Due in the same save changes only the
     new order.
  4. `revalidatePath("/order-items")`.
  5. Returns the existing `SaveResult` shape with the message "Order Item successfully updated",
     plus `orderStatus` so the client can show the "Moved to <Status>" toast when it no longer
     matches the active tab.
- **Unsaved-changes guard.** It uses react-hook-form's `isDirty`.
- **Stage list.** It shows the stages where the flag is true, plus those whose value is true. The
  order is fixed (Cut, Sow, Frame, Media, Wire, Package, Assemble).

### Impact on earlier specs

- **Spec 01:** AC-9 (sidebar shows Dashboard with icon; the top bar's email and Sign out) and
  AC-12 (palette values) are superseded by this spec's AC-1–AC-5. AC-10 (mobile sheet) still holds.
  AC-13 (axe, no contrast failures) still holds and is re-checked here.
- **Spec 02:**
  - AC-6's "Create button" becomes "New <singular>".
  - For Order Items, "rows open the detail page and each row has an Edit action" is replaced by
    the panel (AC-16), and its columns and filters are replaced by AC-12 and AC-14.
  - The users resource gains a Name field and column (AC-10).
  - Other lists keep AC-6 apart from the label. The affected tests are updated in this feature.
- **Spec 04 (to revise before it's built):**
  - "With no category picked" now shows this spec's columns.
  - With a category picked, the category columns and stage toggles join this table.
  - The always-shown Order Status filter (04 AC-7/8) is dropped in favour of the tabs.
  - 04's inline list toggles and this panel's Stages chips write the same columns.
- **Notcher feed (spec 04):** it reads order status (only New orders are emitted). Changing
  status from the panel affects the feed exactly as changing it on the order edit page does.

## Acceptance criteria

**Theme and shell**

1. **AC-1** Computed styles show `body` text in IBM Plex Sans and the Order cell in IBM Plex Mono.
   The font files are served from the app's own origin, and no request goes to
   `fonts.googleapis.com` or `fonts.gstatic.com`.
2. **AC-2** The palette CSS variables equal the Design → Theme table. Every `contrastPairs` entry
   used for body-size text, including those listed in Design → Theme and all three status pills,
   is ≥4.5:1 (unit test).
3. **AC-3** At 1440px the sidebar shows the groups Operations, Catalogue and Admin, with exactly
   the design's items in the design's order, each with an icon. The current page's item has
   `aria-current="page"` and the teal fill. There is no top bar.
4. **AC-4** The sidebar footer shows an avatar with the right initial and a "Sign out" button
   that signs the user out. It shows the user's name when `users.name` is set, and the email when
   it is null.
5. **AC-5** The collapse toggle switches the sidebar between 232px and 64px. Collapsed, the item
   labels are hidden but every link keeps an accessible name. After a reload the chosen state
   persists. With no cookie, the sidebar is open at 1440px and collapsed at 1024px. With no
   cookie at 1440px, the sidebar's width is the same at first paint and after the page finishes
   loading.
6. **AC-6** Below 768px the grouped navigation opens from a menu button in a sheet, is keyboard
   operable, and closes on Escape.
7. **AC-7** axe finds no critical violations and no contrast failures on the dashboard, every list
   page, an item create page, and `/order-items?item=<id>` with the panel open.

**Every list page**

8. **AC-8** Each list page shows its sentence-case title and a "New <singular in lower case>"
   button ("New item" on order items) that links to its create page.
9. **AC-9** Each list's filter controls show their label inside the control. Setting, clearing
   (✕), "+ Add filter" and "Clear all" keep spec 02's URL behaviour (spec 02 AC-9/10/11 still pass
   with updated selectors).
10. **AC-10** The Users form has an optional Name field. Saving a name persists it, and the Users
    list shows it in a Name column. The migration adds `users.name` as a nullable `text` column. Clearing the
    name and saving stores `NULL`, and the sidebar then shows the email.
11. **AC-11** The table header is sticky when the list scrolls. Only the active sort column shows
    an arrow. The footer reads "Showing a–b of n" with Prev/Next; Prev is disabled on page 1 and
    Next on the last page. Page size still defaults to 25 and accepts 10/25/50/100.

**Order Items list**

12. **AC-12** The columns are exactly Client, Order, Product, Size, Qty, Due, Status. Client links
    to `/clients/<id>`. Qty is right-aligned. The default sort is Due descending.
13. **AC-13** The tabs All, New, Complete and Archived show counts that equal the number of
    matching items under the other active filters. Selecting a tab sets `?status=…`, filters rows
    by order status, resets to page 1, and survives a reload. An unknown `status` value behaves as
    All.
14. **AC-14** The always-shown filters are Client and Order. Due and Created are From/To range
    filters available from "+ Add filter". There is no Order Status filter.
15. **AC-15** The Due cell shows the date and one relative line, computed against today in
    `Australia/Brisbane`:
    - "Nd overdue" in red
    - "due today" or "in Nd" in amber, when 0–7 days away
    - "in Nd" in grey, when more than 7 days away
    - "—" when the order is Complete or Archived

    The test checks each case with a fixed clock. Each status pill uses its `statusColors` pair.
16. **AC-16** Clicking a row (outside the client link) or activating its Order link opens the
    panel, sets `?item=<id>`, marks the row selected, and does not navigate to the detail page.
    The Order link is reachable by keyboard. There is no Edit column.
17. **AC-17** With the panel open at 1280px and the sidebar open, Size and Qty are hidden. At
    1440px with the sidebar collapsed they are shown.

**Edit panel**

18. **AC-18** Loading `/order-items?item=<id>` opens the panel, even when the item is outside the
    current page or tab. It shows:
    - the caption "`<order number>` · line `<n>`" (n = the item's position by id within its order)
    - the product name and a client link
    - Product, Order, Size (read-only), Quantity, Created (read-only), Due, and the Status chips
      New/Complete/Archived with the current one selected
    - the help text with the order's item count
    - Stages, Details and Attributes, which together hold every field of the order-item form

    A non-numeric or unknown id opens no panel, and the unknown id shows "Order item not found".
19. **AC-19** Changing Quantity and saving persists it. The panel closes, the toast "Order Item
    successfully updated" appears, and the row shows the new value without a manual reload.
20. **AC-20** Changing Due or Status and saving updates the order's `due_date` or `status`. Every
    item of that order then shows the new value, and the tab counts update.
21. **AC-21** Changing Order reloads Created, Due, Status and the help text from the new order.
    Saving moves the item to that order. Moving an item and changing Due in the same save updates
    the new order's `due_date` and leaves the old order's unchanged. Choosing an order id that
    doesn't exist (sent directly) returns a field error on Order and writes nothing.
22. **AC-22** Changing Product updates Size and the Stages list from the new product's category,
    and keeps every stage's value. A stage that is done but hidden by the category is listed with
    "Not used by this category". Unticking it and saving clears it.
23. **AC-23** An invalid value in a collapsed section (e.g. an empty Part Number) keeps the panel
    open, expands that section, focuses the field, shows its error, and shows the error count on
    the section header. Nothing is written. If the order update fails, the item update is rolled
    back too.
24. **AC-24** With unsaved changes, Cancel, × and Escape ask "Discard changes?". Without changes
    they close at once. Closing removes `?item` and returns focus to the row's Order link. Browser
    Back closes an open panel.
25. **AC-25** On the New tab, setting Status to Complete and saving shows "Order Item successfully
    updated. Moved to Complete." with a View action. View switches to the Complete tab with that
    item's panel open.
26. **AC-26** "View order" links to `/orders/<order id>`. Below 1024px the panel opens as a sheet
    over the list.
27. **AC-27** `saveOrderItemPanel`, `getProductPanelInfo` and `getOrderPanelInfo` reject calls
    without a session.

## Out of scope

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

## Open questions

None. The time zone (Australia/Brisbane), display name (new `users.name`), status model (order
status) and Due filter (ordinary range) were decided by the author on 2026-11-01.
