# Implementation changelog — 08-create-dialogs

- Date: 20261102-161937
- Feature: 08-create-dialogs
- Phase: 3 (Implementation)

## 20261102-161937 — implement

### Tests (written first)

- `tests/unit/resources-config.test.ts`: descriptions, `resourceAddLabel` and `resourceCreateTitle` for all ten resources (AC-1, AC-2).
- `tests/unit/theme-contrast.test.ts`: `dialogTokens` and the three dialog contrast pairs (AC-2, AC-14).
- `tests/unit/panel-history.test.ts`: the layered marker (two layers, dialog key, row switch, `clearOpenedMarker`, malformed values) (AC-12). The three spec 07 assertions on the raw stored value now parse the list, as approved at task review; nothing else in that file changed.
- `tests/integration/create-dialogs.test.ts`: the `saveRecord` results the dialog acts on (list vs docket detail redirect, two creates, users password and NULL name) (AC-4 – AC-6, AC-9).
- `tests/e2e/create-dialogs.spec.ts`: one test group per AC-1 – AC-13. `tests/e2e/shell.spec.ts`: axe with the dialog open on three lists (AC-14).
- `tests/e2e/lists.spec.ts:41` expects the `?new=1` href; `:177` expects the "New product type" dialog (task review, per the spec's Impact section).

### Build

- **Config:** `ResourceUi.createDescription` on every resource; `resourceCreateTitle` ("New <singular>") and `resourceAddLabel` ("Add <New label without New>") in `lib/resources/index.ts` (AC-1, AC-2).
- **Theme:** `dialogTokens` in `lib/theme/palette.ts` and contrast pairs for the description, the "(optional)" hint and the footer label. The design's `#7d878b` hint grey fails AA on white (3.7:1), so the hint uses `palette.subtle` (#697175), as spec 06 did for the same grey (AC-14). `app/globals.css`: `.create-dialog` gives the design's 40px controls, 13px labels and teal focus ring.
- **History:** `components/resource/panel/history.ts` stores `panel-opened` as a JSON list, one URL per open layer. `openPanel(router, href, key = "item")` pushes and adds a new layer, or replaces and swaps the entry when switching rows; `closePanel` goes back when the current URL is listed and afterwards keeps only the entry of the layer underneath; `clearOpenedMarker` removes only its own URL; anything that isn't a list of strings counts as empty (Design: History; AC-12).
- **`FieldControl`:** an `optionalHint` prop puts "(optional)" (`data-optional-for`) after optional fields' labels instead of the required asterisk. Switches never show it: an on/off control has no empty state, so "(optional)" on all 40 category flags would add noise without meaning (AC-3).
- **`QuantityStepper`** (`components/resource/quantity-stepper.tsx`): − / + around `NumberInput`; − disabled at 1 or when empty, + starts at 1 (AC-10).
- **`CreateDialog`** (`components/resource/create/create-dialog.tsx`): Base UI dialog parts from `components/ui/dialog.tsx` plus the Base UI popup: overlay, header, scrolling body, footer with Create another, Cancel and Add / "Adding…"; Escape, ×, Cancel and overlay click go through "Discard changes?" when dirty; `closePanel` to the URL without `new`; focus to the first field on open and back to the "New …" button on close; `clearOpenedMarker` when it unmounts without closing (AC-2, AC-11 – AC-14).
- **`useCreateForm` / `RecordCreateForm`** (`components/resource/create/record-create-form.tsx`): the create page's schema, defaults and `saveRecord`; ungrouped fields in two columns, then the form heading and collapsed `PanelSection`s; a ref guard so a double click submits once; on success the toast, then the docket's `router.replace` to its detail page (dropping the dialog's entry), Create another (reset keeping the `keep` fields, focus on the first field reset, refresh), or close with `saved: true`; errors through `usePanelErrors` and "Could not create <Singular>: …" (AC-3 – AC-9, AC-13).
- **`OrderItemCreateForm`** (`components/order-items/order-item-create-form.tsx`): Order, Product, read-only Size (via `getProductPanelInfo`, "—" until a product is chosen) beside the Quantity stepper, then Part Number, Height, Width, Depth and Comment, then collapsed Attributes and Stages. Stages are on the item's create form too, so they come along, as on the create page. Create another keeps Order and focuses Product (AC-5, AC-7, AC-10).
- **List pages:** `NewRecordLink` (`components/resource/create/new-record-link.tsx`) is a real link to the list query plus `new=1`, opened with `openPanel(…, "new")` on a plain click. `ResourceListPage` and `OrderItemsListPage` render the dialog when `new` is exactly "1"; the panel's base query and row links drop `item` and `new` (`queryWithout` now takes several keys); the dialog closes to the URL minus `new` only (AC-1, AC-11, AC-12).
- **Panel under the dialog:** `PanelShell` takes `covered`; it then ignores Escape, and below 1024px renders nothing while staying mounted, so its edits and history entry survive and the sheet returns when the dialog closes (D 6; AC-12).
- **`/new` pages:** unchanged (AC-15).

### Test fixes during the build (tests written in this phase)

- AC-4 picked the product Type and Media by name; their options are labelled "<code> · <name>".
- AC-5 looked for the new row with a role query while the modal dialog was open; the list behind it is `aria-hidden`, so the query now includes hidden elements (the row must still be visible).

## 20261102-163337 — fix

- Failure (`20261102-163337--tests--FAIL.md`): `tests/e2e/lists.spec.ts:171` found two visible "Name"
  inputs, the dialog's field and the list's Name filter behind the dialog. The implementation is
  as specified (the list stays under the dialog), so nothing in the app changed. With the author's
  approval (2026-11-02), the test's final lookup is scoped to the "New product type" dialog; its
  duplicate-id check is unchanged.
