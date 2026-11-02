# Revision changelog — 07-list-panels

- Date: 20261102-121443
- Feature: 07-list-panels
- Phase: 4 (Review)
- Addresses: `20261102-121053--review--FAIL.md`

- **Finding 1 (focus return to a hidden link):** `PanelShell` now focuses the first *visible*
  `[data-item-link="<id>"]` when the panel goes away (`components/resource/panel/panel-shell.tsx`).
  New e2e test in `tests/e2e/list-panels.spec.ts` (07 AC-14 block): a client and an order share
  an id, the Orders list stays mounted (hidden) after client-side navigation to Clients (the test
  asserts both links exist), and Escape on the client's panel returns focus to the client's row
  link.
- **Finding 2 (half-sent order change):** `saveOrderItemPanel` returns a field error
  ("Required") on the missing one when exactly one of `order_due_date` / `order_status` is
  sent, and writes nothing (`lib/order-items/panel-actions.ts`). New integration tests in
  `tests/integration/list-panels.test.ts` for both halves.
- **Nit (duplicate id checks):** one `isId` in `lib/ids.ts`; `lib/order-items/stages.ts`
  re-exports it, and the list pages (`components/resource/pages.tsx`,
  `components/order-items/order-items-page.tsx`) use it instead of `isItemId`. No behaviour
  change.
