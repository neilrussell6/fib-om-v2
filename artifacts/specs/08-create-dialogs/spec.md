# Spec — 08-create-dialogs

- Date: 20261102-123259 (revised 20261102-152411, 20261102-152730)
- Feature: 08-create-dialogs
- Phase: 1 (Spec)

> Research: [`research.md`](research.md). Source design: Claude Design project
> `338369ce-2e1a-45a7-bb17-43ffbba7c267`, file `Order Items.dc.html` (the "New order item"
> dialog, added 2026-11-02). Depends on `02-basic-crud` (forms, `saveRecord`), `06` (theme) and
> `07-list-panels` (panel parts, history helpers). Built before `04-custom-behaviour`.
>
> The design is a visual reference only (`designs-are-visual-reference`). The dialog's look,
> layout and footer come from it. Each dialog's fields and rules come from that resource's real
> create form.

## Summary

"New <thing>" on every list opens a **create dialog** over the list instead of going to the
`/new` page. Every dialog uses the design's layout:
- a title ("New client") and a short description
- the resource's create-form fields
- a footer with **Create another**, **Cancel** and the primary **Add <thing>**

It saves through the same Server Action and rules as the create page. The `/new` pages stay, for
direct links and spec 04.

Decisions taken in this spec (the author can overturn them at spec validation):

1. **The `/new` pages stay.** Only the list's "New …" button changes.
2. **Order Items fields.** The Order Items dialog holds the real item create form, plus the design
   touches that fit real data:
   - Size, read-only, follows the chosen product (as in the panel)
   - Quantity as a − / + stepper
   - Comment labelled "(optional)"
   The design's Client field, Size chips and order "Due date" are not used: Size comes from the
   product, and the due date belongs to the order (edit it in the panel).
3. **"Create another"** keeps the dialog open after a save and resets it to its defaults. On Order
   Items it keeps the chosen Order, since the design's purpose is adding lines to an order.
4. **The dialog is in the URL** as `?new=1`, following the panels' history rules.
5. **Delivery Dockets** still go to the new docket's detail page after Add (spec 02, needed by
   spec 04). Every other list stays on the list.
6. **With a panel open** (1024px and wider, where the panel sits beside the list), "New" opens the
   dialog on top, and the panel stays as it was. Below 1024px the panel is a sheet covering the
   list, so the two only meet through a URL holding both; then only the dialog shows (see
   Opening).

## User-visible behaviour

### Opening

- The **"New <singular>"** button on every list ("New item" on Order Items) opens the dialog and
  sets `?new=1`. The other URL parameters stay as they are, including `?item`, so an open panel
  stays open underneath.
  - It is still a link (to `?<query>&new=1`), so it works from the keyboard and in a new tab.
- Loading a list URL with `?new=1` opens the dialog. Any other value of `new` is ignored.
- **Below 1024px,** a URL with both `?item` and `?new=1` shows only the dialog, not the panel
  sheet, so there is never more than one modal layer. Closing the dialog removes `?new`, and the
  panel sheet appears.
- Focus moves to the dialog's first field. Closing returns focus to the "New …" button.

### Look (from the design)

- **Overlay:** `rgba(18,30,34,.42)` over the whole page, with the dialog centred and 24px of
  padding around it.
- **Dialog:** white, up to 560px wide, as tall as the viewport allows, 10px radius, shadow
  `0 24px 60px rgba(0,0,0,.22)`. Below 640px it fills the screen.
- **Header:**
  - the title "New <singular in lower case>" (20px, semibold), e.g. "New order item", "New product
    category"
  - the resource's description under it (14px, `#5e686d`)
  - a 32px × ("Close")
  - a divider below
- **Body:**
  - It scrolls.
  - 13px medium labels over 40px controls, with the design's focus ring (teal border and a 3px
    `rgba(15,85,102,.14)` ring).
  - A field that isn't required shows "(optional)" after its label, in regular weight `#7d878b`.
- **Footer:** on `#fafbfb`, with a divider above:
  - a **Create another** checkbox, unchecked each time the dialog opens
  - **Cancel** (outline)
  - the primary **Add <thing>**, where `<thing>` is the "New …" label without "New": "Add item",
    "Add client", "Add product category"

### Descriptions

| List | Description |
|---|---|
| Order Items | Add a product line to an existing order. |
| Orders | Start a new order for a client. |
| Delivery Dockets | Start a docket for delivering orders to a client. |
| Products | Add a product to the catalogue. |
| Product Categories | Choose which columns Order Items shows for this category. |
| Product Types | Add a product type with its code. |
| Product Sizes | Add a size that products are made in. |
| Product Media | Add a filter media with its code. |
| Clients | Add a customer you take orders for. |
| Users | Give someone access to Fibatron. |

### Fields

Every dialog holds **every field of the resource's create form**, with the same controls,
defaults, rules and dependencies as the create page:

- **Order:** ungrouped fields first, in form order, in two columns. Textareas span both columns.
  Then the form heading, if any, and one collapsible section per form group, collapsed by default.
  This is the panel section, with its error count. Product Categories gets its 13 flag groups this
  way.
- **Defaults:** Order Status starts as New and Docket Status as Current, as on the create page.
- **Dependencies:** Orders' Delivery Docket is narrowed to the chosen client, and changing Client
  clears it.
- **Users:** Password is required.
- **Order Items:** Order, Product, then read-only Size beside Quantity. Size shows the chosen
  product's size, and "—" until a product is chosen. Quantity is a stepper: − and + buttons
  around a number input. − never goes below 1, and typing a number still works. Then Part
  Number, Height, Width, Depth and Comment, then the Attributes section (collapsed).

### Closing

- **Cancel, × and Escape** close the dialog, and so does **clicking the overlay**. If anything was
  entered, they first ask "Discard changes?" (Discard / Keep editing).
- Closing removes `?new` and keeps every other parameter.
- **History:** these follow the panels' rules (spec 07 fix 2).
  - A dialog opened from the button closes back to the previous history entry, so the next Back
    leaves the list as before.
  - A dialog loaded directly from a `?new=1` URL closes by replacing the URL.
  - Browser Back closes an open dialog.

### Add

**Add <thing>** validates and saves through the same Server Action as the create page. Then:

- **Success, "Create another" unchecked:**
  - the toast "<Singular> successfully created"
  - the dialog closes
  - the list refreshes, with the tab counts on lists that have tabs
  - **Delivery Dockets** instead go to the new docket's detail page, as the create page does. It
    replaces the dialog's URL rather than pushing, so Back from the docket returns to the list,
    not to an empty dialog.
- **Success, "Create another" checked:**
  - the same toast
  - the dialog stays open, reset to its defaults, with focus on the first field that was reset
    (the first field overall, except on Order Items, where Order is kept and focus goes to
    Product)
  - the list behind it refreshes
  - On Order Items the chosen Order is kept.
  - On Delivery Dockets "Create another" is not shown, since Add goes to the detail page.
- **Error:**
  - The dialog stays open with field errors inline.
  - Sections that hold an error expand, and focus moves to the first field with an error.
  - Other errors show as the toast "Could not create <Singular>: <message>" (e.g. "Could not create
    Delivery Docket: sender client is not configured").
  - Nothing is written.
- While saving, the button reads "Adding…" and is disabled.

## Design

### Config

- `ResourceUi.createDescription: string` (required), with the values in the Descriptions table.
- `resourceAddLabel(ui)`: `"Add " + (newLabel ?? "New " + singular-lower).replace(/^New /, "")`.

### History

- `components/resource/panel/history.ts` generalises from `item` to a URL key:
  - `openPanel(router, href, key = "item")`
  - `closePanel(router, baseHref, opts)`
  - `markOpenedFromList(href)` and `clearOpenedMarker(ownHref)`
- **One marker entry per open layer.** The `panel-opened` sessionStorage entry becomes a JSON
  list of normalised URLs (at most a few: a panel and a dialog), instead of a single URL, so a
  dialog opened over a panel doesn't overwrite the panel's marker:
  - Opening a new layer (`openPanel` when the key isn't in the URL yet, or `markOpenedFromList`)
    adds the target URL to the list and pushes.
  - Switching rows in an open panel (`openPanel` with `item` already present) replaces the URL and
    replaces the current URL's entry with the new one, only when the current URL is in the list.
  - `closePanel` goes back when the current URL is in the list, removing it; otherwise it
    replaces. A save still refreshes after either.
  - `clearOpenedMarker(ownHref)` removes only `ownHref`. The dialog, like `PanelShell`, calls it
    when it goes away without closing (e.g. the docket's replace to its detail page), so no stale
    entry is left.
  - Storage missing or holding anything that isn't a list of strings (including the old
    single-string value) counts as an empty list, so closing replaces.
- Opening the dialog while a panel is open pushes, because the dialog is a new layer, not a switch
  between rows.
- Closing the dialog uses `closePanel` with the list URL minus `new`.

### Components

- `components/resource/create/create-dialog.tsx` (client) is the frame:
  - overlay, dialog (`role="dialog"`, `aria-modal`, labelled by the title, described by the
    description), header, scrolling body, footer with Create another, Cancel and Add
  - the hydration `fieldset`, focus on the first field when it opens, focus trap, and focus back to
    the "New" button when it closes
  - Escape and overlay click (with the discard dialog when dirty), and `closePanel`
  - It is built on the existing `Dialog` primitive in `components/ui/dialog.tsx` (Base UI), which provides the
    overlay, the focus trap and Escape.
- `components/resource/create/record-create-form.tsx` (client) is the body for any resource:
  - It uses `react-hook-form` with `buildSchema(key, "create")` and `initialValues(key)`.
  - It renders the fields through `FieldControl`, with a new `optionalHint` prop that adds
    "(optional)" to labels of fields that aren't required, and 40px controls. Groups go into
    `PanelSection`.
  - It saves through `saveRecord(key, null, values)`.
  - On success it shows the toast, then either resets (`reset(defaults)`, keeping the configured
    fields), or follows `redirectTo` for `afterCreate: "detail"`, or closes with `saved: true`.
  - On failure it shows errors through `usePanelErrors`.
- `components/order-items/order-item-create-form.tsx` is the Order Items body. It uses the same
  form logic, plus read-only Size (through `getProductPanelInfo`), the Quantity stepper
  (`components/resource/quantity-stepper.tsx`), and "keep Order on Create another".
- `ResourceListPage` and `OrderItemsListPage`:
  - The "New …" `LinkButton` becomes a link to `?<query>&new=1`, opened with `openPanel(..., "new")`.
  - When `new=1` is present, they render the dialog with the right body. Below 1024px they don't
    render the panel sheet while the dialog is open.
- `/new` pages: unchanged.

## Impact on earlier specs

- **Spec 02:** "A Create button opens the create form" now means the list's button opens the
  create dialog. The create pages themselves and their tests are unchanged.
- **Spec 06** AC-8 ("a 'New …' button that links to its create page") becomes: it opens the
  create dialog, and its link is `?…&new=1`.
- **Spec 04** (not built yet) still uses `/order-items/new?orderId=…&returnTo=…`. Nothing changes
  for it.

## Acceptance criteria

1. **AC-1** On each of the ten lists, clicking "New …" opens the dialog, sets `?new=1`, and keeps
   the other parameters. It doesn't navigate to `/new`. The dialog shows the title "New <singular
   in lower case>" and the description from the table. Loading `<list>?new=1` opens it too.
   `?new=yes` opens nothing.
2. **AC-2** The dialog's look matches the design (unit-tested tokens, e2e computed styles):
   - the overlay colour
   - a dialog max width of 560px, 10px radius
   - the footer background `#fafbfb`
   - the primary button labelled "Add <thing>" ("Add item" on Order Items, "Add client" on Clients)
   Below 640px the dialog fills the viewport width.
3. **AC-3** Each dialog holds every field of its create form. Fields that aren't required show
   "(optional)" and required ones don't. Groups are collapsed sections (Product Categories: 13).
   Defaults match the create page (Orders' Status is New, Dockets' Status is Current).
4. **AC-4** Adding a Client, a Product Size and a Product succeeds. The dialog closes, the toast
   "<Singular> successfully created" appears, the new row is in the list without a reload, and the
   record is in the database.
5. **AC-5** "Create another":
   - On Product Types, checking it and adding keeps the dialog open, reset to empty, with focus on
     Name, and the list shows the new row. A second add creates a second record.
   - On Order Items it keeps the chosen Order, and focus is on Product.
   - It isn't shown on Delivery Dockets.
6. **AC-6** Adding a Delivery Docket goes to its detail page with "Delivery Docket successfully
   created". One Back from there shows the docket list with no dialog. With `FROM_CLIENT_ID`
   unset, the error toast "Could not create Delivery Docket:
   sender client is not configured" is checked at integration level through `saveRecord`, as
   today.
7. **AC-7** Errors:
   - Adding a Product Media with an empty Code shows the field error, focuses Code, and writes
     nothing.
   - An Order Items add with an empty Part Number expands nothing, because Part Number is
     ungrouped, but focuses it.
   - An invalid Attributes value expands Attributes with its error count.
8. **AC-8** Orders dialog: Status defaults to New. Changing Client clears Delivery Docket, and the
   docket choices are only that client's. Adding persists the order.
9. **AC-9** Users dialog:
   - An empty Password shows the field error.
   - Adding a user with a name and a 12+ character password creates it with a bcrypt hash.
   - A blank name is stored as NULL.
10. **AC-10** Order Items dialog:
    - Size shows "—", then the chosen product's size (read-only).
    - The Quantity stepper's − stops at 1 and + increments.
    - Adding with every required field creates the item on the chosen Order.
11. **AC-11** Closing:
    - With entered values, Cancel, ×, Escape and an overlay click each ask "Discard changes?".
    - Without values they close at once.
    - Closing removes `?new`, keeps `?item` and the filters, and returns focus to the "New …"
      button.
12. **AC-12** History:
    - Open the dialog from the button, then Cancel. One Back leaves the list for the previous page.
      The same holds after Add.
    - Loading `?new=1` directly, then closing, stays on the list.
    - Back closes an open dialog.
    - With a panel open, opening and closing the dialog leaves the panel open.
    - Two layers: open a panel from the list, open the dialog, Cancel, then close the panel. One
      Back leaves the list for the previous page. Unit tests cover the marker list (two layers,
      row switch under a dialog-free panel, `clearOpenedMarker` removing only its own URL, a
      malformed stored value).
    - At 800px wide, loading `?item=<id>&new=1` shows only the dialog. Cancel brings back the
      panel sheet.
13. **AC-13** While saving, the primary button reads "Adding…" and is disabled. A double click
    creates one record.
14. **AC-14** axe finds no critical violations and no contrast failures with the dialog open on
    `/order-items?new=1`, `/product-categories?new=1` and `/users?new=1`. The dialog has
    `role="dialog"`, `aria-modal="true"`, and an accessible name equal to its title.
15. **AC-15** The `/new` pages still work as before (the existing create-page tests still pass).

## Out of scope

- The design's Client field and Size chips on the Order Items dialog, and editing the order's due
  date from it.
- Create dialogs anywhere other than the list pages (e.g. spec 04's order detail page keeps its
  `/order-items/new?orderId=…` link).
- Removing the `/new` pages.
- Remembering "Create another" between openings.
- Quantity steppers outside the Order Items dialog.

## Open questions

None. The six decisions in the Summary are open to the author at spec validation.
