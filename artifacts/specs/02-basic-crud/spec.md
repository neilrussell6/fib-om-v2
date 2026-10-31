# Spec — 02-basic-crud

- Date: 20261031-140121
- Feature: 02-basic-crud
- Phase: 1 (Spec)

> Part 2 of 4 of the FIB OM migration. Read with the overview
> [`artifacts/docs/nextjs-vercel-neon-migration.md`](../../docs/nextjs-vercel-neon-migration.md)
> (sections O1–O9). Depends on `01-users-auth`. Next: `03-custom-behaviour`.

## Summary

Create the full database schema and give every resource plain list, detail, create, edit and delete screens: Users, Clients, Products, Product Categories, Product Types, Product Sizes, Product Media, Orders, Order Items and Delivery Dockets. The screens share one set of building blocks (server-rendered table with URL-synced filters, sort and pagination; async reference combobox; form + Server Action pattern with toasts; delete confirmation; SQLSTATE error mapping; print styles) so that every resource behaves the same. Behaviour that goes beyond plain CRUD (order items panel, category-driven columns, stage toggles, derived columns, docket print layout and order management, notcher feed) is in `03-custom-behaviour`.

## User-visible behaviour

### Common behaviour (all resources)

**Navigation**
- Each resource's sidebar entry is added in the final order (spec 01): Dashboard, Orders, Order Items, Delivery Dockets, Clients, Product Categories, Product Media, Products, Product Sizes, Product Types, Users.
- Page headings: `<Resource plural>` (list), `<Resource>` (detail), `Edit <Resource>` (edit), `Create a <Resource>` (create).

**Lists**
- A server-rendered table. Clicking a row opens the detail page, and each row has an Edit action. There are no bulk actions. A Create button opens the create form.
- Columns can be sorted by clicking the header. Each resource has a default sort (tables below).
- Pagination with page sizes 10/25/50/100, default **25** **(improvement: web3 uses 10)**. A total count is shown.
- **Filters:**
  - some filters are always shown; the rest are added from an "Add filter" menu, as in web3
  - every filter is kept in the URL (`nuqs`), so a filtered list can be bookmarked
  - a filter can be cleared on its own, or all at once
- **Text matching (improvement):** contains, case-insensitive, everywhere (list filters and combobox searches), backed by `pg_trgm` GIN indexes on searched text columns. (web3 matches from the start in comboboxes.)
- **Reference comboboxes** search the server as you type (debounced), load 25 at a time, and are keyboard accessible (shadcn `Command` in a `Popover`).

**Detail pages**
- A labelled read-only layout, with actions **Back**, **Print** and **Edit**. Print calls `window.print()`.

**Create and edit**
- A single form per resource, built with react-hook-form and zod. The zod schema is shared with the Server Action, which validates again on the server.
- Errors are shown inline next to the field, and checked on blur.
- The edit page has actions **Back** and **Show**, plus **Delete**, which opens a confirmation dialog.
- **Saves are confirmed by the server:** the button shows a pending state, and nothing is applied optimistically.
- **On success:** a toast "<Resource> successfully created/updated", then redirect to the list (except a new delivery docket, which goes to its detail page), and the affected pages are revalidated.
- **On failure:** a toast "Could not create/edit <Resource>: <message>", with the message from "Database errors" below.
- **Delete:** on success a toast "<Resource> successfully deleted" and redirect to the list; on failure "Could not delete <Resource>: <message>".
- Number inputs don't change value on mouse-wheel scroll.

**Accessibility (improvement)**
- Every control has a label. Keyboard navigation works in tables, comboboxes and dialogs.

### Reference data and users

| Screen | Default sort | Filters | List columns | Form fields |
|---|---|---|---|---|
| Users | email ↑ | email | email | email (required), password (required on create; on edit, blank = unchanged) |
| Clients | name ↑ | name | name, full name, phone, shipping address | name, full name, phone, shipping address, billing address, ABN, ACN, fax, landline, label reorder text, label name, label sub-name, label address line 1, label address line 2, label use part number (switch) |
| Products | category name ↑ | name, type (combobox), size (text), media (text), category (combobox), efficiency (text) | category, type name, type code, name, size, media | name, category, type, size, media (comboboxes, required), notcher (switch), efficiency |
| Product categories | name ↑ | name | name | name, plus every `show_*` flag as a switch, grouped under the heading "Columns to show on Order Items page (for this category)", with the groups from legacy `productCategories.jsx` |
| Product types | code ↑ | name, code | name, code, mm per pleat | name, code, mm per pleat |
| Product sizes | name ↑ | name | name | name only (any other columns in the schema dump are stored and imported, but not shown or editable, as in web3) |
| Product media | code ↑ | name, code | name, code, pleat spacing | name, code, pleat spacing (number) |

- **Users:** passwords must be at least 12 characters (same shared zod rule as `create-user`, spec 01); they are stored only as bcrypt hashes and never displayed or returned.
- **Product type filter (improvement):** filters on `type_id` (web3 wrongly puts the id onto `type_name`). Size and media stay as text filters on the joined names.

### Orders (basic)
- List sorted by created date, newest first. Filters: client, order number, due date range, created date range, status, delivery docket. Columns: client (links to client), order number, delivery docket (shown zero-padded to 6 digits), created, due, status.
- Create/edit: client (combobox, required), order number (required), due date (required), status (required, default New), delivery docket (combobox, optional, shown zero-padded).
- Status choices: New, Complete, Archived.
- `date` (created date) isn't on the form; the database sets it (`DEFAULT current_date`).
- Detail shows client, order number, created date, due date, status, delivery docket. (The order items panel is added in spec 03.)

### Order items (basic)
- List sorted by order due date, newest first. Columns: client, order number, created, due, status. Filters: client, order, order status, due/created date ranges, type code, part number, H/W/D ranges. (The category filter and category-driven columns are added in spec 03.)
- Detail page: order, product, type code/description, part number, quantity, height, width, depth, comment, every category attribute, order status and the 7 stage statuses (cut, sow, frame, media, wire, package, assemble).
- Form fields: order, product (both comboboxes, required), part number, qty, H, W, D (all required), comment, then the category attributes and the 7 stage-status switches:

| Attribute | Type | Choices |
|---|---|---|
| `has_wire_header`, `has_header_frame`, `has_gasket`, `has_legs`, `has_gate` | bool | |
| `type` | text | |
| `number`, `pockets`, `drawing_number`, `cut_count`, `sow_count` | int | |
| `clip_type` | enum | Pocket, Bag, HEPA, Gate, Ring |
| `clip_position` | enum | Bevel, Ludwig, Clamp |
| `wire_mesh` | enum | 0, 1, 2 |
| `wire_sides`, `media_mats`, `gasket` | enum | 1, 2 |

### Delivery dockets (basic)
- Statuses: Current, Archived; default Current.
- List sorted by date, newest first. Filters: to-client name, docket number, created date range, and status (always shown). Columns: to-client, docket number, date, status.
- Create: to-client (combobox, required) and status. `date` comes from `DEFAULT current_date`; `fromclient_id` comes from the `FROM_CLIENT_ID` env var on the server and is not on the form. On success it goes to the **new docket's detail page**.
- Edit: to-client (combobox) and status.
- Detail (basic): date, docket number, from-client, to-client, status. (The print layout and order management replace this in spec 03.)

### Database errors and messages
The new build maps **Postgres SQLSTATE codes** to web3's friendly wording in one helper, `lib/db/errors.ts`. Most cases are caught earlier by zod, so these are a backstop:

| SQLSTATE | Meaning | Message (same wording as web3) |
|---|---|---|
| `23503` on delete | FK violation | "cannot delete <table> that still have <referencing table>", e.g. "cannot delete clients that still have orders" |
| `23502` | not null | "please provide a <column without _id>" |
| `23514` | check | "please provide a valid <column>" |
| `22P02` | invalid integer | "please provide a valid integer" |
| `22007` / `22008` | invalid date | "please provide a valid date" |
| `23505` | unique (users.email only) | "email already in use" |

Any other error is logged on the server, and the user sees "Something went wrong". Raw database text is never shown.

### Printing (generic)
- Print styles (Tailwind `print:` variants): hide the sidebar, top bar, toolbars and anything marked screen-only; show anything marked print-only; force all text to black; add space above section headings.
- An A4 `@page` size with sensible margins **(improvement)**.

## Design

- **Schema** (Atlas migrations, written from the author's production schema dump; conventions O6):
  - `clients`, `product_categories`, `product_types`, `product_sizes`, `product_media`, `products`, `orders`, `order_items`, `delivery_dockets`, with snake_case columns mapping 1:1 to the legacy columns in O2.1 (e.g. `address_shipping`, `label_use_part_number`, `millimetres_per_pleat`, `pleat_spacing`).
  - Identity primary keys (so legacy ids can be inserted with `OVERRIDING SYSTEM VALUE` in spec 04).
  - `products.category_id/type_id/size_id/media_id` `NOT NULL`, FK `ON DELETE RESTRICT`.
  - `orders.client_id` `NOT NULL`; `orders.delivery_docket_id` nullable; `orders.date DEFAULT current_date`; `orders.status` enum `order_status` (`new | complete | archived`), default `new`.
  - `order_items.order_id`, `product_id` `NOT NULL`, FK `ON DELETE RESTRICT`; required fields `NOT NULL`; the 7 `<stage>_status` booleans `NOT NULL DEFAULT false`; category enums as Postgres enums.
  - `delivery_dockets.status` enum `docket_status` (`current | archived`) default `current`; `date DEFAULT current_date`; `docket_number` a generated column `lpad(id::text, 6, '0')`; `from_client_id`, `to_client_id` FK to clients.
  - `product_categories.show_*` booleans: one per order-item column in the fixed column list in spec 03.
  - No unique constraint on order number; no `CHECK` constraints on quantities or dimensions.
  - `pg_trgm` extension and GIN trigram indexes on every text column used by a filter or combobox search.
  - Display views `products_v`, `orders_v`, `order_items_v`, `delivery_dockets_v` with the joined names (O5). Derived formula columns are added in spec 03.
- **Shared building blocks:** `components/data-table/` (TanStack Table, `nuqs` URL state, filter bar with "Add filter", pagination), `ReferenceCombobox` (server search Route Handler or Server Action, debounce, 25 per page), a form helper wiring react-hook-form + zod + Server Action + toasts, a `ConfirmDialog`, `lib/db/errors.ts`, and print utilities.
- **Query modules:** one file per resource in `lib/db/queries/`, following O5 (allowlisted filters/sorts, `count(*) OVER ()`, parameterised).
- **Server Actions** check the session first (spec 01) and revalidate the list and detail paths they affect.

## Acceptance criteria

Automated (unit, integration against Postgres with migrations applied, or Playwright):

1. **AC-1** All migrations apply cleanly to an empty database; `npm run db:validate` and `atlas migrate lint --latest 1` pass.
2. **AC-2** The schema has the tables, enums, `NOT NULL` columns, `ON DELETE RESTRICT` foreign keys and generated `docket_number` described in Design; a test inserting a docket with id 42 reads back `docket_number = '000042'`.
3. **AC-3** Two orders with the same order number (same client and different clients) both save; an order item with quantity `-1` or height `0` saves (no new `CHECK` constraints).
4. **AC-4** Every text column used by a list filter or combobox has a `pg_trgm` GIN index (checked against `pg_indexes`).
5. **AC-5** For each of the ten resources, a Playwright test creates a record, sees it in the list, opens its detail page, edits it, and deletes it, with the success toasts given above.
6. **AC-6** Each list's default sort, filters and columns match the tables in this spec when the URL has no params.
7. **AC-7** Clicking a sortable column header sorts by it and toggles direction on a second click.
8. **AC-8** Page size defaults to 25 and can be 10/25/50/100; a `pageSize` outside that set falls back to 25; the total row count is shown.
9. **AC-9** Applied filters, sort and page appear in the URL; loading that URL shows the same rows; each filter can be cleared on its own, and "Clear all" removes all of them.
10. **AC-10** Filters not shown by default can be added from an "Add filter" menu.
11. **AC-11** Text filters and combobox searches match case-insensitively anywhere in the value (a search for `cme` finds client "ACME").
12. **AC-12** Reference comboboxes send at most one search per debounce window, return at most 25 options per request, and work with the keyboard only (open, type, arrows, Enter, Escape).
13. **AC-13** Query modules reject unknown filter and sort keys, and an injection string in a filter value is treated as data (integration test: no SQL error, no rows altered).
14. **AC-14** Every detail page shows labelled read-only fields and Back, Print and Edit; Print calls `window.print()`.
15. **AC-15** Invalid input shows an inline error next to the field on blur; posting the same invalid data straight to the Server Action (bypassing the client) returns field errors and writes nothing.
16. **AC-16** While a save is pending the submit button is disabled and shows a pending state; the page does not show the new values before the server confirms.
17. **AC-17** A failed create/update shows "Could not create/edit <Resource>: <message>".
18. **AC-18** Delete opens a confirmation dialog; cancelling deletes nothing; deleting a client that has orders shows "Could not delete Client: cannot delete clients that still have orders".
19. **AC-19** `lib/db/errors.ts` unit tests: each SQLSTATE in the table maps to its message; any other error maps to "Something went wrong", the original is logged, and the raw text never reaches the client.
20. **AC-20** Scrolling the mouse wheel over a focused number input does not change its value.
21. **AC-21** Every Server Action rejects a request without a valid session.
22. **AC-22** Users: creating a user stores a bcrypt hash; the new user can log in; editing with a blank password keeps the old one; editing with a new password changes it; no page or response contains a password or hash; a duplicate email shows "email already in use".
23. **AC-23** The product form requires category, type, size and media; choosing a type in the product list's type filter returns exactly the products with that `type_id`.
24. **AC-24** The product category form shows every `show_*` flag as a switch under "Columns to show on Order Items page (for this category)", in the groups from legacy `productCategories.jsx`.
25. **AC-25** The client form has every client field listed, with "label use part number" as a switch.
26. **AC-26** The order form requires client, order number, due date and status (default New); status choices are exactly New, Complete, Archived; a new order's created date equals the database `current_date`; the delivery docket combobox and list column show numbers zero-padded to 6 digits.
27. **AC-27** The order-item form requires order, product, part number, qty, H, W, D and offers every category attribute with the types and choices in the table; the detail page shows every field listed.
28. **AC-28** Creating a delivery docket requires to-client, defaults status to Current, sets `from_client_id` to `FROM_CLIENT_ID` (no from-client field on the form), and redirects to the new docket's detail page; editing offers only to-client and status.
29. **AC-29** In print media the sidebar, top bar, toolbars and screen-only elements are hidden, print-only elements are shown, text is black, and `@page` is A4.
30. **AC-30** An axe scan of each list, detail and form page reports no critical violations, and every form control has an accessible label.

## Out of scope

- Order items panel on orders, category filter and category-driven columns, inline stage toggles, New-first order combobox, derived columns, docket print layout and adding/removing orders on a docket, the notcher feed (all `03-custom-behaviour`).
- Importing legacy data and seed scripts (`04-data-scripts`). Tests create their own fixtures.
- Setting the order id sequences above the legacy maximum (`04-data-scripts`).
- Bulk actions; roles or permissions; Dashboard content.

## Open questions

1. ~~**OQ-1 Delete toast wording**~~ — resolved 2026-10-31: "<Resource> successfully deleted" / "Could not delete <Resource>: <message>", matching the create/update pattern.
2. ~~**OQ-2 Product sizes columns**~~ — resolved 2026-10-31: name only, like web3. Extra columns are kept in the schema (the notcher feed emits them) but not shown in the UI.
