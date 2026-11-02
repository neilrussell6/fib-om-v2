# Spec — 07-list-panels

- Date: 20261102-090834 (revised 20261102-093758, 20261102-102139)
- Feature: 07-list-panels
- Phase: 1 (Spec)

> Research: [`research.md`](research.md). Depends on `02-basic-crud` (resources, forms,
> `saveRecord`) and `06-order-items-design` (theme, list styling, the Order Items panel, tabs and
> pills). Built before `04-custom-behaviour`, which needs a revision for 06 and 07 before it is
> implemented.
>
> The "Order Items" design is a visual reference only (`designs-are-visual-reference`). It shows
> only Order Items, so the other panels apply its patterns to each resource's real form fields.

## Summary

Give every other list the behaviour spec 06 gave Order Items:

- **Click to edit.** Clicking a row on Orders, Delivery Dockets, Clients, Products, Product
  Categories, Product Types, Product Sizes, Product Media or Users opens a right-hand edit panel
  holding every field of that resource's form. Below 1024px it is a sheet over the list.
- **Status tabs.** Orders (All / New / Complete / Archived) and Delivery Dockets (All / Current /
  Archived) get tabs with counts in place of their Status filter.
- **Pills and relative due.** Status columns on Orders and Delivery Dockets become coloured pills,
  and the Orders Due column gets the relative line ("2d overdue", "in 3d").

The panel mechanics move out of the Order Items panel into shared components, so every panel
behaves the same. Three fixes from the 06 review go into them:

1. An Order Items panel only writes the order's due date and status when the user changed them.
2. Closing a panel that was opened from the list leaves no extra history entry.
3. Below 1024px, no side panel flashes before the sheet appears.

Decisions taken in this spec (the author can overturn them at spec validation):

- The docket **Current** pill reuses the **New** blue pair; both mean "active".
- Panels have **no Delete**. Delete stays on the edit page, reached through the panel's
  "View <singular>" link to the detail page.
- The Orders panel holds the order form's fields only. Spec 04 puts the order's items on the
  order detail page.
- Every list uses the same URL key as Order Items: `?item=<id>`.

## User-visible behaviour

### Every list except Order Items

Order Items keeps everything spec 06 gave it, plus the three fixes below.

- **Row click** (anywhere except another link in the row) opens that record in the edit panel and
  sets `?item=<id>`. It no longer opens the detail page, and **there is no Edit column**. The open
  row is tinted `#eef5f6` with the 3px teal bar, as on Order Items.
- The **title cell** is a teal link that opens the panel and is reachable by keyboard. It is the
  column holding the resource's title field (see Design → Config): Order Number on Orders, Docket
  Number on Delivery Dockets, Name on Clients, Products and the four product lookups, and Name on
  Users. A user with no name shows their email in that cell, so the link always has text. Other
  link cells, such as Orders' Client, still go to their page.
- While the panel is open the table keeps all its columns and scrolls horizontally rather than
  squashing.
- "New <singular>" still opens the create page. Detail, edit and create pages are unchanged and
  still reachable by URL.

### Status tabs: Orders and Delivery Dockets

- **Orders:** tabs **All**, **New**, **Complete** and **Archived**. **Delivery Dockets:** tabs
  **All**, **Current** and **Archived**. They look and behave exactly like the Order Items tabs:
  - Each tab shows its count, and the counts reflect every other active filter.
  - The selected tab is in the URL (`?status=…`, absent = All). Changing tab goes back to page 1.
    An unknown value behaves as All.
  - The tabs form a keyboard-operable tablist.
- The **Status filter is removed** from both lists, because the tabs replace it. Every other
  filter is unchanged.

### Pills and relative due

- The **Status** column on Orders and Delivery Dockets shows a pill: New blue, Complete green,
  Archived grey, Current blue.
- The Orders **Due** column shows the date with the same relative line as Order Items, computed
  against today in `Australia/Brisbane`:
  - "Nd overdue" in red
  - "due today", or "in Nd" in amber when 0–7 days away
  - "in Nd" in grey when further out
  - "—" when the order is Complete or Archived

### The edit panel (all lists)

The panel uses the same frame as the Order Items panel:

- **Size and placement:**
  - `min(400px, 42vw)` wide and at least 320px, on `#fafbfb`, beside the list.
  - Below 1024px it is a right-hand sheet, full width below 640px.
  - It opens even when the record isn't on the current page or tab.
- **Header:**
  - a small grey caption with the singular name (e.g. "Order", "Product category")
  - × ("Close")
  - the record's title field as the heading: the order number, docket number, client name,
    product name, category, type, size or media name, or the user's name (the email when there is
    no name).
  - Orders also show the client, and Delivery Dockets the To client, as a link under the heading.
- **Read-only values.** Fields that show on the detail page but aren't on the form appear as
  read-only grey inputs at the top, as Created does on Order Items:
  - Orders: Created
  - Delivery Dockets: Docket Number, Date and From Client
- **Fields.** Every field of the resource's edit form, with the same controls, rules and
  dependencies as the edit page:
  - Ungrouped fields come first, in form order.
  - Each form group is a collapsible section, collapsed by default, with the same error count and
    focus behaviour as Order Items' Details and Attributes. On Product Categories the 13 flag
    groups are 13 sections under the form heading, "Columns to show on Order Items page (for this
    category)".
  - The **Status** field on Orders and Delivery Dockets shows as chips in the pill colours, like
    the Order Items panel.
  - Orders' Delivery Docket is still narrowed to the chosen client, and changing Client still
    clears it.
  - Users' Password is optional. Left blank, the current password stays. As on the edit page, a
    new password signs that user out everywhere. If you set your own, the save succeeds and you
    are signed out and taken to the login page. That is expected, not a panel bug.
- **Footer:**
  - "View <singular in lower case> ↗", a link to the detail page (e.g. "View order", "View
    client"), where Edit, Delete and Print remain
  - **Cancel**
  - **Save**
- **Closing.** Cancel, × and Escape close the panel. If there are unsaved changes they first ask
  "Discard changes?" (Discard / Keep editing). Closing removes `?item` and returns focus to the
  row's title link.
- **Changing the list with a panel open.** Changing tab, filter, sort or page keeps the panel
  open, with its unsaved edits, even if the record no longer appears in the list.
- **Save** uses the same Server Action and rules as the edit page. Then:
  - **Success:** the panel closes, the toast "<Singular> successfully updated" appears, and the
    rows and tab counts refresh.
  - **Moved out of the tab:** on Orders or Delivery Dockets, if the record no longer matches the
    current tab, the toast adds "Moved to <Status>." with a View action. View switches to that tab
    with the panel open.
  - **Error:** the panel stays open with field errors inline. Sections that hold an error expand,
    and focus moves to the first field with an error. Other errors show in the error toast
    "Could not edit <Singular>: <message>" (e.g. "Could not edit Order: delivery docket belongs
    to another client"), and nothing is written.
- **Bad links.** A non-numeric `?item=` opens no panel. An unknown id opens no panel and shows
  "<Singular> not found".

### Fixes to every panel, Order Items included (06 review follow-ups)

1. **No stale order writes.** The Order Items panel sends the order's Due and Status only when the
   user changed them, or changed Order. Otherwise the save leaves the order untouched. A
   colleague's change to the order's due date or status, made after the panel opened, survives a
   save that only changed, say, Quantity.
2. **Back after closing.** When a panel was opened from the list (a row, its title link, or the
   toast's View action), closing it, including after Save, returns to the previous history entry
   instead of adding one. The next Back then leaves the list, as it would have before the panel
   opened. After a Save the list then reloads its data, so the rows and counts show the saved
   values. In these cases closing replaces the URL as today, so it never navigates away from the
   app:
   - the panel was opened by loading a `?item=` URL directly (a reload or a shared link)
   - the list's URL changed while the panel was open (tab, filter, sort or page)
   Browser Back still closes an open panel.
3. **No flash on narrow screens.** Below 1024px the server-rendered side panel is hidden by CSS.
   The first paint shows only the list, and the sheet opens once the page is interactive.

## Design

### Config

- `ResourceUi.titleField: string` (required) names the field used as the panel heading and as
  the title cell's link text: orders `order_number`, delivery_dockets `docket_number`, clients,
  products, product_categories, product_types, product_sizes and product_media `name`, users
  `name`. A blank value falls back to `email` when the row has one (users), so the link and
  heading always have text (`displayName`). order_items gets `order_number`, its existing title
  link (the Order cell); its panel keeps its own caption and product-name heading (spec 06).
- `ResourceUi.list.statusTabs` changes from a boolean to `{ key: string; options: Option[] }`.
  `key` is the list column holding the status.
  - order_items: `{ key: "order_status", options: ORDER_STATUS }` (06's behaviour unchanged)
  - orders: `{ key: "status", options: ORDER_STATUS }`
  - delivery_dockets: `{ key: "status", options: DOCKET_STATUS }`
- The `status` filter is removed from the orders and delivery_dockets resource configs and from
  their `QUERIES[...].filters`.
- `QueryConfig` gains `statusColumn?: { column: string; enumType: string }`, the server-side
  allowlist for tabs: `order_status`/`order_status` (order_items), `status`/`order_status`
  (orders) and `status`/`docket_status` (delivery_dockets). `listRecords({status})` and
  `countByStatus` use it in place of the hard-coded `order_status`. A resource without
  `statusColumn` still throws `UnknownKeyError`, and a value outside the resource's options is
  ignored (behaves as All).
- `FieldDef` gains `chips?: true`. The order and docket `status` fields set it, and the panel
  renders those fields as chip radio groups. Forms and edit pages are unaffected.
- `QUERIES.orders.select` adds the same expression Order Items uses: `due_date -
  (now() AT TIME ZONE APP_TIME_ZONE)::date AS due_in_days`. The orders Due column gets a
  `renderCell` using `relativeDue`.
- `lib/theme/palette.ts`: `statusColors.current = statusColors.new`'s pair, and
  `contrastPairs` gains "status pill current".

### Shared components

Everything item-independent moves out of `components/order-items/order-item-panel.tsx`:

- `components/resource/panel/panel-shell.tsx` (client) owns the frame and its behaviour:
  - the side `<section aria-label="Edit <singular in lower case>">` with `max-lg:hidden`
    (fix 3), or the `Sheet` below 1024px
  - the header: caption, ×, heading, optional sub-link
  - the hydration `fieldset`, focus on the heading at open, and focus back to
    `[data-item-link="<id>"]` on unmount
  - Escape, and the "Discard changes?" dialog driven by an `isDirty` prop
  - `close()` (fix 2, below)
  - the footer: the detail link, Cancel and Save
  Item-specific content is passed as children.
- `components/resource/panel/panel-section.tsx`: the collapsible section with its error count.
- `components/resource/panel/use-panel-errors.ts`: the "expand the failing sections, focus the
  first invalid field" logic, given a field-to-section map.
- `components/resource/panel/history.ts`: `markOpenedFromList(href)` and `closePanel(router,
  baseHref)`.
  - Every in-app opener calls `markOpenedFromList` before navigating: row click, title link,
    toast View. It stores the target URL in `sessionStorage` under `panel-opened`.
  - `closePanel(router, baseHref, { saved })` calls `router.back()` when the stored URL equals
    the current URL, and otherwise `router.replace(baseHref, { scroll: false })`. It clears the
    key either way. With `saved: true` it then calls `router.refresh()`, so a list restored by
    `back()` shows the saved data. Cancel, × and Escape pass `saved: false`.
  - `PanelShell` also clears the key when it unmounts without `closePanel` having run (for
    example, navigating elsewhere with the panel open). A leftover marker can then never make a
    later close go back out of the app.
  - Storage access is wrapped in try/catch. If storage is unavailable, `closePanel` replaces, as
    today.
- `components/resource/status-tabs.tsx` and `components/resource/status-pill.tsx` replace the
  order-items versions. They take `options` (and the colours from `statusColors` by value) instead
  of hard-coding `ORDER_STATUS`.
- `components/resource/record-panel.tsx` (client): the generic panel for a resource.
  - It wraps `PanelShell`, with `react-hook-form`, `buildSchema(key, "edit")` (password optional,
    as on the edit page) and `initialValues(key, record)`.
  - The body holds the read-only values, the ungrouped fields, then one `PanelSection` per group.
    It renders through `FieldControl`, with `refFilter` dependents as in `ResourceForm`. Fields
    with `chips` render as chips.
  - It saves through `saveRecord(key, id, values)` and ignores `redirectTo`. On success it shows
    the toast, the moved-tab handling and `closePanel`. On failure it shows field errors via
    `usePanelErrors` and the error toast.
- `components/order-items/order-item-panel.tsx` keeps only its item-specific content (caption and
  line, product and order reloads, Size, Created, Due/Status, stages, Details/Attributes), inside
  `PanelShell`.

### List pages

- `ResourceListPage` gains the panel and tabs for every resource:
  - It reads `?item=` and loads the record with `getRecord(key, id)` when the id is numeric.
  - It reads `?status=` only when the resource has `statusTabs`, and loads `countByStatus`.
  - It renders `StatusTabs`, the table with `onRowOpen` and `selectedId`, and `RecordPanel`, plus
    the not-found toast.
  - Users' heading falls back to the email (`displayName`).
- `DataTable`: when `onRowOpen` is set, the title cell (the column whose key is `titleField`, with
  the email fallback) renders as a link to
  `?<query>&item=<id>` with `data-item-link` and `markOpenedFromList`. This is the same pattern
  as `OrderItemsTable`'s Order link, made generic. `OrderItemsTable` then uses it.
- `OrderItemsListPage` stays separate (its panel data and columns are specific). It uses the
  shared tabs, pill and history helpers.

### Order Items save (fix 1)

- In `order-item-panel.tsx`, `onSubmit` leaves out `order_due_date` and `order_status` unless
  either is in `formState.dirtyFields`. Changing Order sets both dirty, as it does today.
- In `panelSchema`, both fields become optional. A present value is still validated as today.
- `saveOrderItemPanel` writes the order only when both are present and differ from the stored
  values, and returns the order's stored status when they are absent (for the moved-tab check).

### Impact on earlier specs

- **Spec 02:**
  - The Summary's "Clicking a row opens the detail page, and each row has an Edit action" no
    longer holds for any list.
  - Its list e2e checks that click a row or the Edit link are updated to the panel.
  - The Status filters on Orders and Delivery Dockets (and their URL key `status`) become tabs.
    `?status=` keeps its meaning.
- **Spec 06:**
  - "Lists other than Order Items keep today's behaviour" and the out-of-scope item "Edit panels
    on lists other than Order Items" are superseded.
  - AC-24's close behaviour gains fix 2. AC-20 and AC-21 still hold under fix 1.
- **Spec 04** (not built yet) needs a revision before implementation: its order and docket
  detail-page panels stay on the detail pages, reached through "View order" / "View delivery
  docket".

## Acceptance criteria

**Lists**

1. **AC-1** On each of the nine lists, clicking a row (outside any other link) opens the panel,
   sets `?item=<id>`, marks the row `aria-selected`, and does not navigate to the detail page.
   There is no Edit column. The title cell is a keyboard-reachable link that opens the panel: Order
   Number (Orders), Docket Number (Delivery Dockets), Name (Clients, Products, Product Categories,
   Product Types, Product Sizes, Product Media, Users). On Products it is the Name cell, not
   Category. On Orders, the Client link still goes to `/clients/<id>`.
2. **AC-2** The Orders tabs (All, New, Complete, Archived) and the Delivery Dockets tabs (All,
   Current, Archived):
   - show counts equal to the matching rows under the other active filters
   - set `?status=…`, filter the rows, reset to page 1, and survive a reload
   - treat an unknown `status` as All
   Neither list has a Status filter any more.
3. **AC-3** `listRecords` and `countByStatus` filter and count by each resource's own status
   column. They throw for a resource without `statusTabs` (integration test). Order Items' tabs
   behave as in spec 06 AC-13.
4. **AC-4** The Status cells on Orders and Delivery Dockets are pills in their `statusColors`
   pair, and "status pill current" is ≥4.5:1 (unit test).
5. **AC-5** The Orders Due cell shows the date and the relative line for each case in spec 06
   AC-15 (overdue, due today, within 7 days, later, and "—" for Complete/Archived), tested with a
   fixed clock.

**Panels**

6. **AC-6** Loading `<list>?item=<id>` opens the panel on all nine lists, with the singular caption
   and the title field as the heading: the order number, docket number, client name, product name,
   category, type, size or media name, or the user's name (email when blank). This holds even when the record
   is outside the current page or tab. It holds every field of that resource's edit form. A
   non-numeric id opens no panel. An unknown id opens none and shows "<Singular> not found".
7. **AC-7** On Clients, Product Types, Product Sizes and Product Media, changing a field and
   saving persists it. The panel closes, "<Singular> successfully updated" appears, and the row
   shows the new value without a manual reload.
8. **AC-8** Orders panel:
   - It shows Created read-only, Status as chips, and the client link.
   - Changing Due and saving updates the row and its relative line.
   - Changing Client clears Delivery Docket, and the docket choices are only that client's.
   - Saving a docket of another client (sent directly) shows the error toast "Could not edit
     Order: delivery docket belongs to another client". The panel stays open and nothing is
     written.
9. **AC-9** Delivery Dockets panel: it shows Docket Number, Date and From Client read-only, and
   the To client as a link. Changing To Client and saving persists it.
10. **AC-10** On the Orders New tab, setting Status to Complete and saving shows "Order
    successfully updated. Moved to Complete." with a View action. View switches to the Complete
    tab with that order's panel open. The Delivery Dockets Current → Archived move behaves the
    same.
11. **AC-11** Products panel: changing Category (a reference) and saving persists it.
    Product Categories panel:
    - It shows the form heading and one collapsed section per flag group (13).
    - Ticking a flag and saving persists it.
    - An empty Name shows its error and focuses Name.
12. **AC-12** Users panel:
    - The heading is the user's name, or the email when there is none. A user with no name has a
      title link labelled with their email.
    - Changing Name and saving persists it, and a blank name is stored as NULL (spec 06 AC-10).
    - Saving with Password blank leaves the password hash unchanged.
    - Saving a password shorter than 12 characters shows the field error.
    - The password checks use a user other than the signed-in one; saving your own password
      signs you out, as on the edit page.
13. **AC-13** An invalid value in a collapsed section (e.g. on Product Categories, or Order Items'
    Part Number) expands that section, shows its error count, focuses the field, and writes
    nothing.
14. **AC-14** On every panel, unsaved changes make Cancel, × and Escape ask "Discard changes?".
    Without changes they close at once. Closing removes `?item` and returns focus to the row's
    title link. "View <singular>" links to `<path>/<id>`. Below 1024px the panel is a sheet.
    With unsaved edits in an Orders panel, switching tab keeps the panel open with the edits.
15. **AC-15** axe finds no critical violations and no contrast failures on `/orders?item=<id>`,
    `/delivery-dockets?item=<id>`, `/product-categories?item=<id>` and `/users?item=<id>`.

**06 review fixes**

16. **AC-16** (fix 1) An Order Items panel is opened. The order's due date and status are then
    changed directly in the database, and the panel saves with only Quantity changed. The order
    keeps the new due date and status (integration and e2e). Changing Due or Status in the panel
    still updates the order (spec 06 AC-20). Moving an item still behaves as in spec 06 AC-21.
17. **AC-17** (fix 2) Checked on Order Items and one other list:
    - Open a list, open a row's panel, then close it with Cancel. One Back then leaves the list
      for the page visited before it.
    - The same holds after Save, and the row shows the saved value without a manual reload.
    - Loading `?item=<id>` directly, then closing, stays on the list without `?item`.
    - Open a panel from the list, navigate elsewhere with it open, then load the panel's URL
      directly and close it. You stay on the list.
    - Browser Back still closes an open panel.
18. **AC-18** (fix 3) With JavaScript disabled at 800px wide, `<list>?item=<id>` shows no visible
    side panel, on Order Items and one other list. At 1280px the side panel is visible.
19. **AC-19** Every panel's Server Action path rejects calls without a session. This means
    `saveRecord` and spec 06's panel actions, as today (existing tests still pass).

## Out of scope

- Delete or Print inside a panel. They stay on the edit and detail pages.
- Creating records in a panel. "New <singular>" still opens the create page.
- Protecting the other resources' edit forms and panels against stale writes generally (sending
  only changed fields through `saveRecord`). Fix 1 covers only the order fields saved from an
  Order Items panel.
- Hiding columns beside the panel on lists other than Order Items.
- The order's items inside the Orders panel, and anything else from spec 04.
- Panels on detail or edit pages.
- Changes to the design's look beyond applying the existing panel, tab and pill styles.

## Open questions

None. The four decisions in the Summary are open to the author at spec validation.
