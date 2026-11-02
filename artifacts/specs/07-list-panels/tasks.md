# Tasks — 07-list-panels

- Date: 20261102-102248 (revised 20261102-103338)
- Feature: 07-list-panels
- Phase: 2 (Tasks)

Built from `artifacts/specs/07-list-panels/spec.md` (with `research.md` for the current code).
References in brackets point at the spec's acceptance criteria (AC n), its numbered fixes, or
Design sections.

## Tasks

### 1. Config and data

- [ ] Add a required `titleField: string` to `ResourceUi` and set it on every resource: orders
  `order_number`, delivery_dockets `docket_number`, order_items `order_number`, users, clients,
  products and the four product lookups `name`. Add a helper `recordTitle(ui, row)`. It returns
  the title field's value, falling back to `row.email` when the value is blank, and is used for
  both the heading and the title cell (Design: Config; AC 1, 6, 12)
- [ ] Change `list.statusTabs` from a boolean to `{ key, options }`. Order items get
  `{ key: "order_status", options: ORDER_STATUS }`, orders `{ key: "status", options:
  ORDER_STATUS }`, and delivery_dockets `{ key: "status", options: DOCKET_STATUS }` (Design:
  Config; AC 2)
- [ ] Remove the `status` filter from the orders and delivery_dockets resource configs and from
  their `QUERIES[...].filters` (Design: Config; AC 2)
- [ ] Add `statusColumn?: { column, enumType }` to `QueryConfig`: order_items
  `order_status`/`order_status`, orders `status`/`order_status`, delivery_dockets
  `status`/`docket_status`. In `lib/db/list-query.ts`, make `listRecords({status})` and
  `countByStatus` use it and the resource's `statusTabs.options` in place of the hard-coded
  `order_status` and `ORDER_STATUS`. Both still throw `UnknownKeyError` without it, and an
  unknown value still means All (Design: Config; AC 3)
- [ ] Add `chips?: true` to `FieldDef`, and set it on the orders and delivery_dockets `status`
  fields (Design: Config; AC 8, 9)
- [ ] Add `due_in_days` to `QUERIES.orders.select` with the same `APP_TIME_ZONE` expression as
  order_items. Extract the expression to a shared helper in `lib/db/queries/resources.ts`, so
  both selects use it (Design: Config; AC 5)
- [ ] Add `current` to `statusColors` (the `new` pair) and "status pill current" to
  `contrastPairs` in `lib/theme/palette.ts`. Widen `StatusKey` accordingly (Design: Config;
  AC 4)

### 2. Shared list pieces

- [ ] Move `components/order-items/status-tabs.tsx` to `components/resource/status-tabs.tsx`.
  It takes `options` (a leading "All" tab, then each option) instead of importing
  `ORDER_STATUS`. Update the Order Items page to pass `ORDER_STATUS` (Design: Shared
  components; AC 2)
- [ ] Move `components/order-items/status-pill.tsx` to `components/resource/status-pill.tsx`,
  which takes `status` and `options` (for the label) and colours by `statusColors[status]`.
  Update Order Items (Design: Shared components; AC 4)
- [ ] Add `components/resource/panel/history.ts`:
  - `markOpenedFromList(href)`, which stores the target URL under `sessionStorage`
    `panel-opened` (used directly only by the toast's View action)
  - `closePanel(router, baseHref, { saved })`, which calls `back()` when the stored URL equals
    the current URL and `replace(baseHref, { scroll: false })` otherwise, clears the key, and
    then calls `router.refresh()` when `saved` is true
  - `openPanel(router, href)`, used by every in-app opener. When no panel is open (the current
    URL has no `item`), it marks `href` and `push`es. When a panel is already open, it `replace`s
    instead. If the stored marker equals the current URL it moves the marker to `href`; otherwise
    it leaves it unset. History then stays "list → B" when switching from A to B, and closing B
    goes back to the list, not to A.
  - `clearOpenedMarker(ownHref)`, which removes the key only if it still equals `ownHref`, so an
    unmounting panel never wipes a newer panel's marker
  Wrap every storage access in try/catch, falling back to replace (Design: `history.ts`; fix 2;
  AC 17. Row-to-row switching is a task-level refinement from task review
  20261102-103338.)
- [ ] `DataTable`: when `onRowOpen` is set, render the `titleField` column's cell (using
  `recordTitle`) as a `Link` to `?<query>&item=<id>`, with `scroll={false}` and
  `data-item-link`. Its click prevents the default navigation, stops propagation and calls
  `openPanel`. Add a `baseQuery` prop for the href. Row clicks (`onRowOpen`) call `openPanel`
  too. With `onRowOpen` set
  there is no Edit column, as today (Design: List pages; AC 1)
- [ ] Switch `OrderItemsTable` to the generic title-cell link: keep its mono styling through
  `renderCell` or a class prop, but make it use `openPanel`. The row click calls `openPanel`
  instead of `router.push` (Design: List pages; fix 2)

### 3. Shared panel

- [ ] Add `components/resource/panel/panel-section.tsx`: the collapsible section (button with
  `aria-expanded` and `aria-controls`, chevron, " · N error(s)" count), moved from
  `order-item-panel.tsx` (Design: Shared components; AC 13)
- [ ] Add `components/resource/panel/use-panel-errors.ts`. Given a field → section map and the
  focus order, it returns `showErrors(errs)`, which expands the failing sections and focuses the
  first invalid field after render, plus the `open` state and its setter. Move the logic out of
  `order-item-panel.tsx` (Design: Shared components; AC 13)
- [ ] Add `components/resource/panel/panel-shell.tsx` (client), with props for the caption,
  heading, optional sub-link, detail href and label, `isDirty`, `pending`, `onSubmit`, `baseHref`
  and the record id. Move these from `order-item-panel.tsx`:
  - the side `<section aria-label="Edit <singular lower>">` with `max-lg:hidden` (fix 3)
  - the `Sheet` below 1024px (`useNarrow`)
  - the hydration `fieldset`
  - heading focus on open, and focus back to `[data-item-link="<id>"]` on unmount
  - Escape (skipped when a popover or listbox is open), and the "Discard changes?" dialog
  - the footer: "View <singular lower> ↗", Cancel and Save
  Closing uses `closePanel`. Expose a `close({ saved })` to children through a render prop or
  context. On unmount without close it calls `clearOpenedMarker(<its own URL>)` (Design: Shared components;
  fixes 2–3; AC 14, 17, 18)
- [ ] Add a shared `StatusChips` control (the radio-chip group from `order-item-panel.tsx`) that
  takes `options` and uses `statusColors` (Design: Shared components; AC 8, 9)
- [ ] Add a shared helper for the "Moved to <Status>." success toast with its View action. The
  View action marks the target URL (`markOpenedFromList`) and pushes the target tab's URL with
  `item`. The panel has already closed by then, so this is a fresh open (Design:
  Shared components; AC 10)

### 4. Order Items onto the shared panel

- [ ] Rebuild `components/order-items/order-item-panel.tsx` on `PanelShell`, `PanelSection`,
  `usePanelErrors`, `StatusChips` and the moved-toast helper. Keep only its item-specific
  content: the caption and line number, product name heading, client link, Product/Order reloads,
  Size, Quantity, Created, Due, Status, help text, stages, and the Details/Attributes sections.
  The detail link stays "View order" → `/orders/<order id>`. No behaviour change beyond the
  fixes (Design: Shared components; spec 06 AC 18–26 still pass)
- [ ] Fix 1, client side: in `onSubmit`, leave out `order_due_date` and `order_status` unless
  either is in `formState.dirtyFields`. Changing Order keeps setting both dirty (Design: Order
  Items save; AC 16)
- [ ] Fix 1, server side: make `order_due_date` and `order_status` optional in `panelSchema`,
  still validating a present value. In `saveOrderItemPanel`, write the order only when both are
  present and differ from the stored values. Return the stored status when they are absent, for
  the moved-tab check (Design: Order Items save; AC 16, 20, 21)

### 5. Generic panel and list page

- [ ] Add `components/resource/record-panel.tsx` (client), built on `PanelShell`:
  - Form: `useForm` with `zodResolver(buildSchema(key, "edit"))` and `initialValues(key,
    record)`. The caption is the singular in sentence case and the heading is `recordTitle`.
  - Sub-link: the orders client (`/clients/<client_id>`) and the dockets To client
    (`/clients/<to_client_id>`).
  - Read-only values: fields with `form === false` and `detail !== false`, formatted like the
    detail page.
  - Fields: ungrouped form fields through `FieldControl` (with `refFilter` dependents as in
    `ResourceForm`; password optional on edit), with `chips` fields as `StatusChips`. Then the
    form heading, if any, and one `PanelSection` per group, collapsed.
  (Design: Shared components; AC 6, 8, 9, 11, 12)
- [ ] `RecordPanel` save:
  - It calls `saveRecord(key, id, values)` and ignores `redirectTo`.
  - On success it shows "<Singular> successfully updated", uses the moved-toast helper when the
    resource has `statusTabs`, the active tab is set and the saved status differs, then calls
    `close({ saved: true })`.
  - On failure it calls `setError` for each field error and `showErrors`, and shows the toast
    "Could not edit <Singular>: <error or 'please check the highlighted fields'>".
  (Design: Shared components; AC 7, 8, 10, 13)
- [ ] Extend `ResourceListPage`:
  - Read `?item=` and, when it is numeric, load `getRecord(key, id)` alongside the list.
  - When the resource has `statusTabs`, read and validate `?status=`, pass it to `listRecords`
    and load `countByStatus`.
  - Render `StatusTabs`, the table with `onRowOpen`, `selectedId` and `baseQuery`, and
    `RecordPanel` with `key={id}`. Show a not-found toast ("<Singular> not found") for an unknown
    numeric id.
  - Wrap it in the `flex` layout used by `OrderItemsListPage` so the panel sits beside the list.
  - Move `queryWithout` and the not-found toast into `components/resource/` and share them with
    Order Items.
  (Design: List pages; AC 1, 2, 6)
- [ ] Give the orders list a `renderCell` for `due_date` (date and `relativeDue` line) and pills
  for the status cells on orders and delivery_dockets. Pass them from `ResourceListPage`
  through a small per-resource map in `components/resource/` (Design: Config; AC 4, 5)
- [ ] Make sure changing tab, filter, sort or page keeps `?item` and keeps the same `RecordPanel`
  instance (stable `key`, same tree position), so unsaved edits survive. Check that `StatusTabs`
  and `FilterBar` don't drop `item` (spec: "Changing the list with a panel open"; AC 14)

### 6. Tests

- [ ] Unit: update `theme-contrast.test.ts` for `statusColors.current` and "status pill current".
  Update `resources-config.test.ts`:
  - every resource has a `titleField` that is one of its list columns
  - the `statusTabs` objects
  - no `status` filter on orders or dockets
  - `chips` on the two status fields
  (AC 1, 2, 4)
- [ ] Unit: `history.ts`. Cover:
  - mark then close calls `back` (plus `refresh` when saved)
  - no mark, or a different URL, calls `replace`
  - storage throwing calls `replace`
  - `openPanel` with no panel open marks and pushes
  - `openPanel` with a panel open replaces and moves a matching marker to the new URL, or
    leaves it unset when it didn't match
  - `clearOpenedMarker(own)` removes a matching key and leaves a different one alone
  (fix 2; AC 17)
- [ ] Integration: `list-query` covers `status` and `countByStatus` on orders and
  delivery_dockets, a resource without `statusTabs` throws, an unknown status means All, and
  orders rows have a `due_in_days` matching an `Intl` Brisbane-date computation (AC 3, 5)
- [ ] Integration: `order-item-panel.test.ts` covers fix 1:
  - a save without the order fields leaves an externally changed order untouched
  - a save with them still updates the order
  - a move with Due still updates the new order only
  - the returned status is the stored one when the fields are absent
  (AC 16)
- [ ] Integration: `saveRecord` refusal for an order with another client's docket returns the
  error "delivery docket belongs to another client" and writes nothing. A users edit with a blank
  password keeps the hash (AC 8, 12)
- [ ] E2E `tests/e2e/list-panels.spec.ts`, one test per AC:
  - AC 1, for each of the nine lists: row click opens the panel with `?item`, the row is
    `aria-selected`, there is no Edit column, the title link is focusable, and the Products link
    is on Name. The Orders Client link still navigates.
  - AC 2: the tabs on Orders and Dockets (counts under a filter, URL, page reset, reload,
    unknown → All, no Status filter).
  - AC 4: pills. AC 5: the Orders Due relative line under a fixed clock.
  - AC 6: direct load on all nine lists, with headings per resource, including a nameless user →
    email, a record outside the current page or tab, a non-numeric id, and an unknown id with
    the toast.
  - AC 7: Clients, Types, Sizes and Media save and show the row's new value.
  - AC 8: the Orders panel (Created read-only, chips, client link, Due save, Client clears
    Docket, docket options scoped to the client). For the refusal: pick a valid docket in the
    panel, move that docket to another client through the DB helper, then Save. The toast "Could
    not edit Order: delivery docket belongs to another client" appears, the panel stays open,
    and the order is unchanged in the DB. The server refusal itself is covered by integration.
  - AC 9: the Dockets panel.
  - AC 10: moved toasts on Orders and Dockets, with View.
  - AC 11: Products Category save; Categories with the heading, 13 sections, a flag save, and an
    empty Name error and focus.
  - AC 12: Users (heading fallback, name save and blank → NULL, blank password, short password
    error, using a non-signed-in user).
  - AC 13: a collapsed-section error on Categories.
  - AC 14: discard dialog, Escape, focus return, View link, sheet at 800px, tab switch keeping
    edits.
  (AC 1–14)
- [ ] E2E (fix tests) in the same file:
  - AC 16: open an Order Items panel, change the order's due date and status through the DB
    helper, save Quantity only, and check the order kept the DB values.
  - AC 17 on Order Items and Clients: Cancel then one Back leaves the list; Save then one Back
    leaves the list and the row shows the saved value; a direct load then close stays on the
    list; navigate away and load directly then close stays on the list; Back closes an open
    panel; open A, then B, Cancel lands on the list without `?item` and one more Back leaves
    the list.
  - AC 18: with JavaScript disabled at 800px, no visible side panel on Order Items and Clients;
    at 1280px it is visible.
  (AC 16–18)
- [ ] E2E: extend `shell.spec.ts` axe checks with `/orders?item=`, `/delivery-dockets?item=`,
  `/product-categories?item=` and `/users?item=` (AC 15)
- [ ] Update the existing e2e specs that click a row or the Edit link to reach a detail or edit
  page (`crud.spec.ts`, `lists.spec.ts`, `forms.spec.ts`, `users-name.spec.ts`,
  `users-combobox.spec.ts`), or that use the Orders/Dockets Status filter. Navigate to
  `<path>/<id>` or `<path>/<id>/edit` directly, or use the panel or the tabs. Record each change
  in the implementation changelog (spec: Impact on earlier specs)
- [ ] Confirm the existing session checks still cover `saveRecord` and the 06 panel actions
  (`actions.test.ts`, `order-item-panel.test.ts`) (AC 19)

### 7. Finish

- [ ] Run lint, typecheck, unit, integration, and e2e (`npm run build && PORT=3100 npx
  playwright test`, so the author's dev server on :3000 isn't reused) (all ACs)

## Not in this feature

- Delete or Print inside a panel. They stay on the edit and detail pages.
- Creating records in a panel. "New <singular>" still opens the create page.
- Protecting the other resources' edit forms and panels against stale writes generally (sending
  only changed fields through `saveRecord`). Fix 1 covers only the order fields saved from an
  Order Items panel.
- Hiding columns beside the panel on lists other than Order Items.
- The order's items inside the Orders panel, and anything else from spec 04.
- Panels on detail or edit pages.
- Changes to the design's look beyond applying the existing panel, tab and pill styles.
