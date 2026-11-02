# Research — 07-list-panels

- Date: 20261102-090834
- Feature: 07-list-panels
- Phase: 1 (Spec)

## Goal

Spec 06 restyled every list, but only Order Items got the design's behaviour. The author wants
that behaviour on every other list (2026-11-02):

1. **Click-to-edit panel.** Clicking a row opens a right-hand edit panel with every field of the
   resource's form (a sheet below 1024px), instead of going to the detail page. Applies to
   Orders, Delivery Dockets, Clients, Products, Product Categories, Product Types, Product Sizes,
   Product Media and Users.
2. **Status tabs.** Lists with a status get tabs with counts, replacing their Status filter:
   Orders (New / Complete / Archived) and Delivery Dockets (Current / Archived).
3. **Status pills and relative due.** Status columns become coloured pills. The Orders Due column
   gets the relative line ("2d overdue", "in 3d") Order Items already has.
4. **The three 06 review follow-ups** are folded into the shared panel
   (`logs/06-order-items-design/20261102-090312--review--PASS.md`): a stale panel overwriting the
   order's due date or status, the extra history entry left after closing, and the side panel
   flashing before the sheet on narrow screens.

The design (`Order Items.dc.html`) only shows Order Items, so the other panels apply its patterns
(panel frame, header, sections, chips, footer) to each resource's real form fields
(`designs-are-visual-reference`).

## Current state

- **Generic list page.** `components/resource/pages.tsx` `ResourceListPage` renders
  `PageHeader`, `FilterBar`, `DataTable` and `Pagination` for every resource except Order Items.
  Each `app/(app)/<resource>/page.tsx` is a one-liner calling it.
- **Row behaviour.** `components/resource/data-table.tsx`: without `onRowOpen` a row click goes to
  `<path>/<id>`, the first non-link column ("primary" cell, `:58`) links to the detail page, and
  each row has an Edit link to `<path>/<id>/edit` (`:103`, `:174`). With `onRowOpen` (Order Items
  only) the row click calls it, there is no Edit column and rows can be `aria-selected`.
- **Generic form.** `components/resource/resource-form.tsx` `ResourceForm` builds the zod schema
  from `buildSchema(key, mode)` (`lib/resources/schema.ts`), renders ungrouped fields and then each
  `group` as a labelled section (product categories: 13 groups, about 40 checkboxes, plus
  `formHeading`), and saves through `saveRecord` (`lib/resources/actions.ts`). `FieldControl` is
  already exported (06) and handles `refFilter` dependents (Orders: Delivery Docket narrowed by
  Client; changing Client clears it). On success it `router.push(result.redirectTo)`.
- **Save rules** (`applyRules`, `lib/resources/actions.ts:34`): users hash a non-blank password
  and bump the session version (blank keeps the current one on edit); dockets never take
  `from_client_id` from the form; orders refuse a delivery docket of another client.
  `saveRecord` validates the full edit schema, so it always writes every form field.
- **Detail and edit pages** stay at `<path>/<id>` and `<path>/<id>/edit`. Delete exists only on the
  edit page (`DeleteButton`). Print exists only on the detail page.
- **Order Items panel (06).** `components/order-items/order-item-panel.tsx` (533 lines) mixes
  generic panel mechanics with item-specific content:
  - generic: side `<section aria-label>` vs `Sheet` below 1024px (`useNarrow`, `:54`), hydration
    fieldset, heading focus on open, focus back to the row's link on unmount, Escape, the discard
    `AlertDialog`, `close()` via `router.replace` (`:143`), collapsible sections with error counts
    and focus-first-error, the "Moved to X" toast
  - item-specific: order caption and line number, Product/Order reloads, the order's Due/Status,
    stage chips, Details/Attributes split
- **Status tabs (06).** `components/order-items/status-tabs.tsx` is hard-wired to `ORDER_STATUS`.
  `lib/db/list-query.ts` `listRecords({status})` and `countByStatus` are gated by
  `list.statusTabs` and hard-code the column `order_status` and the cast `::order_status`.
- **Status data.** `orders.status` is `order_status` (new/complete/archived, filter
  `eq("status","order_status")`); `delivery_dockets.status` is `docket_status` (current/archived,
  `DOCKET_STATUS`). Both lists have a Status filter with `alwaysShown: true`.
- **Pills.** `components/order-items/status-pill.tsx` and `lib/theme/palette.ts` `statusColors`
  cover only new/complete/archived. There is no colour for `current`.
- **Relative due.** `lib/order-items/relative-due.ts` works from `due_in_days`, computed in SQL
  against `APP_TIME_ZONE` (order_items select, `lib/db/queries/resources.ts`). `orders_v` has
  `due_date` but no `due_in_days`.

## Prior art

- Everything in 06 that isn't item-specific can move into shared components: a panel shell
  (frame, sheet, Escape, discard, focus, history, sections), a generic `StatusTabs`/`StatusPill`
  driven by an options list, and the `due_in_days` select expression.
- `FieldControl` already renders every field type with ids from a prefix, so a generic panel body
  is mostly "ungrouped fields, then one collapsible section per group", like `ResourceForm`.
- The 06 tests (`tests/e2e/order-items.spec.ts`, `tests/integration/order-items-list.test.ts`,
  `order-item-panel.test.ts`) are the template for per-list tests.

## Constraints & risks

- **Earlier specs change.** Spec 02's "clicking a row opens the detail page, and each row has an
  Edit action" (spec 02 Summary, and its row/Edit e2e checks in `crud.spec.ts`/`lists.spec.ts`)
  stops holding for every list. Detail pages must stay reachable (Print, and spec 04's order and
  docket detail panels build on them), so each panel needs a link to its detail page.
- **Spec 04** adds an Order Items panel on the order detail/edit pages and an orders table on the
  docket detail page. Those stay on the detail pages; nothing here blocks them. Spec 04 still
  needs a revision for 06 and now for 07.
- **Users.** Editing yourself in a panel works like the edit page. Password stays optional on
  edit; a non-blank password signs that user out everywhere (including yourself).
- **Product categories** have about 40 checkboxes in 13 groups: one collapsible section per group
  would be 13 sections. A long panel body must scroll inside the panel.
- **Stale writes.** `saveRecord` writes every form field, so a stale panel (or the edit page)
  can overwrite another user's change to any field. That's existing behaviour of every edit
  form. The 06 follow-up only covers the order fields saved from an Order Items panel; a general
  "send only changed fields" change would touch `saveRecord` for every resource.
- **Generic `statusTabs`.** The status column, enum type and options differ per resource, so the
  flag must become a config (column + options) with the SQL cast kept in the server-side query
  config, not the client-safe resource config.
- **URL key.** 06 uses `?item=<id>`. Reusing it everywhere keeps one code path and the 06 tests;
  a resource-neutral name (e.g. `?edit=`) would break 06's links and tests.
- **Contrast.** A new pill colour for `current` must pass 4.5:1 (the 06 contrast test).

## Open questions

1. Colour for the docket `current` pill. Reusing the `new` blue pair is the obvious choice
   (both mean "active").
2. Should panels offer Delete, or leave it on the edit page (06's panel has none)?
3. Does the Orders panel need anything beyond the order form's fields (e.g. its item count, or
   the order's items)? Spec 04 puts the items panel on the order detail page.
