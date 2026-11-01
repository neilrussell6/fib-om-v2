# Tasks — 02-basic-crud

- Date: 20261031-205737
- Feature: 02-basic-crud
- Phase: 2 (Tasks)

Built from `artifacts/specs/02-basic-crud/spec.md` and the overview `artifacts/docs/nextjs-vercel-neon-migration.md` (O5, O6). References in brackets point at the spec's acceptance criteria (AC n) or Design bullets. Builds on `01-users-auth` (session helper, app shell, `lib/db`, test setup with the docker-compose database and the saved Playwright session).

## Tasks

### Dependencies and UI primitives

- [ ] Add `nuqs`, `@tanstack/react-table`, `react-hook-form` and `@hookform/resolvers`; wire the `nuqs` Next.js adapter into the root layout (Design: Shared building blocks)
- [ ] Add the shadcn components needed by lists and forms: table, dialog (alert dialog), popover, command, select, switch, checkbox, textarea, calendar/date picker, dropdown menu, badge (Design: Shared building blocks)

### Schema (Atlas migrations)

- [ ] Write the reference-data migration from v1's schema in `../fib-om-v2-reference/migrations/` (`data.sql` plus `data-ddl-updates.sql`): `clients`, `product_categories` (name plus every `show_*` boolean, one per order-item column in spec 04's fixed column list), `product_types`, `product_sizes` (name, plus any other v1 columns), `product_media`, `products`; snake_case columns; identity primary keys; only the required fields `NOT NULL`, every other text column nullable; `products.category_id/type_id/size_id/media_id` `NOT NULL` with FK `ON DELETE RESTRICT` (Design: Schema; Reference data and users; AC 2)
- [ ] Write the orders migration: enums `order_status` (`new | complete | archived`) and `docket_status` (`current | archived`); `delivery_dockets` (`from_client_id`, `to_client_id` FKs to clients `ON DELETE RESTRICT`, `date DEFAULT current_date`, `status DEFAULT 'current'`, generated `docket_number = lpad(id::text, 6, '0')`); `orders` (`client_id NOT NULL`, nullable `delivery_docket_id`, `order_number`, `date DEFAULT current_date`, `due_date`, `status DEFAULT 'new'`, FKs `ON DELETE RESTRICT`); no unique constraint on order number (Design: Schema; AC 2, AC 3)
- [ ] Write the order-items migration: `order_id`, `product_id` `NOT NULL` with FK `ON DELETE RESTRICT`; part number, quantity, height, width, depth `NOT NULL`; comment; the category attributes with the enums `clip_type`, `clip_position`, `wire_mesh`, `wire_sides`, `media_mats`, `gasket` from the spec's attribute table; the 7 `<stage>_status` booleans `NOT NULL DEFAULT false`; no `CHECK` constraints on quantities or dimensions (Design: Schema; AC 2, AC 3)
- [ ] Write the search migration: `CREATE EXTENSION pg_trgm` and a GIN trigram index on every text column used by a list filter or combobox search (AC 4)
- [ ] Write the display-views migration: `products_v`, `orders_v`, `order_items_v`, `delivery_dockets_v` with the joined names each list, detail page and combobox shows (no derived formula columns; those are spec 04) (Design: Schema)
- [ ] Run `db:hash`, apply locally, and confirm `db:validate` and `atlas migrate lint --latest 1` pass (AC 1)
- [ ] Add hand-written row types for every table and view in `lib/db/types.ts` (overview O5)

### Shared server building blocks

- [ ] Add a shared list-query builder in `lib/db/list-query.ts`: takes a resource's allowlist of filter keys (each mapped to a fixed SQL fragment and parameter, including contains-case-insensitive text matching and date/number ranges) and sort keys (each mapped to a fixed column), rejects unknown keys, and returns rows plus `count(*) OVER ()` with `LIMIT`/`OFFSET`; page size limited to 10/25/50/100, default 25 (Design: Query modules; AC 7, AC 8, AC 11, AC 13)
- [ ] Add `lib/db/errors.ts`: map SQLSTATE `23503` (on delete), `23502`, `23514`, `22P02`, `22007`/`22008` and `23505` (users email) to the spec's messages, using the table-to-display-name map; anything else becomes "Something went wrong", with the original error logged server-side and never returned (Design: Error display names; AC 19)
- [ ] Add a Server Action helper that checks the session first (spec 01's `requireSession`), validates input with the resource's zod schema, maps database errors through `lib/db/errors.ts`, and revalidates the affected list and detail paths (Design: Server Actions; AC 15, AC 21)
- [ ] Set up the Server Action test pattern: each Server Action is a thin wrapper (session check, zod parse, call into the query module, revalidate); integration tests import the action module directly in Vitest with `@/lib/auth` and `next/cache` mocked, against the docker-compose database (AC 15, AC 21)
- [ ] Add a reference-search endpoint (Route Handler or Server Action) that returns at most 25 `{id, label}` options per request for a given resource and search text, using the same contains-case-insensitive matching and session check (Design: Shared building blocks; AC 12, AC 21)

### Shared UI building blocks

- [ ] Build `components/data-table/`: a server-rendered table (TanStack Table) with sortable column headers (toggle direction on a second click), row click to the detail page, an Edit action per row, no bulk selection, and a Create button (Lists; AC 6, AC 7)
- [ ] Build the filter bar: always-shown filters, an "Add filter" menu for the rest, per-filter clear and "Clear all", all state in the URL through `nuqs` (Lists; AC 9, AC 10)
- [ ] Build pagination with page sizes 10/25/50/100 (default 25) and the total row count (Lists; AC 8)
- [ ] Build `ReferenceCombobox`: shadcn `Command` in a `Popover`, debounced server search against the reference-search endpoint, 25 options per request, fully keyboard operable (open, type, arrows, Enter, Escape) (Lists; AC 12)
- [ ] Build the form helper: react-hook-form with the shared zod schema, validation on blur with errors next to each field, a submit button with a pending state that is disabled while saving, no optimistic display, success toast "<Resource> successfully created/updated" and redirect, failure toast "Could not create/edit <Resource>: <message>" (Create and edit; AC 15, AC 16, AC 17)
- [ ] Build a number input that doesn't change value on mouse-wheel scroll, used by every numeric field (Create and edit; AC 20)
- [ ] Build `ConfirmDialog` and the edit-page Delete flow: confirm before deleting; success toast "<Resource> successfully deleted" and redirect to the list; failure toast "Could not delete <Resource>: <message>" (Create and edit; AC 18)
- [ ] Build the detail-page layout: labelled read-only fields, actions Back, Print (`window.print()`) and Edit; and the edit-page actions Back, Show and Delete (Detail pages; AC 14)
- [ ] Add the generic print styles: hide the sidebar, top bar, toolbars and anything marked screen-only; show anything marked print-only; black text; space above section headings; A4 `@page` with margins (Printing; AC 29)
- [ ] Add a test-data helper for integration and end-to-end tests that inserts minimal clients, product lookups, products, orders, order items and dockets directly into the test database and cleans them up (AC 5, AC 13)
- [ ] Extend the Playwright setup project to create the sender client with the fixed id from `FROM_CLIENT_ID` (inserted with `OVERRIDING SYSTEM VALUE`, then the identity sequence moved past it), so docket creation works in browser tests (AC 5, AC 28)

### Resources

Each resource is two tasks: (a) zod schema, query module (allowlisted filters and sorts) and Server Actions; (b) list, detail, create and edit pages, plus its sidebar entry enabled in `nav-items.ts`.

- [ ] Users (a): email (required) and password schema (required on create, blank on edit keeps the current one, 12+ characters via spec 01's shared `passwordSchema`); bcrypt hashing; no response ever contains a password or hash; duplicate email maps to "email already in use"; delete logic refuses your own account ("You can't delete your own account") and the last user ("Can't delete the last user") (Reference data and users; AC 22, AC 34)
- [ ] Users (b): list (email, default sort email ascending, email filter), detail, create, edit pages; no page renders a password or hash (Reference data and users; AC 22)
- [ ] Clients (a): schema with only name required and every empty optional field saved as NULL; query module (name filter, default sort name ascending); actions (Reference data and users; AC 31)
- [ ] Clients (b): list columns name, full name, phone, shipping address; form with every client field and "label use part number" as a switch; detail page (AC 25)
- [ ] Product categories (a): schema (name required, every `show_*` flag boolean); query module (name filter, default sort name); actions (Reference data and users)
- [ ] Product categories (b): list (name), detail, and a form with name plus every `show_*` flag as a switch under the heading "Columns to show on Order Items page (for this category)", grouped as in legacy `packages/web3/src/domain/react-admin/resources/productCategories.jsx` (AC 24)
- [ ] Product types (a): schema (name and code required, mm per pleat number); query module (name and code filters, default sort code); actions (Reference data and users; AC 31)
- [ ] Product types (b): list columns name, code, mm per pleat; detail; form (Reference data and users)
- [ ] Product sizes (a): schema (name required); query module (name filter, default sort name); actions (any other v1 columns kept in the schema, untouched) (Reference data and users)
- [ ] Product sizes (b): list (name), detail, form with name only (Reference data and users)
- [ ] Product media (a): schema (name and code required, pleat spacing number); query module (name and code filters, default sort code); actions (Reference data and users; AC 31)
- [ ] Product media (b): list columns name, code, pleat spacing; detail; form with pleat spacing as a number input (Reference data and users)
- [ ] Products (a): schema (name, category, type, size, media required; notcher boolean; efficiency optional); query module on `products_v` (filters name, type on `type_id`, size and media as text on the joined names, category, efficiency; default sort category name); actions (Reference data and users; AC 23)
- [ ] Products (b): list columns category, type name, type code, name, size, media; type and category filters as comboboxes; detail; form with category/type/size/media comboboxes and a notcher switch (AC 23)
- [ ] Delivery dockets (a): schema (to-client required, status default Current); query module on `delivery_dockets_v` (filters to-client name, docket number, created date range, status; default sort date descending); create logic reads `FROM_CLIENT_ID` when called (not at module load), sets `from_client_id` from it, and fails with "Could not create Delivery Docket: sender client is not configured" (and logs it) when it is unset or matches no client; edit accepts to-client and status only (Delivery dockets; AC 28, AC 33)
- [ ] Delivery dockets (b): list columns to-client, docket number, date, status (status filter always shown); create form with to-client and status, no from-client field, redirect to the new docket's detail page; edit form with to-client and status; basic detail page (date, docket number, from-client, to-client, status) (Delivery dockets; AC 28)
- [ ] Orders (a): schema (client, order number, due date, status required; status New/Complete/Archived, default New; optional delivery docket); query module on `orders_v` (filters client, order number, due and created date ranges, status, delivery docket; default sort created date descending); actions that refuse a docket whose to-client isn't the order's client with "delivery docket belongs to another client"; created date left to the database (Orders; AC 26, AC 32)
- [ ] Orders (b): list columns client (links to the client), order number, delivery docket (6-digit zero-padded), created, due, status; form with client combobox, order number, due date, status, and a docket combobox showing zero-padded numbers and offering only the selected client's dockets; basic detail page (Orders; AC 26, AC 32)
- [ ] Order items (a): schema (order, product, part number, qty, H, W, D required; comment; every category attribute with the spec's types and choices; 7 stage-status booleans); query module on `order_items_v` (filters client, order, order status, due/created date ranges, type code, part number, H/W/D ranges; default sort order due date descending); actions (Order items; AC 27)
- [ ] Order items (b): list columns client, order number, created, due, status; form with order and product comboboxes, the fields above, every category attribute and the 7 stage-status switches; detail page with every listed field (Order items; AC 27)
- [ ] Check the sidebar shows every entry in the final order (Dashboard, Orders, Order Items, Delivery Dockets, Clients, Product Categories, Product Media, Products, Product Sizes, Product Types, Users) and every page has its heading (`<Resource plural>`, `<Resource>`, `Edit <Resource>`, `Create a <Resource>`) (Navigation)

### Tests

- [ ] Integration: migrations apply to an empty database; schema has the tables, enums, `NOT NULL` columns, `ON DELETE RESTRICT` foreign keys; a docket with id 42 reads back `docket_number = '000042'` (AC 1, AC 2)
- [ ] Integration: two orders with the same order number (same and different clients) both save; an order item with quantity `-1` or height `0` saves (AC 3)
- [ ] Integration: every filtered or searched text column has a `pg_trgm` GIN index, checked against `pg_indexes` (AC 4)
- [ ] Integration: query modules reject unknown filter and sort keys; an injection string in a filter value is treated as data (no SQL error, no rows changed); text matching is contains-case-insensitive (`cme` finds "ACME") (AC 11, AC 13)
- [ ] Unit: `lib/db/errors.ts` maps each SQLSTATE in the table to its message with display names; any other error becomes "Something went wrong", is logged, and its raw text never reaches the client (AC 19)
- [ ] Integration: every Server Action rejects a request without a valid session (AC 21)
- [ ] Playwright, one per resource (10): create a record, see it in the list, open its detail page, edit it, delete it, with the success toasts (AC 5)
- [ ] Playwright: each list's default sort, filters and columns match the spec with no URL params; header click sorts and toggles direction; page size defaults to 25 and accepts 10/25/50/100, an invalid `pageSize` falls back to 25; total count shown (AC 6, AC 7, AC 8)
- [ ] Playwright: filters, sort and page appear in the URL and reloading the URL shows the same rows; per-filter clear and "Clear all"; "Add filter" menu adds hidden filters (AC 9, AC 10)
- [ ] Playwright: reference comboboxes debounce (at most one search per debounce window), return at most 25 options, and work with the keyboard only (AC 12)
- [ ] Playwright: detail pages show labelled fields and Back, Print, Edit, and Print calls `window.print()` (AC 14)
- [ ] Playwright + integration: invalid input shows an inline error on blur; posting the same data straight to the Server Action returns field errors and writes nothing; the submit button is disabled and pending while saving and the page doesn't show new values before the server confirms; a failed save shows "Could not create/edit <Resource>: <message>" (AC 15, AC 16, AC 17)
- [ ] Playwright: Delete asks for confirmation; cancel deletes nothing; deleting a client with orders shows "Could not delete Client: cannot delete clients that still have orders" (AC 18)
- [ ] Playwright: mouse-wheel over a focused number input doesn't change its value (AC 20)
- [ ] Playwright: users screen behaviour (bcrypt hash stored; new user can log in, signing in once with a cleared sign-in limit; blank password on edit keeps it; new password changes it; no password or hash in any page or response; duplicate email message; can't delete your own account) (AC 22, AC 34)
- [ ] Integration: the user delete logic refuses to delete the last remaining user, against a database containing exactly one user, with "Can't delete the last user" (AC 34)
- [ ] Playwright: product form requires category, type, size and media; the type filter returns exactly the products with that `type_id` (AC 23)
- [ ] Playwright: product category form shows every `show_*` flag under the heading, in the legacy groups (AC 24)
- [ ] Playwright: client form has every field with "label use part number" as a switch; a client with only a name saves with NULLs; client, product type and product media without required fields show inline errors and write nothing (AC 25, AC 31)
- [ ] Playwright: order form rules (required fields, status choices exactly New/Complete/Archived, default New, created date equals the database `current_date`, zero-padded docket numbers); the docket combobox lists only the selected client's dockets and the Server Action refuses another client's docket (AC 26, AC 32)
- [ ] Playwright: order-item form requires order, product, part number, qty, H, W, D and offers every category attribute with the spec's types and choices; the detail page shows every listed field (AC 27)
- [ ] Playwright: docket create requires to-client, defaults to Current, has no from-client field, stores `from_client_id` equal to `FROM_CLIENT_ID` (the seeded sender client), and redirects to the detail page; edit offers only to-client and status (AC 28)
- [ ] Integration: the docket-create logic with `FROM_CLIENT_ID` unset, and set to an id with no client (set per test, in-process), returns "Could not create Delivery Docket: sender client is not configured" and writes nothing (AC 33)
- [ ] Playwright: in print media the sidebar, top bar, toolbars and screen-only elements are hidden, print-only elements shown, text black, `@page` A4 (AC 29)
- [ ] Playwright: axe scan of every list, detail and form page has no critical violations, and every form control has an accessible label (AC 30)

## Not in this feature

- Order items panel on orders, category filter and category-driven columns, inline stage toggles, New-first order combobox, derived columns, docket print layout and adding/removing orders on a docket, the notcher feed (all `04-custom-behaviour`).
- Importing legacy data and seed scripts (`05-data-scripts`). Tests create their own fixtures.
- Setting the order id sequences above the legacy maximum (`05-data-scripts`).
- Bulk actions; roles or permissions; Dashboard content.
- Checking the schema against the production MySQL dump (moved to `05-data-scripts`, where the import mapping is built; any missing columns are added there with a new migration).
