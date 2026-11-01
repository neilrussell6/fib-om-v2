# Spec revision changelog — 06-order-items-design

- Date: 20261101-221402
- Feature: 06-order-items-design
- Phase: 1 (Spec)

Non-blocking items from the second spec review (no blocking items), each accepted by the author.

- **N1 (order fields reaching `updateRecord`):** Save step 2 now splits the validated values.
  Only item fields go to `updateRecord`; `order_due_date` and `order_status` are used only for
  the order update. A unit test asserts this.
- **N2 (blank Name):** `users.name` is trimmed and a blank name is saved as `NULL`. The sidebar
  falls back to the email when the name is null or blank. AC-10 is extended to cover clearing the
  name.
