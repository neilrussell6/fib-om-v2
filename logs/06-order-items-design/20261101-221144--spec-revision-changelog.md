# Spec revision changelog — 06-order-items-design

- Date: 20261101-221144
- Feature: 06-order-items-design
- Phase: 1 (Spec)

Addresses `logs/06-order-items-design/20261101-220928--spec-review--FAIL.md`. Every change below
was agreed with the author item by item. The spec was rewritten in full because the status model
changed throughout.

## Blocking

- **B1 (window functions in the view):** removed `line_number` and `order_item_count` from
  `order_items_v`. They are now correlated counts in the panel's single-item query. The view
  migration is dropped entirely (the view already has every list column). Design → Order items:
  data / panel.
- **B2 (`order_id` in Save):** the panel now holds every field of the item form, Order included
  (a combobox). Created, Due and Status follow the selected order (`getOrderPanelInfo`). Save
  updates the item first, then the order's due date and status, using the item's order id read
  back after the update. Unknown orders become a field error. New AC-21; AC-27 (sessions).

## Non-blocking (all applied)

- **N1:** `getProductPanelInfo` refreshes Size and Stages on a product change, keeping every
  stage's value (AC-22).
- **N2:** done-but-hidden stages are listed with "Not used by this category" and can be unticked
  (AC-22). The author's note that the design is a visual reference, not a field or data spec, is
  added as a preamble.
- **N3:** errors in collapsed sections auto-expand, focus the field and show a count on the
  section header (AC-23).
- **N4:** the Due preset and the `preset` filter kind are removed (the author said to ignore the
  design's Due control). Due and Created stay ordinary From/To range filters (AC-14).
- **N5:** the sidebar Suspense fallback renders the no-cookie layout. AC-5 checks for no width
  change during load.
- **N6:** a "Moved to <Status>" toast with a View action when a saved item leaves the tab (AC-25).
- **N7:** `contrastPairs` gains teal on `#eef5f6`, `#2c3438` on `#fafbfb`/`#f3f5f5`, and the three
  status pills (AC-2).

## Author decisions

- **Status = the order status (New / Complete / Archived).** It is used for the tabs, pills and
  editable panel chips. Removed: derived `item_status`, `deriveItemStatus`, its precedence AC, and
  the In production/Ready/Dispatched tabs. Colours: new → blue, complete → green, archived → grey.
  The help text says Due and Status apply to the whole order.
- **Time zone:** `APP_TIME_ZONE = "Australia/Brisbane"` (AC-15).
- **Display name:** a new nullable `users.name` column (migration), a Name field and column on
  Users, and the sidebar shows the name or falls back to the email (AC-4, AC-10).
- **Open questions:** all resolved; the section now says "None".

## Other

- Acceptance criteria renumbered AC-1…AC-27. A vague layout-shift criterion added during the
  rewrite was removed. Cross-references in "Impact on earlier specs" are updated, and that section
  notes that panel status changes affect the notcher feed the same way the order edit page does.
- `research.md` is left as written (a historical record). Where it differs, the spec's decisions
  supersede it.
