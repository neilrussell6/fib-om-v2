# Research — 08-create-dialogs

- Date: 20261102-123259
- Feature: 08-create-dialogs
- Phase: 1 (Spec)

## Goal

The author updated the "Order Items" design (Claude Design project
`338369ce-2e1a-45a7-bb17-43ffbba7c267`, file `Order Items.dc.html`) with a popup for creating a
record. They want it implemented for every create form (2026-11-02): "New <thing>" opens a dialog
over the list instead of navigating to the `/new` page. The design is a visual reference only
(`designs-are-visual-reference`): fields and rules come from each resource's real create form.

## The design's dialog (from `Order Items.dc.html`)

- **Overlay:** fixed, `rgba(18,30,34,.42)`, centres the dialog with 24px padding; clicking it
  closes the dialog.
- **Dialog:** `role="dialog"`, `aria-label="New order item"`, white, `max-width: 560px`,
  `max-height: 100%`, radius 10px, shadow `0 24px 60px rgba(0,0,0,.22)`; header, scrolling body,
  footer.
- **Header** (padding 20px 24px 16px, bottom divider): title "New order item" (20px, semibold,
  -0.01em), a description under it ("Add a product line to an existing order.", 14px,
  `#5e686d`), and a 32px × close button (hover `#eef0f0`).
- **Body** (padding 20px 24px, 18px gap): 13px/500 `#2c3438` labels over 40px controls with a
  `#d3d8da` border and 6px radius. The focused control has a `#0f5566` border and a
  `0 0 0 3px rgba(15,85,102,.14)` ring. Pairs of short fields sit in two columns. Optional fields
  are labelled "Notes (optional)", with "(optional)" in 400 weight `#7d878b`.
  - Order Items fields shown: Client and Order side by side, Product (search combobox), Size as
    chips, Quantity as a − / + stepper (150px), "Due date" with the help text "Defaults to the
    order's due date", Notes (textarea, placeholder).
- **Footer** (padding 14px 24px, top divider, `#fafbfb`): a "Create another" checkbox (16px box,
  teal when checked), Cancel (outline), and the primary "Add item".

## Current state

- **Create pages.** Every resource has `app/(app)/<resource>/new/page.tsx` rendering
  `ResourceCreatePage` (`components/resource/pages.tsx`): a "Create a <Singular>" heading, Back,
  and `ResourceForm` in create mode.
- **ResourceForm** (`components/resource/resource-form.tsx`): `buildSchema(key, "create")`
  (password required on users), `initialValues(key)` (field `default`s, e.g. order status
  "new", docket status "current"), ungrouped fields in a two-column grid, groups as fieldsets
  under `formHeading`. Saves through `saveRecord(key, null, values)`, then pushes
  `result.redirectTo`: the list, or the new record's detail page when `afterCreate: "detail"`
  (delivery dockets, so orders can be added there; spec 04 builds on it).
- **Create rules** (`applyRules`): dockets take `from_client_id` from `FROM_CLIENT_ID` and fail
  with "sender client is not configured" without it; users hash the password; orders refuse
  another client's docket.
- **List header.** `ResourceListPage` and `OrderItemsListPage` render "New <singular>" as a
  `LinkButton` to `<path>/new`.
- **Panels (07)** already solve most of what a dialog needs: `?item=` in the URL, the shared
  history helpers (`openPanel`/`closePanel`, which key off `item`), the discard dialog, error
  sections (`usePanelErrors`, `PanelSection`), `FieldControl` with `refFilter` dependents, and
  `StatusChips`.
- **Spec 04** (not built) uses `/order-items/new?orderId=<id>&returnTo=<order page>` from the
  order detail page, so the `/new` pages should keep working.

## Constraints & risks

- **Fields.** The design's Order Items fields differ from the real form. Size is derived from the
  product (read-only, as in the panel); "Due date" belongs to the order; Client isn't an item
  field; Notes is the item's Comment; and the real form also requires Part Number, Height, Width
  and Depth, plus the Attributes group. The dialog must hold the real create form.
- **Long forms.** Product Categories has about 40 checkboxes in 13 groups, and Order Items has the
  Attributes group, so the body must scroll and groups should collapse, as in the panels.
- **Dockets go to their detail page after create** (spec 02, and spec 04 depends on it).
- **History.** A dialog that sets a URL key needs the same "Back after closing" behaviour as the
  panels. The helpers currently only know `item`.
- **Panel and dialog together.** A panel can be open when "New" is clicked.
- **Tests.** Many existing e2e tests use `/new` pages directly; those keep working if the pages
  stay.

## Open questions

1. Keep the `/new` pages? (Recommended: yes, for spec 04's links and direct URLs; the list
   button opens the dialog instead.)
2. Order Items: include the design's Client (to narrow orders), the order's Due date and the
   Quantity stepper, or only the real item form fields?
3. What does "Create another" keep between records?
