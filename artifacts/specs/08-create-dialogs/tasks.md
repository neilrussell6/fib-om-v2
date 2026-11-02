# Tasks — 08-create-dialogs

- Date: 20261102-153733 (revised 20261102-160021)
- Feature: 08-create-dialogs
- Phase: 2 (Tasks)

Built from `artifacts/specs/08-create-dialogs/spec.md` (with `research.md` for the current code).
References in brackets point at the spec's acceptance criteria (AC n), its Summary decisions
(D n), or Design sections.

## Tasks

### 1. Config and theme

- [ ] Add a required `createDescription: string` to `ResourceUi` and set it on all ten resources
  with the text from the spec's Descriptions table (Design: Config; AC 1)
- [ ] Add `resourceAddLabel(ui)` next to `resourceNewLabel` in `lib/resources/index.ts`:
  `"Add " + resourceNewLabel(ui).replace(/^New /, "")`, giving "Add item" on Order Items and
  "Add client" / "Add product category" elsewhere (Design: Config; AC 2)
- [ ] Add the dialog's design tokens (overlay `rgba(18,30,34,.42)`, dialog radius 10px and max
  width 560px, shadow `0 24px 60px rgba(0,0,0,.22)`, footer `#fafbfb`, description `#5e686d`,
  "(optional)" `#7d878b`, focus ring `#0f5566` + `0 0 0 3px rgba(15,85,102,.14)`) where the
  theme keeps its other design values, and add contrast pairs for the description and the
  "(optional)" hint on white, and the footer text on `#fafbfb` (Look; AC 2, 14)

### 2. History: one marker entry per layer

- [ ] In `components/resource/panel/history.ts`, store `panel-opened` as a JSON list of normalised
  URLs. `read()` returns `string[]`, treating missing storage, unparsable JSON, a non-array or
  non-string entries (including the old single-string value) as `[]`. Writing an empty list
  removes the key (Design: History)
- [ ] Give `openPanel` a `key = "item"` parameter. When `key` isn't in the current URL, add `href`
  to the list and push. When it is (switching rows), replace the URL, and swap the current
  URL's entry for `href` only when the current URL is in the list (Design: History; D 4)
- [ ] Make `markOpenedFromList(href)` add `href` to the list, `closePanel` go back (and remove the
  current URL's entry) when the current URL is in the list and replace otherwise, keeping the
  refresh-after-save behaviour, and `clearOpenedMarker(ownHref)` remove only `ownHref`
  (Design: History; AC 12)
- [ ] Update the doc comment at the top of `history.ts` to describe the layered marker

### 3. Shared dialog parts

- [ ] Add an `optionalHint` prop to `FieldControl` (`components/resource/resource-form.tsx`) that
  appends "(optional)" in regular weight, `#7d878b`, to the label of a field that isn't
  required, and a size option for the design's 40px controls. Existing callers are unchanged
  (Fields; AC 3)
- [ ] Add `components/resource/quantity-stepper.tsx`: − and + buttons around a number input,
  labelled for screen readers, − disabled at 1 and never going below 1, typing still allowed,
  wired to react-hook-form like `NumberInput` (Fields; AC 10)
- [ ] Add `components/resource/create/create-dialog.tsx` on the Base UI `Dialog` in
  `components/ui/dialog.tsx`: overlay and dialog styles from the design (full width below
  640px), `role="dialog"`, `aria-modal="true"`, labelled by the title and described by the
  description, the 32px × "Close", a scrolling body, and the footer with Create another
  (unchecked on open; hidden when told to), Cancel and the primary button ("Add <thing>", or
  "Adding…" and disabled while pending) (Look; Design: Components; AC 2, 13, 14)
- [ ] In `create-dialog.tsx`: the hydration `fieldset`, focus on the first field when it opens,
  Escape / × / Cancel / overlay click closing through `closePanel` (list URL minus `new`), the
  "Discard changes?" dialog (Discard / Keep editing) when the form is dirty, focus back to the
  "New …" button after closing, Browser Back closing it (the URL drives it), and
  `clearOpenedMarker(ownHref)` when it unmounts without closing (Closing; Design: History;
  AC 11, 12)
- [ ] Add `components/resource/create/record-create-form.tsx`: react-hook-form with
  `buildSchema(key, "create")` and `initialValues(key)`; ungrouped fields in two columns in form
  order with textareas spanning both; then the form heading and one collapsed `PanelSection`
  per group with its error count; dependent reference fields through `FieldControl` as on the
  create page (Orders' docket narrowed to the client and cleared on change) (Fields; AC 3, 8, 9)
- [ ] In `record-create-form.tsx`, Add: save through `saveRecord(key, null, values)` with a guard
  so a double click sends one request; on success show "<Singular> successfully created", then
  for `afterCreate: "detail"` `router.replace(redirectTo)` and drop the dialog's marker entry,
  else with Create another checked reset to defaults (keeping the fields the body says to keep),
  focus the first field that was reset and refresh the list, else close with `saved: true`; on
  failure show field errors through `usePanelErrors` (expanding sections that hold errors and
  focusing the first field with an error) and other errors as "Could not create <Singular>:
  <message>" (Add; AC 4, 5, 6, 7, 13)
- [ ] Add `components/order-items/order-item-create-form.tsx`: the same form logic with Order,
  Product, read-only Size ("—" until a product is chosen, then its size from
  `getProductPanelInfo`) beside the Quantity stepper, then Part Number, Height, Width, Depth,
  Comment (with "(optional)"), then the collapsed Attributes section. Create another keeps Order
  and focuses Product (Fields; Add; AC 5, 7, 10)

### 4. List pages

- [ ] In `ResourceListPage` and `OrderItemsListPage`, make the "New …" button a link to the
  current query plus `new=1` (keeping `item`, filters, tab, sort and page) that opens through
  `openPanel(router, href, "new")` on a plain click and follows the link otherwise. Give it a
  stable hook for focus return (Opening; Design: Components; AC 1, 11)
- [ ] When `new` is exactly `"1"`, render `CreateDialog` with the resource's title ("New
  <singular in lower case>"), description, add label and body (`OrderItemCreateForm` on Order
  Items, `RecordCreateForm` elsewhere), with Create another hidden on Delivery Dockets. Ignore
  any other value. Pass the base query minus `new` for closing (Opening; D 5; AC 1, 5)
- [ ] Keep the open panel when the dialog opens from 1024px up. Below 1024px, don't render the
  panel sheet while the dialog is open, so it reappears when the dialog closes (D 6; Opening)
- [ ] Drop `new` from the panel's base query and the table's row links, so opening, switching or
  closing a panel never reopens the dialog (Opening; AC 12)
- [ ] Build the dialog's close URL as the current URL minus `new` only, keeping `item`, filters,
  tab, sort and page (Closing; AC 11, 12)

### 5. Tests

- [ ] Unit (`tests/unit/resources-config.test.ts`): every resource has a non-empty
  `createDescription` matching the table, and `resourceAddLabel` gives "Add item", "Add client"
  and "Add product category" (AC 1, 2)
- [ ] Unit (`tests/unit/theme-contrast.test.ts`): the new contrast pairs pass, and the dialog
  tokens equal the design values (AC 2, 14)
- [ ] Unit (`tests/unit/panel-history.test.ts`), approved by the author at task review: change
  only the three spec 07 assertions that read the raw stored marker (`:104`, `:115`, `:145`) to
  parse the stored list, e.g. `expect(JSON.parse(store.get(KEY)!)).toEqual(["/clients?item=5"])`.
  Leave the `store.has(KEY)` checks as they are (Design: History)
- [ ] Unit (`tests/unit/panel-history.test.ts`): two layers (panel then dialog; closing the dialog
  goes back and leaves the panel's entry; closing the panel then goes back), a row switch
  replacing only the panel's entry, `clearOpenedMarker` removing only its own URL, and a
  malformed or old single-string stored value counting as empty (AC 12)
- [ ] Integration (`tests/integration/`): `saveRecord` on create for a docket with
  `FROM_CLIENT_ID` unset still fails with "sender client is not configured" (existing test
  kept); a user created with a blank name stores NULL and a bcrypt hash (AC 6, 9)
- [ ] E2E `tests/e2e/create-dialogs.spec.ts`, one test per AC:
  - AC 1: on all ten lists the button opens the dialog with `?new=1`, keeps other parameters,
    stays off `/new`, and shows the title and description; `?new=1` loads it; `?new=yes` doesn't
  - AC 2: computed overlay colour, 560px max width, 10px radius, footer background, button
    labels; full viewport width at 600px
  - AC 3: "(optional)" on optional fields only, 13 collapsed sections on Product Categories,
    Orders Status New and Dockets Status Current
  - AC 4: add a Client, a Product Size and a Product; dialog closes, toast, row without reload,
    row in the database
  - AC 5: Create another on Product Types (stays open, reset, focus Name, row listed, second
    record), on Order Items (Order kept, focus Product), and absent on Delivery Dockets
  - AC 6: docket Add goes to its detail page with the toast; one Back shows the list with no
    dialog
  - AC 7: empty Product Media Code (error, focus, nothing written); empty Order Items Part
    Number (focused, nothing expanded); invalid Attributes value expands Attributes with its
    count
  - AC 8: Orders Client change clears Delivery Docket, docket choices limited to the client,
    order persisted
  - AC 9: Users empty Password error; add with a 12+ character password succeeds
  - AC 10: Size "—" then the product's size; stepper − stops at 1, + increments; item created on
    the chosen Order
  - AC 11: discard prompt from Cancel, ×, Escape and overlay click when dirty; immediate close
    when clean; `?new` removed, `?item` and filters kept, focus back on "New …"
  - AC 12: button → Cancel → one Back leaves the list (and after Add); direct `?new=1` close
    stays; Back closes the dialog; panel stays open under the dialog; panel → dialog → Cancel
    → close panel → one Back leaves the list; at 800px `?item=<id>&new=1` shows only the dialog
    and Cancel brings the sheet back
  - AC 13: "Adding…" and disabled while saving; a double click creates one record
- [ ] E2E (`tests/e2e/shell.spec.ts`): axe with the dialog open on `/order-items?new=1`,
  `/product-categories?new=1` and `/users?new=1`; `role="dialog"`, `aria-modal="true"` and the
  title as its name (AC 14)
- [ ] E2E (`tests/e2e/lists.spec.ts`), per the spec's Impact section: at `:41` (spec 06 AC-8)
  expect the "New …" link's href to be `${path}?new=1`; at `:177` (review 02 finding 2) expect
  the "New product type" dialog instead of the create page, keeping the duplicate-id check
  unchanged. Tests that go to `/new` directly (`forms.spec.ts`, `crud.spec.ts`, `shell.spec.ts`)
  stay as they are (AC 15)

### 6. Finish

- [ ] Run lint, typecheck, unit, integration, and e2e (`npm run build && PORT=3100 npx
  playwright test`, so the author's dev server on :3000 isn't reused) (all ACs)

## Not in this feature

- The design's Client field and Size chips on the Order Items dialog, and editing the order's due
  date from it.
- Create dialogs anywhere other than the list pages (e.g. spec 04's order detail page keeps its
  `/order-items/new?orderId=…` link).
- Removing the `/new` pages.
- Remembering "Create another" between openings.
- Quantity steppers outside the Order Items dialog.
