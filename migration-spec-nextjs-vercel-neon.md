# Spec: Migrate FIB OM to Next.js + shadcn/ui + Postgres (Vercel + Neon)

| | |
|---|---|
| Status | Draft |
| Author | Neil Russell |
| Date | 2026-10-31 |
| Scope | Rebuild the app. Migrate **clients and product data only**. **No order data** is migrated. |
| Repos | New app: `fib-om-v2` (this repo). Legacy app: `../fib-om`. Every `packages/…`, `bin/…` or `sql/…` path in this spec refers to the legacy repo. |

---

## 1. Summary

FIB OM is an internal order-management tool for Fibatron, a filter manufacturer. Staff use it to manage clients and the product catalogue, take orders, track production of each order item through its stages (cut, sow, frame, media, wire, assemble, package), and print delivery dockets.

Today it runs as five separate pieces on DigitalOcean. This spec replaces all of them with one Next.js App Router app on Vercel, backed by Neon Postgres, with shadcn/ui for the interface. The reference data (clients and the product catalogue) is copied over once. Orders, order items, delivery dockets and invoices start empty in the new system.

## 2. Current state

| Component | Location | Role |
|---|---|---|
| Web UI | `packages/web3` (CRA, react-admin 4, MUI 5) | Admin UI. This is the live UI (`web:start` points at it). `web` and `web2` are older versions, ignored here. Every screen is built by the generic builder `src/generic/react-admin/utils.jsx` from the configs in `src/domain/react-admin/resources/*`, using the components in `src/generic/react-admin/components/*`. **`src/pages/App/Order*.jsx`, `OrderItem*.jsx` and `User*.jsx` are dead code**: imported but never rendered, so they are not a reference. |
| API | `packages/delivery` → PostgREST container | Auto-generated REST API over the `api` schema. Logs in through `rpc/login`, which returns a JWT made by `pgjwt`. |
| DB | DigitalOcean managed Postgres (`fibom` db, `api` schema) | Tables, plus `*_rel` views that denormalise joins for the UI |
| Notcher API | `packages/notcher-api` (Express + pg) | Serves `GET /` (exposed to the external software as `/vw-notcher-api?key=…`, §5.6): one nested JSON payload of every order item, for the VW notcher machine |
| Web server | `packages/nginx` | Serves the CRA build and proxies `/api/` → PostgREST and `/vw-notcher-api` → notcher API |
| Legacy import | `packages/migrate-old-data` | One-off MySQL → Postgres import (pgloader). Not needed again. |

### 2.1 Data model (inferred from UI resources and notcher query)

The DDL (`sql/migrations/schema.sql`, `views.sql`, `data-ddl-updates.sql`) is **not in the repo**. Get it from the production DB with `pg_dump -s` before you start. The tables below were reconstructed from the code.

**In scope for data migration**

| Table | Columns used by the app |
|---|---|
| `api.clients` | `id`, `name`, `fullname`, `phone`, `addressshipping`, `addressbilling`, `abn`, `acn`, `fax`, `landline`, `labelreordertext`, `labelname`, `labelsubname`, `labeladdressline1`, `labeladdressline2`, `labelusepartnumber` (bool) |
| `api.products` | `id`, `name`, `category_id`, `type_id`, `size_id`, `media_id`, `notcher` (bool), `efficiency` (text; `'xxxxxx'` was written into it as a placeholder during the old pgloader import, see §6.3) |
| `api.product_categories` | `id`, `name`, ~40 `show_*` booleans that decide which order-item columns appear when the list is filtered to that category |
| `api.product_types` | `id`, `name`, `code`, `millimetres_per_pleat` |
| `api.product_sizes` | `id`, `name` (+ other columns returned by `to_json(ps.*)` in the notcher query; confirm from the DDL) |
| `api.product_media` | `id`, `name`, `code`, `pleat_spacing` (numeric) |

**Out of scope for data migration (new schema, starts empty)**

| Table | Notes |
|---|---|
| `api.orders` | `client_id`, `order_number`, `date`, `due_date`, `status` (int), `deliverydocket_id`, `invoice_id` |
| `api.orders_products` (order items) | `order_id`, `product_id`, `part_number`, `quantity`, `height`, `width`, `depth`, `comment`, category-specific attributes (see §5.3), 7 stage-status booleans, `cut_count`, `sow_count` |
| `api.delivery_dockets` | `fromclient_id`, `toclient_id`, `docket_number`, `date`, `status` |
| `api.delivery_dockets_orders` | join table from the legacy import. web3 links orders through `orders.deliverydocket_id`, so this table is dropped. |
| `api.invoices` | Not used by web3. Dropped. |
| `api.roles`, `api.old_users`, `api.old_users_roles` | Legacy MySQL users. Dropped. |
| `api.users` | The live app logins: `rpc/login` resolves to `api.login`, which checks `api.users`. Not migrated as data; handled in §7. |
| `basic_auth.users` | Loaded by the init scripts, but not used by the login. Dropped. |

**Derived values.** Four legacy read views feed the UI (writes go to the base tables):

| View | Used for | Derived / joined columns |
|---|---|---|
| `orders_rel` | orders list and detail, orders on a docket | `client_name`, `order_items_packed` |
| `orders_products_rel` | order-items list, detail, and the panel on an order | `client_id`, `client_name`, `order_number`, `order_date`, `order_due_date`, `order_status`, `product_category_id/name`, `product_name`, `product_type_code/name`, `product_size_name`, `product_media_code`, `calculated_id`, `pleats`, `wire_metres`, `wire_height` |
| `products_rel` | products list and detail | `category_name`, `type_name`, `type_code`, `size_name`, `media_name` |
| `delivery_dockets_rel` | dockets list and detail | `fromclient_name`, `toclient_name`, and probably `docket_number` (see §5.5) |

The formulas are only in `views.sql` in the DB. **Get them from production and port them** (§5.4).

## 3. Goals and non-goals

**Goals**
- Keep every feature web3 has today (§5). This is a like-for-like rebuild **of behaviour**, not of implementation. The new build uses current conventions: Server Components, Server Actions, typed SQL, accessible shadcn components, and real database constraints. Where web3's behaviour is a workaround or a bug, the spec says what changes, and each change is marked **(improvement)**.
- One deployable: Next.js on Vercel. No Docker, droplets, nginx or PostgREST.
- Neon Postgres, with typed schema and migrations kept in the repo.
- Clients and product reference data copied over with the same IDs.
- Remove the secrets hardcoded in the codebase (§9).
- **Notcher feed unchanged:** same URL (scheme, host, port, path), same headers, same body, byte for byte. The external software that reads it cannot be updated (§5.6).

**Non-goals**
- Migrating orders, order items, delivery dockets or invoices.
- New business features, roles or permissions beyond "logged-in staff can do everything" (today's model).
- Keeping the PostgREST URL shape. (The notcher feed is the exception and must stay **exactly** as it is, see §5.6.)

**Decisions on improvements (2026-10-31).** The product owner approved every change marked **(improvement)** in §5, except the **new data rules**, which the client did not approve:
- no unique order number (per client or otherwise)
- no new `CHECK` constraints on quantities or dimensions

Constraints that already exist in web3's database stay: foreign keys that block deletes, and `NOT NULL` on required columns. That keeps today's behaviour, including the friendly error messages in §5.9.

Every order has a client. That's a fact about the business, not a new rule, so the client is required on the order form and `orders.client_id` is `NOT NULL`.

## 4. Target architecture

```
Browser ──► Vercel (Next.js App Router)
              ├─ Server Components: read pages (lists, detail, print)
              ├─ Server Actions: create / update / delete, stage toggles
              ├─ Route Handler: GET /vw-notcher-api?key=… (machine feed, §5.6)
              └─ proxy.ts: auth gate on every route except /login and assets
                     │
                     ▼
              Neon Postgres (pooled connection, @neondatabase/serverless driver)
```

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript, Turbopack | Current Vercel default |
| UI | shadcn/ui (Tailwind v4) + TanStack Table for data tables | Replaces react-admin/MUI. shadcn has table, form, combobox, date-picker and dialog components. |
| Forms | react-hook-form + zod (shared schema for client and server validation) | Replaces react-admin `required()` validators |
| DB | Neon Postgres: branches `production` and `staging` | Managed and serverless; branching gives a staging copy (§8) |
| Data access | **Plain SQL, no ORM.** `@neondatabase/serverless`: the `neon()` tagged-template client for one-off queries, and `Pool` for transactions | Queries stay readable and portable, `json_build_object`/views are used directly, and the notcher SQL ports verbatim |
| Migrations | [Atlas](https://atlasgo.io) versioned migrations: SQL files written by hand plus `atlas.sum`, applied **only by CI** (§8.2) | Plain SQL, integrity-checked, with linting for destructive changes. Same setup as `sa-political-compass` |
| Row types | TypeScript types written by hand in `lib/db/types.ts`, plus zod schemas for anything entering the system (forms, query params) | Types stay in step with the SQL; no codegen step needed |
| Auth | Auth.js (NextAuth v5) Credentials provider with bcrypt, DB session or JWT cookie | Matches today's email/password model. No third-party sign-up needed. |
| URL state | `nuqs` for list filters, sort and pagination in the query string | Filters can be bookmarked or shared, as react-admin allows today |
| Hosting / CI | Vercel, deployed **only by GitHub Actions** (`vercel build` + `vercel deploy --prebuilt`): staging on every push to `master`, production on manual dispatch (§8.3) | Migrations and deploys run in one controlled pipeline, in order |

### 4.1 Repo layout

The new app is a single Next.js project at the root of the `fib-om-v2` repo. There's no monorepo. Once production cuts over, archive the legacy `fib-om` repo (read-only).

```
fib-om-v2/
  app/
    (auth)/login/page.tsx
    (app)/layout.tsx                 # sidebar + top bar, auth required
    (app)/orders/…                   # list, [id], [id]/edit, new
    (app)/order-items/…              # list (category column filter), [id], [id]/edit, new
    (app)/delivery-dockets/…         # list, [id] (print view), [id]/edit
    (app)/clients/…
    (app)/products/…
    (app)/product-categories/…
    (app)/product-types/…
    (app)/product-sizes/…
    (app)/product-media/…
    vw-notcher-api/route.ts
  components/ui/                     # shadcn generated
  components/data-table/             # generic table, filter bar, pagination
  lib/db/index.ts                    # sql (neon tagged template) + pool + tx() helper
  lib/db/types.ts                    # row types written by hand
  lib/db/queries/*.ts                # one file per resource: list/get/create/update/delete as SQL
  lib/db/sql/notcher-feed.sql        # legacy notcher query, verbatim (§5.6.3)
  lib/auth.ts
  db/migrations/*.sql                # Atlas versioned migrations, written by hand
  db/migrations/atlas.sum            # Atlas integrity file (db:hash)
  scripts/migrate-reference-data.ts  # §6
  scripts/db.sh                      # Atlas wrapper (migrate/status/validate/new/hash)
  proxy.ts
  atlas.hcl
  .vercelignore
  .github/workflows/ci.yml           # tests + atlas validate/lint
  .github/workflows/deploy.yml       # migrate → build → deploy (staging/prod)
  .github/workflows/migrate-reference-data.yml  # one-off, manual (§8.3)
```

### 4.2 SQL conventions
- **Always parameterise.** Use the ``sql`… ${value} …` `` tagged template; values become `$n` parameters. Never build SQL by string concatenation.
- **Dynamic SQL from an allowlist only.** List filters and sorting need dynamic `WHERE`/`ORDER BY`. Map each allowed filter key to a fixed SQL fragment and parameter, and each sort key to a fixed column, in `lib/db/queries/<resource>.ts`. Reject unknown keys. Never put user input in identifiers.
- **Pagination:** `LIMIT $n OFFSET $m`, plus `count(*) OVER ()` for the total in the same query.
- **Joins for display** (e.g. product → category/type/size/media names) go in SQL views (`products_v`, `order_items_v`), which replace the legacy `*_rel` views. Writes go to the base tables.
- **Transactions:** use a `tx(async (client) => …)` helper on `Pool`, e.g. for creating an order together with its items, or the data migration script.
- **Results:** queries return typed rows (`sql<Client[]>`); validate input with zod before it reaches SQL.
- **Tests:** query modules are tested against a real Postgres (a Neon branch, or a local `postgres` container with migrations applied), not mocks.

## 5. Functional requirements (parity with web3)

### 5.1 Common behaviour (all resources)

**Navigation**
- A sidebar in this order: Orders, Order Items, Delivery Dockets, Clients, Product Categories, Product Media, Products, Product Sizes, Product Types. Each has an icon (lucide equivalents of the current MUI icons), and the active item is highlighted.
- There's no dashboard. `/` redirects to `/orders`.
- On narrow screens the sidebar collapses into a sheet **(improvement)**.
- Page titles follow `<Resource plural>`, `<Resource>`, `Edit <Resource>`, `Create a <Resource>`. The browser title is "Fibatron".

**Lists**
- A server-rendered table. Clicking a row opens the detail page, and each row has an Edit action. There are no bulk actions.
- Columns can be sorted by clicking the header. Each resource has a default sort (§5.2–§5.5).
- Pagination with page sizes 10/25/50/100, default **25** **(improvement: web3 uses react-admin's default of 10)**. A total count is shown.
- **Filters:**
  - some filters are always shown; the rest are added from an "Add filter" menu, as in web3
  - every filter is kept in the URL (`nuqs`), so a filtered list can be bookmarked
  - a filter can be cleared on its own, or all at once
- **Text matching (improvement):** web3 is inconsistent. List text filters match anywhere in the text (`ilike '%x%'`), while combobox searches match from the start, thanks to a URL rewrite in the data provider. The new build uses **contains, case-insensitive, everywhere**, backed by `pg_trgm` GIN indexes on searched text columns.
- **Reference comboboxes** search the server as you type (debounced), load 25 at a time, and are keyboard accessible (shadcn `Command` in a `Popover`).

**Detail pages**
- A labelled read-only layout, with actions **Back**, **Print** and **Edit**.
- Every detail page can be printed (§5.10).

**Create and edit**
- A single form per resource, built with react-hook-form and zod. The zod schema is shared with the Server Action, which validates again on the server.
- Errors are shown inline next to the field, and checked on blur.
- The edit page has actions **Back** and **Show**, plus **Delete**, which opens a confirmation dialog.
- **Saves are confirmed by the server:** the button shows a pending state, and nothing is applied optimistically. Inline toggles are the one exception (§5.3).
- **On success:**
  - a toast "<Resource> successfully created/updated"
  - redirect to the list, unless the form was opened from a parent: an order item opened from an order goes back to that order (§5.3), and a new docket goes to its detail page (§5.5)
  - `revalidatePath` refreshes the affected pages
- **On failure:** a toast "Could not create/edit <Resource>: <message>", with the message from §5.9.
- Number inputs don't change value on mouse-wheel scroll. (web3 does this with `onWheel` blur.)

**Accessibility (improvement)**
- Every control has a label.
- Keyboard navigation works in tables, comboboxes and dialogs.
- Toggles have `aria-pressed` and a text label, not only an icon.

### 5.2 Reference data screens

| Screen | Default sort | Filters | List columns | Form fields |
|---|---|---|---|---|
| Clients | name ↑ | name | name, full name, phone, shipping address | all client columns from §2.1. `labelusepartnumber` is a switch. |
| Products | category name ↑ | name, type (combobox), size (text), media (text), category (combobox), efficiency (text) | category, type name, type code, name, size, media | name, category, type, size, media (comboboxes, required), notcher (switch), efficiency |
| Product categories | name ↑ | name | name | name, plus a grouped set of `show_*` switches headed "Columns to show on Order Items page (for this category)". Keep the groups from `productCategories.jsx`. |
| Product types | code ↑ | name, code | name, code, mm per pleat | same |
| Product sizes | name ↑ | name | name | name |
| Product media | code ↑ | name, code | name, code, pleat spacing | name, code, pleat spacing (number) |

**Product type filter (improvement).** In web3 this filter is broken: it puts an id picked from product types onto `type_name`. The new build filters on `type_id`. Size and media stay as text filters on the joined names, as today.

### 5.3 Orders and order items

**Order statuses** are stored as ints. Only these are selectable: `2 New` (default), `4 Complete`, `5 Archived`. Because no historical orders come across, the new enum is just `new | complete | archived`. The integer codes 1 and 3 are not carried over.

**Orders**
- List sorted by created date, newest first. Filters: client, order number, due date range, created date range, status, delivery docket. Columns: client (links to client), order number, delivery docket (shown zero-padded to 6 digits), created, due, status.
- Create/edit: client (combobox, required: every order has a client; `orders.client_id` is `NOT NULL`), order number (required), due date (required), status (required, default New), delivery docket (combobox, optional, shown zero-padded).
- `date` (created date) isn't on the form. It's set by the database: `DEFAULT current_date`.
- Detail shows client, order number, created date, due date, status, delivery docket and the items panel.
- **Order items panel.** It appears on both the order detail page and the order edit page, with the heading "Order Items":
  - **Columns:** item id, type name, part number, qty, H, W, D.
  - **Package-status toggle** (detail page): an inline toggle for `package_status` on each row, with the toast "Order package status updated". It works the same way as the list toggles below.
  - **Row actions:** Edit and Show on the detail page; Edit and **Remove** on the edit page.
  - **Remove** opens a confirmation dialog titled "Delete?" with the text "{qty} x {type name}". On success the toast is "Order Item Deleted". On failure: "Could not delete Order Item: <message>".
  - **Add** opens the item form with the order already filled in (`/order-items/new?orderId=…`).
  - **Return to the order:** after an item is created or edited from this panel, you go back to the order page you came from, detail or edit. Pass it as `?returnTo=` and allow only internal paths. When the form is opened from anywhere else, you go to the order-items list.
  - On print, the action buttons, toggles and Add button are hidden (§5.10).

**Order items**
- Default sort: order due date, newest first.
- **Category-driven columns (key feature).** The list always shows a Product Category filter (a select with an "All" option) and an Order Status filter.
  - **With a category picked:** the visible columns are the always-on set (`client`, `order`, `due date`, `status`, `type code`, `type name`, `comment`) plus every column whose `show_<col>` flag is true on that category.
  - **Column order is fixed.** It doesn't depend on which flags are on: Client, Order, Due Date, Code, Description, Size, Part Number, Quantity, Height, Width, Depth, Comment, Media Code, Has Wire Header?, Has Header Frame?, Type, Number, Clip Type, Clip Position, Has Gasket?, Pockets, Has Legs?, Wire Mesh, Has Gate?, Wire Sides, ID (`calculated_id`), Pleats, Wire Metres, Wire Height, Media Mats, Gasket, Drawing Number, Cut Count, Sow Count, Status, then the stage toggles Package, Assemble, Frame, Media, Wire, Cut, Sow.
  - **With no category picked:** the list shows client, order number, created, due and status.
  - **(improvement)** The server resolves the category's columns in the same request as the rows. web3 fetches the category separately on the client after the list loads, so the columns jump.
- Filters: category, client, order, order status, due/created date ranges, type code, part number, H/W/D ranges, and every category attribute.
- **Stage toggles inline.** The 7 stage statuses (`cut`, `sow`, `frame`, `media`, `wire`, `package`, `assemble`) appear as toggle buttons in the list when the category shows them.
  - Clicking one saves straight away, without opening the row, and shows the toast "<Stage> Status updated". If it fails, the toast is "Could not update <Stage> Status" and the toggle goes back to its previous state.
  - **(improvement)** The update is optimistic (`useOptimistic` + a Server Action) and changes only that row. web3 waits for the save, then reloads the whole list, and disables every toggle while it does.
  - The Server Action sets the column to an explicit value (`SET <stage>_status = $value`) rather than flipping whatever is stored, so a double click can't fall out of sync. The stage column comes from an allowlist.
- Detail page: every field of the item (order, product, type code/description, part number, dimensions, comment, every category attribute, order status and the 7 stage statuses).
- The **order combobox** on the item form lists orders with status New first, then the rest **(improvement: the most likely choice comes first)**.
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

  Store these enums as Postgres enums or `smallint` with a check constraint. The legacy schema used `1..n` ids where the label "0" maps to id 1. That mapping does not have to be kept, since no order data migrates.

### 5.4 Derived columns
Port `calculated_id`, `pleats`, `wire_metres` and `wire_height` (from `orders_products_rel`) and `order_items_packed` (from `orders_rel`; shown as "Items Packed" on dockets) from production `views.sql`. Implement them as either:
- Postgres views `order_items_v`, `orders_v`, `products_v`, `delivery_dockets_v`, defined in SQL migrations (preferred, because the notcher feed and lists share them), or
- a pure TS function in `lib/domain/order-item.ts` with unit tests.

They depend on `product_types.millimetres_per_pleat`, `product_media.pleat_spacing` and the item dimensions. Write tests against a handful of real rows from production before the old system is turned off.

### 5.5 Delivery dockets
- Statuses: `2 Current`, `1 Archived` → enum `current | archived`, default `current`.
- **List:** sorted by date, newest first.
  - Filters: to-client name, docket number, created date range, and status (always shown).
  - Columns: to-client, docket number, date, status.
- **Create:** fields to-client (combobox, required) and status. Web3 has this screen (the generic builder makes one for every resource). On success it goes to the **new docket's detail page**, so orders can be added straight away.
  - `date` comes from `DEFAULT current_date`.
  - `fromclient_id` comes from the setting `FROM_CLIENT_ID` (Fibatron's own client row), set on the server. It isn't on the form.
  - `docket_number` is the id zero-padded to 6 digits (`lpad(id::text, 6, '0')`), as a generated column or in the view. Orders already show docket ids this way. Confirm against the production DDL. If production stores a separate sequence, copy that instead.
- **Edit:** to-client (combobox) and status.
- **Detail page: a print layout.**
  - A "Delivery Docket" heading (print only), date, delivery number.
  - A From block and a To block, each with the client name and shipping address.
  - The heading "The following orders in good order and condition" (print only).
  - **Orders on this docket:** order number, then status, Items Packed (`order_items_packed`) and a Show link, which appear on screen only. On print the table's header row is hidden.
  - **Add order** (screen only): a combobox listing orders that belong to the docket's to-client and are not already on this docket, with an ADD button. ADD sets `orders.deliverydocket_id`, then refreshes the list.
  - **Remove order (improvement):** web3 has no way to take an order off a docket. Add a Remove action on each row (screen only) with a confirmation dialog; it sets `deliverydocket_id = NULL`.
  - **(improvement)** The order combobox shows only orders that aren't on *any* docket, plus a note that an order can only be on one docket. In web3, adding an order that's already on another docket silently moves it.

### 5.6 Notcher feed: a frozen external contract

> **Hard constraint.** External notcher software reads this endpoint, and that software **cannot be updated**. The new system must serve it at the **exact same URL** with the **exact same response**. Everything in this section is required, not optional. Nothing here may be "improved".

#### 5.6.1 Endpoint (fixed path, any host)

```
GET {origin}/vw-notcher-api?key=<api key>
```

- The **path** `/vw-notcher-api` (no trailing slash) and the **query parameter** `key` are fixed. The **origin** is whatever host the app is deployed on in that environment, e.g. `http://localhost:3000` locally, a Vercel preview URL, or the production domain.
- Implement it as `app/vw-notcher-api/route.ts`, a root-level route with no `basePath`. It must work the same on every origin, with no hardcoded hostnames.
- Turn off anything that would change the request:
  - no `trailingSlash: true` in `next.config`
  - no redirect from `proxy.ts`/auth on this path
  - in production, no domain-level redirect (e.g. apex→`www`) on whichever host the external software is configured to call
- No production server config is available. **`packages/notcher-api/src/index.js` is the reference implementation** for the response (§5.6.3). The repo's nginx routing is not authoritative and is not reproduced.

#### 5.6.2 Production cutover
- Find out which production host the external software is configured with. That host must point at Vercel at cutover, and the software's setting stays untouched.
- If that host also serves other things, e.g. a marketing site, list them. Each one must either move into the Next.js app or be routed by Vercel rewrites to where it now lives. Change only the A/ALIAS/CNAME records for that host; leave MX/TXT records (email, SPF/DKIM) alone.
- Lower the DNS TTL to 300s at least 48h before cutover. Add the domain in Vercel and wait for the certificate to be issued before switching DNS. That way the software never sees a TLS error.
- If the software calls over plain `http://`, check that it follows Vercel's 308 redirect to HTTPS before cutover.

#### 5.6.3 Response contract (must be identical)
Treat `packages/notcher-api/src/index.js` as the spec. Port its SQL **verbatim** into `lib/db/sql/notcher-feed.sql`, and run it as-is through the Neon `sql` client. Don't rebuild the object in TypeScript.

- **Status/headers:** `200`, with `Content-Type: text/html; charset=utf-8`, which is what Express `res.send(<string>)` sends (it is not `application/json`). Also set `Cache-Control: no-store`, and make the route dynamic (`export const dynamic = 'force-dynamic'`) so the CDN never caches it. Express extras such as `X-Powered-By` and `ETag` are not reproduced.
- **Body:** `JSON.stringify` of an array, with no whitespace. Each element has these keys **in this order**, because `json_build_object` keeps insertion order:
  `assemblestatus, comment, cutcount, cutstatus, framestatus, height, id, mediastatus, quantity, sowcount, sowstatus, width, wirestatus, packagestatus, partnumber, order{date, deliverydocket, duedate, id, invoice, ordernumber, status, client{…}}, product{category{id,name}, efficiency, id, media{id,name}, name, notcher, size{…}, type{code,id,name}}`.
- **Types:**
  - Status booleans are cast to `0/1` ints with `::int`.
  - `order.status` is an **int**. The new enum must map back to the legacy codes (`new→2`, `complete→4`, `archived→5`).
  - `order.date` and `order.duedate` use `TO_CHAR(…, 'DD Mon')`.
  - `deliverydocket` and `invoice` are always `null`.
  - `height`, `width`, `quantity`, `cut_count`, `sow_count` and `id` must keep the same Postgres types (int vs numeric), because `numeric` serialises differently, e.g. `500` vs `500.00`.
- **`client` is `to_json(c.*)` and `size` is `to_json(ps.*)`.** Every column of those tables is emitted, with its **legacy name, in legacy column order**. If the new schema renames, reorders, adds or drops columns on `clients`/`product_sizes`, the feed must not use `to_json(table.*)`. Replace it with an explicit `json_build_object` listing exactly the legacy columns in the legacy order. Get that list from the production DDL. If the DDL can't be obtained, use the current web3 field list (§2.1) as the column set, in that order, plus `id` first.
- **Error path:** today an exception returns `200` with body `error`. Keep that.
- **Row order:** the legacy query has no `ORDER BY`, so in practice rows come out roughly by insertion order. Add `ORDER BY op.id ASC`, which is deterministic and matches that order.
- **Filtering:** today it returns **every** order item (no filter). Keep that.
- **Auth: the `key` query parameter (enforced).**
  - The expected value comes from the env var `NOTCHER_API_KEY`: set it in Vercel for Production and Preview, and in `.env` locally. **Never commit it.** Its production value must equal the key the external software is configured to send.
  - Compare with `crypto.timingSafeEqual`, using equal-length buffers.
  - If `key` is missing or wrong, return `401`, `Content-Type: text/plain; charset=utf-8`, body `unauthorized`. The database is not queried.
  - Fail closed: if `NOTCHER_API_KEY` is unset, every request returns `401` and an error is logged.
  - Read the key only from the query string. Session auth from `proxy.ts` must not run on this path (exclude it in the `matcher`).
  - Keep the request URL, including `key`, out of logs and analytics; redact the query string.
- **ID continuity:** order data starts empty, so the feed returns `[]` at cutover. That's acceptable only if the software tolerates it (confirm). Start the `orders`/`orders_products` identity sequences **above the old max id**, so new items never reuse ids the software has already seen.

#### 5.6.4 Contract test (gate for cutover)
- Load a fixture dataset into a throwaway Neon branch or a local Postgres. Use production data if a dump is available; otherwise use a synthetic fixture covering every column, NULLs, true/false statuses and every order status.
- Run the legacy `packages/notcher-api` Express app against that same database. Its connection string is hardcoded, so change it to read `DATABASE_URL` for the test, and add the same `ORDER BY` there.
- Call both endpoints and diff the **raw body bytes** and `Content-Type`. They must match exactly.
- Keep a golden-file test in CI (`tests/notcher-contract.test.ts`), so that later schema changes to `clients`/`product_sizes`/`products` can't silently change the feed.
- On cutover day, run one real request from the external software against the new URL path before decommissioning anything.

### 5.7 Auth
- An email/password login page on the background image `web3/src/assets/bg.jpg`, titled "Fibatron". (web3 doesn't use the logo file `fibatron_logo128x128.png`; using it on the login card is optional.)
- A failed login shows one generic message, "Email or password is incorrect" **(improvement: no account enumeration)**. Rate-limit login attempts with a Vercel Firewall rule on `POST /login` and `/api/auth/*`.
- An expired session sends the user to `/login?callbackUrl=<current path>`, and after signing in they go back there **(improvement: web3 always drops you at the default page)**.
- A sign-out action sits in the top bar, showing the signed-in email **(improvement: web3 shows no identity)**.
- Every route needs a session except `/login`, static assets and the notcher feed. The feed is protected by its `key` parameter instead (§5.6.3).
- Sessions last 1 hour today (JWT `exp`). New default: an 8-hour rolling session.
- User management: web3 has the `users` resource switched off, so seed users with a script (`scripts/create-user.ts`). A Users admin screen is optional (Open Questions).

### 5.8 Theme
- Bring the web3 palette into shadcn CSS variables:
  - primary `#0780b0` (light `#11b0f1`, dark `#004f6e`)
  - secondary `#2c2c2c`
  - body text `#676767` (muted `#919191`)
  - app frame and sidebar `#8e989b`
  - active menu item `#284e5d` with white text and icon
  - content area white
- Use the system font stack.
- **(improvement)** Use a fixed rem type scale. web3 scales the base font with the viewport (`calc(10px + 1vmin)`), which makes the type size jump on large and small screens.
- **(improvement)** Check the text and button colours for WCAG AA contrast. `#676767` on white passes; `#919191` does not, so use it only for large or decorative text.
- Light mode is required; dark mode is optional.

### 5.9 Database constraints and error messages
- The database keeps the integrity rules web3's database already has, and adds no new ones (§4 decisions):
  - foreign keys with `ON DELETE RESTRICT` (client → orders, docket → orders, product and its references, order → items)
  - `NOT NULL` on required fields
  - no extra `CHECK` or unique constraints
- web3 turns database errors into friendly messages by matching regexes against PostgREST text. The new build maps on **Postgres SQLSTATE codes** in one helper, `lib/db/errors.ts`. Most cases are caught earlier by zod, so these are a backstop:

| SQLSTATE | Meaning | Message (same wording as web3) |
|---|---|---|
| `23503` on delete | FK violation | "cannot delete <table> that still have <referencing table>", e.g. "cannot delete clients that still have orders" |
| `23502` | not null | "please provide a <column without _id>" |
| `23514` | check | "please provide a valid <column>" |
| `22P02` | invalid integer | "please provide a valid integer" |
| `22007` / `22008` | invalid date | "please provide a valid date" |

- Any other error is logged on the server, and the user sees "Something went wrong". Raw database text is never shown.

### 5.10 Printing
- Every detail page has a Print button that calls `window.print()`, not only dockets.
- **Print styles** (Tailwind `print:` variants):
  - hide the sidebar, top bar, toolbars and anything marked screen-only (action buttons, the docket's add-order form, status columns)
  - show print-only elements (the docket headings)
  - force all text to black
  - hide the docket orders table's header row
  - add space above section headings
- Use an A4 `@page` size with sensible margins **(improvement)**.

## 6. Data migration (clients + product data)

### 6.1 Source
The production DigitalOcean Postgres `fibom` database, `api` schema. Before migrating, take a full `pg_dump` (schema and data) and keep it in cold storage as the archive of order history.

### 6.2 Approach
A one-off TypeScript script, `scripts/migrate-reference-data.ts`, connects to both the source DB (`SOURCE_DATABASE_URL`, read-only) and Neon (`DATABASE_URL_UNPOOLED`). For staging and production it is run only by the `migrate-reference-data.yml` workflow (§8.3); locally it can be run against a local database. It runs these steps inside one Neon transaction:

1. Truncate the target reference tables, in dependency order.
2. Copy in FK order: `product_categories` → `product_types` → `product_sizes` → `product_media` → `products` → `clients`.
3. **Keep primary keys.** Insert with `OVERRIDING SYSTEM VALUE`, or plain inserts into `serial` columns. Old IDs may be referenced on physical labels and by the notcher, and keeping them makes verification easy.
4. Reset each identity sequence to `max(id)+1` with `setval(pg_get_serial_sequence(...), max(id))`.
5. Clean the data as described in §6.3.
6. Run the checks in §6.4 and roll back if any fail.

The script is idempotent and safe to re-run up to cutover. Run it against a Neon dev branch first.

### 6.3 Transforms
| Field | Transform |
|---|---|
| `products.efficiency` | Change the `'xxxxxx'` placeholder back to `NULL` |
| `orders_products.part_number` placeholder | n/a, not migrated |
| Text columns | Trim. Change empty strings to `NULL` for optional fields. |
| `clients.labelusepartnumber`, `products.notcher`, `product_categories.show_*` | Make sure the type is boolean (pgloader may have produced `smallint`) |
| Column names | Optional rename to snake_case (`addressshipping` → `address_shipping`, `labelname` → `label_name`, …). If renamed, the notcher feed must emit the legacy names in legacy column order with an explicit `json_build_object`, not `to_json(c.*)` (§5.6.3). **Recommendation: rename in the new schema, and keep the feed's legacy column list fixed in one SQL file covered by the contract test.** |
| Orphaned products | Products whose `category_id/type_id/size_id/media_id` point to missing rows: set the FK to NULL and log them |
| `product_categories.show_*` | Copy all flags. Drop any flag for a column that no longer exists in the new order-items schema, and log it. |

### 6.4 Verification
- The row count of every migrated table matches the source.
- A checksum of `md5(string_agg(row::text ORDER BY id))` over the compared columns matches, after transforms are applied the same way to both sides.
- Every product FK resolves.
- A spot check in the new UI: 10 clients and 10 products, compared side by side with the old UI.

### 6.5 Explicitly not migrated
`orders`, `orders_products`, `delivery_dockets`, `delivery_dockets_orders`, `invoices`, `roles`, `old_users`, `old_users_roles`, `api.users`, `basic_auth.users`. The order history is kept only in the archived dump (§6.1).

## 7. Users
Users are not part of the data migration. There are two options:
- **A (default):** create staff accounts again with `scripts/create-user.ts`, and staff set new passwords.
- **B:** copy `email` and `password` from `api.users` (the table the live login checks). pgcrypto `crypt(..., gen_salt('bf'))` makes `$2a$` bcrypt hashes, which `bcryptjs.compare` can check, so existing passwords would keep working.

## 8. Environments, migrations and deployment (CI only)

Schema migrations and Vercel deployments **only ever run from GitHub Actions**. Nobody runs `vercel deploy` or migrates staging/production from a laptop, and Vercel's Git auto-deploys are **off**. The setup follows `../../conjure-dev-PRJ/sa-political-compass` (`/home/neil/conjure-dev-PRJ/sa-political-compass`) (`.github/workflows/deploy.yml`, `atlas.hcl`, `scripts/db.sh`).

### 8.1 Environments
| Env | Trigger | Vercel target | Neon branch | URL |
|---|---|---|---|---|
| Local | `npm run dev` | n/a | local Postgres container (or a personal Neon branch) | `http://localhost:3000` |
| Staging | every push to `master` | preview, aliased to a fixed staging domain | `staging` | e.g. `fib-om-staging.<domain>` |
| Production | manual **Actions → Deploy → Run workflow** (`workflow_dispatch`) | production (`--prod`) | `production` | the production host the notcher software calls (§5.6.2) |

There's a fixed `staging` Neon branch rather than one per preview, because CI applies migrations to a known database before each deploy.

### 8.2 Migrations: Atlas, versioned SQL
- Migrations are **Atlas versioned migrations**: plain SQL files written by hand in `db/migrations/` (`<timestamp>_<name>.sql`), plus `db/migrations/atlas.sum`. There's no ORM and no desired-state schema.
- `atlas.hcl`:
  ```hcl
  env "local" {
    url = getenv("DATABASE_URL")
    dev = "docker://postgres/17/dev"
    migration {
      dir = "file://db/migrations"
    }
  }
  ```
  Match the `dev` image's major version to the Neon project's Postgres version.
- `scripts/db.sh` wraps Atlas, and `package.json` scripts call it:
  - `db:migrate` → `atlas migrate apply`
  - `db:status`
  - `db:validate` → `atlas migrate validate`, which checks `atlas.sum` and needs no DB
  - `db:new <name>` → `atlas migrate new`
  - `db:hash` → `atlas migrate hash` after editing a file
- **Neon quirks** (taken from the example; both are needed):
  - Always pass `--revisions-schema public`. Neon ignores `search_path`, so Atlas can't keep its revisions table in its own schema (ariga/atlas#2509).
  - Migrate over the **unpooled** connection string. SCRAM auth through Neon's PgBouncer pooler fails intermittently (`server sent an invalid SCRAM-SHA-256 iteration count`). The app's runtime keeps using the pooled `DATABASE_URL`.
- Locally, `db:migrate` runs against `DATABASE_URL` from `.env`. Nobody applies migrations to staging or production by hand.
- Editing a migration once it has been applied to staging is not allowed; add a new one instead.

### 8.3 CI workflows
**`.github/workflows/ci.yml`** runs on pull requests and on pushes to `master`:
1. `npm ci`, typecheck, lint, unit tests.
2. Run `ariga/setup-atlas@v0`, then `atlas migrate validate` (integrity of `atlas.sum`) and `atlas migrate lint --latest 1` (catches destructive changes).
3. Integration tests against a `postgres` service container, after `atlas migrate apply`. This covers the query modules (§4.2) and the notcher contract test (§5.6.4).

**`.github/workflows/deploy.yml`** is the same structure as the example:

- **`deploy-preview`** runs on `push` to `master`, using GitHub environment `staging`:
  1. **Guard:** fail if no production deployment exists yet. Vercel auto-promotes a new project's first deployment to production whatever its target.
  2. Checkout, set the git author for Vercel, run `setup-node`, `npm i -g vercel`.
  3. `vercel pull --environment=preview`.
  4. `ariga/setup-atlas@v0`, then `ariga/atlas-action/migrate/apply@v1` with `dir: file://db/migrations`, `url: ${{ secrets.DATABASE_URL_UNPOOLED }}`, `revisions-schema: public`.
  5. `vercel build`, then `vercel deploy --prebuilt`.
  6. Alias the deployment to the staging domain through the Vercel API. `vercel alias` fails with team-scoped tokens.
- **`deploy-production`** runs on `workflow_dispatch`, using GitHub environment `production`: the same steps with `--environment=production`, migrations against the production branch, then `vercel build --prod` and `vercel deploy --prebuilt --prod`.
- **Ordering rule:** migrations run *before* the build/deploy and stop the job if they fail. So every migration must stay compatible with the code that is currently live, i.e. expand/contract: add columns first, drop them in a later release.
- **First deploy:** the very first deploy must be a manual production run, which is why the preview guard exists.

**`.github/workflows/migrate-reference-data.yml`** is the one-off data migration (§6). It runs on `workflow_dispatch` only, with an input `target: staging | production` and a confirmation input that must equal the target name. It runs `scripts/migrate-reference-data.ts` with `SOURCE_DATABASE_URL` and `DATABASE_URL_UNPOOLED` from that GitHub environment's secrets. It runs only after `deploy.yml` has migrated the target schema. Delete it after cutover.

### 8.4 Configuration
- **GitHub:**
  - repo variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_EMAIL`
  - repo secret `VERCEL_TOKEN`
  - environments `staging` and `production`, each with the secret `DATABASE_URL_UNPOOLED`
  - `SOURCE_DATABASE_URL` (read-only) on each environment, only until cutover
- **Vercel:**
  - one project (Next.js, Node 24), with Git auto-deploys off
  - the production domain on Production, and the staging domain assigned by CI
  - env vars per environment (Production and Preview): `DATABASE_URL` (pooled, that environment's Neon branch), `AUTH_SECRET` (a different value in each), `NOTCHER_API_KEY` (§5.6.3), `FROM_CLIENT_ID`
  - mark secrets Sensitive. Because Sensitive values are not exposed to `vercel pull`, CI reads `DATABASE_URL_UNPOOLED` from GitHub secrets, not from Vercel.
- **Neon:** one project with branches `production` and `staging`. Create staging from production after the reference data is loaded, so staging has real clients and products. If Neon was added through the Vercel Marketplace, turn off its per-preview branch creation, since CI targets fixed branches.
- **Local:** `.env.tpl` → `.env`, with `DATABASE_URL` pointing at a local Postgres container. Install Atlas with `curl -sSf https://atlasgo.sh | sh`. Add `.vercelignore` for tooling directories (`.claude`, `.cursor`, test output), which break `vercel deploy --prebuilt`.

## 9. Security fixes included in the migration
- `packages/notcher-api/src/index.js` has a **hardcoded DigitalOcean DB connection string with a password**. It is committed to git history. **Rotate that password now**, whatever happens with the migration timeline.
- `packages/delivery/sql/api-basic-auth-init.sql` hardcodes the JWT signing secret. This goes away with PostgREST, but rotate it if the old system keeps running for a while.
- `migrate-old-data/.env.tpl` has sample credentials. Delete it with the package.
- New app: every secret lives in Vercel env vars, and every mutation checks the session on the server. The notcher endpoint is protected only by its `key` query parameter, which comes from the env var. It must not be logged (§5.6.3). Optionally add a Vercel Firewall IP allowlist if the software's source IP is stable.

## 10. Cutover plan
1. **Build:** the new app is complete on staging. Reference data is loaded into the `staging` branch by `migrate-reference-data.yml` from a recent prod snapshot.
2. **UAT:** staff check every screen against web3 (checklist built from §5) and the notcher machine is tested against the staging URL.
3. **Agree a cutover point with the business.** Because orders don't migrate, staff must either (a) finish or close open orders in the old system first, or (b) enter open orders again by hand in the new system. **Decide which before cutover** (Open Questions).
4. **Cutover day:**
   - freeze client and product edits in the old system
   - run **Deploy → Production** (applies the schema migrations), then **migrate-reference-data** with `target: production`
   - verify (§6.4)
   - create the users
   - point the production host the notcher software calls at Vercel (§5.6.2). The external software's configured URL does **not** change.
   - confirm one live request from the notcher software succeeds before going further
5. **Keep the old system read-only for 30 days** so staff can look up historical orders.
6. **Decommission:**
   - take a final `pg_dump` archive
   - shut down the droplets and the DO managed DB
   - archive the legacy `fib-om` repo on GitHub (read-only), with a README note pointing at `fib-om-v2`

## 11. Implementation milestones
1. Scaffold: Next.js, shadcn, Tailwind theme, Neon `sql` client, Atlas (`atlas.hcl`, `scripts/db.sh`), Auth.js login, app shell with sidebar. Add `ci.yml` and `deploy.yml` (§8.3), then do the first manual production deploy so the staging guard passes.
2. SQL migrations for all tables, enums and views (reference and order tables). Get the production DDL and views as a starting point.
3. Shared building blocks (§5.1): a `DataTable` with URL-synced filters, sort and pagination; an async reference combobox; the form/Server Action pattern with toasts and `returnTo`; the SQLSTATE error mapping (§5.9); print styles (§5.10).
4. Reference data CRUD screens (§5.2), plus the data migration script and its checks (§6).
5. Orders CRUD with an inline items panel (§5.3).
6. Order items list with category-driven columns, inline stage toggles, derived columns and tests (§5.4).
7. Delivery dockets: create, the print layout, and adding/removing orders on a docket (§5.5).
8. Notcher feed at `/vw-notcher-api?key=…`: port the SQL verbatim, enforce the `key` check (§5.6.3), pass the byte-diff contract test (§5.6.4), and plan the production host cutover (§5.6.2).
9. UAT, cutover, decommission (§10).

## 12. Open questions
1. **Open orders at cutover:** close them in the old system, or re-key them in the new one?
2. **Delivery docket fields:** confirm from the production DDL that `docket_number` is the zero-padded id and `fromclient_id` is a fixed Fibatron client (§5.5). Which client id is Fibatron?
3. **Notcher software:**
   - Confirm the `key` value the software is configured with, so it can be set as `NOTCHER_API_KEY` in production. Hand it over securely at deploy time, not in this doc.
   - Which production host is the software configured with, and what else is served on that host?
   - Does it handle an empty `[]` feed at cutover?
   - Does it depend on row order?
   - Is its source IP stable?
4. **Users:** recreate them (A) or carry existing password hashes over (B)? Do you want a Users admin screen?
5. **Historical order lookup:** is the archived dump plus a 30-day read-only old system enough, or should old orders be viewable in the new app as a read-only import later?
6. **Column renames:** OK to move to snake_case in the new schema (§6.3)?
