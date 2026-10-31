# Spec — 03-custom-behaviour

- Date: 20261031-140121
- Feature: 03-custom-behaviour
- Phase: 1 (Spec)

> Part 3 of 4 of the FIB OM migration. Read with the overview
> [`artifacts/docs/nextjs-vercel-neon-migration.md`](../../docs/nextjs-vercel-neon-migration.md)
> (sections O1–O9). Depends on `02-basic-crud`. Next: `04-data-scripts`.

## Summary

Add everything in FIB OM that goes beyond plain CRUD: the order items panel on orders, the category-driven order-items list with inline production-stage toggles, the derived columns (`calculated_id`, `pleats`, `wire_metres`, `wire_height`, `order_items_packed`), the delivery docket print layout with adding and removing orders, and the notcher feed at `/vw-notcher-api`, an external contract that must match what the production PHP app returns today.

## User-visible behaviour

### Order items panel (on orders)
It appears on both the order detail page and the order edit page, with the heading "Order Items":
- **Columns:** item id, type name, part number, qty, H, W, D.
- **Package-status toggle** (detail page): an inline toggle for `package_status` on each row, with the toast "Order package status updated". It works like the list stage toggles below.
- **Row actions:** Edit and Show on the detail page; Edit and **Remove** on the edit page.
- **Remove** opens a confirmation dialog titled "Delete?" with the text "{qty} x {type name}". On success the toast is "Order Item Deleted". On failure: "Could not delete Order Item: <message>".
- **Add** opens the item form with the order already filled in (`/order-items/new?orderId=…`).
- **Return to the order:** after an item is created or edited from this panel, you go back to the order page you came from, detail or edit. Pass it as `?returnTo=` and allow only internal paths. When the form is opened from anywhere else, you go to the order-items list.
- On print, the action buttons, toggles and Add button are hidden.

### Order items list: category-driven columns (key feature)
- The list always shows a **Product Category** filter (a select with an "All" option) and an **Order Status** filter. Every category attribute is also available as a filter.
- **With a category picked:** the visible columns are the always-on set (`client`, `order`, `due date`, `status`, `type code`, `type name`, `comment`) plus every column whose `show_<col>` flag is true on that category.
- **Column order is fixed.** It doesn't depend on which flags are on: Client, Order, Due Date, Code, Description, Size, Part Number, Quantity, Height, Width, Depth, Comment, Media Code, Has Wire Header?, Has Header Frame?, Type, Number, Clip Type, Clip Position, Has Gasket?, Pockets, Has Legs?, Wire Mesh, Has Gate?, Wire Sides, ID (`calculated_id`), Pleats, Wire Metres, Wire Height, Media Mats, Gasket, Drawing Number, Cut Count, Sow Count, Status, then the stage toggles Package, Assemble, Frame, Media, Wire, Cut, Sow.
- **With no category picked:** the list shows client, order number, created, due and status (as in spec 02).
- **(improvement)** The server resolves the category's columns in the same request as the rows, so the columns don't jump after load.

### Inline stage toggles
- The 7 stage statuses (`cut`, `sow`, `frame`, `media`, `wire`, `package`, `assemble`) appear as toggle buttons in the list when the category shows them.
- Clicking one saves straight away, without opening the row, and shows the toast "<Stage> Status updated". If it fails, the toast is "Could not update <Stage> Status" and the toggle goes back to its previous state.
- **(improvement)** The update is optimistic and changes only that row; other toggles stay usable. (web3 reloads the whole list and disables every toggle while saving.)
- Toggles have `aria-pressed` and a text label, not only an icon.

### Order combobox on the item form
- Lists orders with status New first, then the rest **(improvement)**.

### Derived columns
- The order-items list and detail show `calculated_id` (as "ID"), `pleats`, `wire_metres`, `wire_height`, computed exactly as the legacy `orders_products_rel` view does.
- Dockets show "Items Packed" (`order_items_packed`), computed exactly as the legacy `orders_rel` view does.

### Delivery docket detail: print layout
Replaces the basic docket detail from spec 02.
- A "Delivery Docket" heading (print only), date, delivery number.
- A From block and a To block, each with the client name and shipping address.
- The heading "The following orders in good order and condition" (print only).
- **Orders on this docket:** order number, then status, Items Packed and a Show link, which appear on screen only. On print the table's header row is hidden.
- **Add order** (screen only): a combobox listing orders that belong to the docket's to-client and are on **no** docket, with a note that an order can only be on one docket, and an ADD button. ADD sets the order's delivery docket, then refreshes the list. **(improvement: web3 lists orders on other dockets and silently moves them.)**
- **Remove order (improvement):** a Remove action on each row (screen only) with a confirmation dialog; it clears the order's delivery docket.

### Notcher feed: a frozen external contract

> **Hard constraint.** External notcher software reads this endpoint, and that software **cannot be updated**. Production today is the legacy **PHP app on MySQL** (`legacy-prod/module/VWNotcher/`), not the v1 Express app in `../fib-om/packages/notcher-api`. The new feed must return what the PHP app returns for the same data. **Production is the reference only for this endpoint**; every other feature follows v1 (`../fib-om`) and this spec set.

```
GET {origin}/vw-notcher-api?key=<api key>
```

- The **path** `/vw-notcher-api` (no trailing slash) and the **query parameter** `key` are fixed. The origin is whatever host the app is deployed on; no hostnames are hardcoded.
- The app itself must not change the request: no trailing-slash rewrite and no auth redirect. In production, Vercel's default domain redirect `fibatron.com` → `www.fibatron.com` (a `308`) is allowed **only if** the notcher software is proven on staging to follow it and still read the data; otherwise the feed path is exempted from the redirect (spec 04, cutover plan).
- **Which items (as production):** only order items where the order's status is New (legacy `2`), the item's frame status is not done (legacy `frame_status = 0`), and the item's product has `notcher` set. Ordered by item id ascending.
- **Body (as production):** the PHP `json_encode` (default flags) of an array of order-item objects: no whitespace, `/` escaped as `\/`, non-ASCII escaped as `\uXXXX`. Keys in the PHP entity property order:
  - item: `id, order, partnumber, product, quantity, height, width, comment, framestatus, mediastatus, wirestatus, assemblestatus, packagestatus, cutcount, cutstatus, sowcount, sowstatus`
  - `order`: `id, date, client, ordernumber, duedate, status, deliverydocket, invoice`
  - `order.client`: `id, name, fullname, phone, landline, fax, addressshipping, addressbilling, abn, acn, markup, labelreordertext, labelname, labelsubname, labeladdressline1, labeladdressline2, labelusepartnumber`
  - `product`: `id, name, category, type, size, media, price, priceheight400, priceheight600, priceheight900, pricewidth, notcher, efficiency`
  - `product.category` `{id, name}`, `product.type` `{id, name, code}`, `product.size` `{id, name}`, `product.media` `{id, name}`
- **Values:** taken from the new schema and transformed in TypeScript into production's types and formats: integers as JSON numbers (ids, quantity, height, width, statuses, counts, `order.status` mapped `new→2`, `complete→4`, `archived→5`, `product.notcher`); `order.date`/`order.duedate` formatted like PHP `d M` (e.g. `07 Jan`); text as JSON strings. `cutstatus` and `sowstatus` are `-1` when not done and `1` when done; the other stage statuses are `0`/`1`.
- **Fields the new schema doesn't have** (`client.markup`, `product.price`, `priceheight400`, `priceheight600`, `priceheight900`, `pricewidth`, and `order.invoice`): still emitted, in their positions, with an empty value (`null`).
- **Production capture is the authority.** Where the code reading above and a real production response disagree (e.g. how `deliverydocket` serialises, whether `labelusepartnumber` is `"0"`/`"1"` or a number, what `cutstatus`/`sowstatus` hold), the capture wins (Design, contract test).
- **Headers:** `200`, the same `Content-Type` as production (PHP default, expected `text/html; charset=UTF-8`; confirmed by the capture), and production's `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: POST PUT DELETE GET`. Also `Cache-Control: no-store`; never cached by the CDN.
- **Error path:** a database error returns `200` with body `error` (production returns the exception message; internal details are not exposed).
- **Auth:** the `key` query parameter.
  - The expected value is the env var `NOTCHER_API_KEY` (never committed); its production value equals the key hardcoded in the PHP controller.
  - Missing or wrong `key`: `401`, `Content-Type: text/plain; charset=utf-8`, body `unauthorized`; the database is not queried. (Production returns `200` with `invalid request` / `missing query params`; the notcher always sends the right key, so this difference is deliberate.)
  - Fail closed: if `NOTCHER_API_KEY` is unset, every request returns `401` and an error is logged.
  - Session auth does not run on this path.
  - The request URL, including `key`, is kept out of logs and analytics (query string redacted).

## Design

- **Derived columns:** ported from v1's `views.sql` (`../fib-om-v2-reference/migrations/`) into the views `order_items_v`, `orders_v` and `delivery_dockets_v` (Atlas migrations), so lists and detail pages share one definition. (The notcher feed doesn't emit these columns.) They depend on `product_types.millimetres_per_pleat`, `product_media.pleat_spacing` and the item dimensions. These are plain (not materialized) views, computed at query time, so values are always current and need no refresh.
- **Derived-column fixture:** the legacy reference files in `../fib-om-v2-reference/migrations/` (`data.sql` = full legacy `pg_dump` with data, then `data-ddl-updates.sql`, `data-dml-updates.sql`, `views.sql`, applied in that order) rebuild a working legacy database locally. A one-off script, `scripts/extract-derived-fixture.ts`, builds that database in a local Postgres container, picks order items covering every product category plus edge cases (zero/NULL dimensions, missing pleat spacing), and writes `tests/fixtures/derived-columns.json` with only the inputs the formulas need (dimensions, `millimetres_per_pleat`, `pleat_spacing`, category, stage statuses for `order_items_packed`) and the legacy view outputs. The fixture contains no client names, addresses or other personal data, and the reference files themselves are never copied into this repo. The test loads the fixture inputs into the new schema and compares the new views' outputs with the recorded legacy ones.
- **Category-driven columns:** the order-items page reads the selected category's `show_*` flags and the rows in the same server render; a fixed ordered column registry in TS maps each column to its `show_*` flag (or "always on") and its cell renderer.
- **Stage toggles:** a client component using `useOptimistic` + a Server Action `setStageStatus(itemId, stage, value)`. `stage` is checked against an allowlist of the 7 names and mapped to a fixed column; the action runs `SET <stage>_status = $value` (an explicit value, not a flip), so double clicks can't drift. After saving it calls `revalidatePath` for the order-items list, so the page re-renders on the server in the background and the fresh data replaces the optimistic state; toggles stay enabled and nothing visibly reloads.
- **`returnTo`:** accepted only if it starts with a single `/` and matches `/orders/<id>` or `/orders/<id>/edit`; otherwise ignored.
- **Order combobox ordering:** `ORDER BY (status = 'new') DESC, <existing order>`.
- **Docket to-client edit:** the docket edit Server Action refuses to change the to-client while any orders are on the docket, with "Remove the orders before changing the client".
- **Docket order management:** Server Actions `addOrderToDocket(docketId, orderId)` (refuses if the order already has a docket or belongs to another client) and `removeOrderFromDocket(docketId, orderId)` (sets `delivery_docket_id = NULL`).
- **Notcher feed:**
  - `app/vw-notcher-api/route.ts`, a root-level Route Handler, `export const dynamic = 'force-dynamic'`; no `trailingSlash` in `next.config`; excluded from the `proxy.ts` matcher (spec 01).
  - One parameterised SQL query (`lib/db/queries/notcher-feed.ts`) selects the filtered items with their order, client, product, category, type, size and media from the new schema, ordered by item id.
  - A pure TypeScript transform (`lib/notcher/to-legacy.ts`) builds each item as an object with production's keys, order and types (including the empty fields for removed columns), and `lib/notcher/php-json-encode.ts` serialises the array exactly like PHP `json_encode` with default flags (escaped `/`, `\uXXXX` for non-ASCII including surrogate pairs, same number and string forms).
  - `key` is compared with `crypto.timingSafeEqual` on equal-length buffers.
  - The legacy PHP source in `legacy-prod/` is gitignored (it contains credentials) and is never copied into the repo.
- **Contract test (gate for cutover):**
  - **Production capture** (run on the trusted machine, together with spec 04's MySQL snapshot so both reflect the same moment): `scripts/notcher-capture.sh` saves the production response (status, headers, raw body) for a valid key into the gitignored `snapshots/` directory, next to a `mysqldump` taken in the same minute.
  - **Capture check:** `scripts/notcher-capture-check.ts` loads the items in the capture (orders, items, clients, products and lookups, from the MySQL dump) into a local Postgres with the new schema, calls the new route, and diffs the raw bytes against the capture. The only allowed differences are the empty fields for removed columns, listed explicitly in the script. This is run before cutover and again after the newer dump arrives.
  - **CI golden test:** `tests/notcher-contract.test.ts` runs the route against a synthetic fixture (no real client data) covering every field, NULLs, non-ASCII text, `/` in text, every order status (only New included) and both values of the frame status and notcher flag, and compares with a committed golden file. The golden file is regenerated only after the capture check passes.
  - Unit tests for `php-json-encode.ts` against known PHP outputs (strings with `/`, quotes, backslashes, control characters, accented letters, emoji).

## Acceptance criteria

All automated (unit, integration against Postgres with migrations applied, or Playwright).

**Order items panel**
1. **AC-1** The order detail and edit pages both show an "Order Items" panel with columns item id, type name, part number, qty, H, W, D; detail rows have Edit, Show and a package-status toggle; edit rows have Edit and Remove.
2. **AC-2** Add opens `/order-items/new?orderId=<id>&returnTo=<order page>` with the order prefilled; after saving (create or edit) from the panel the user lands on the order page they came from (detail or edit).
3. **AC-3** A `returnTo` of `https://evil.example`, `//evil.example` or `/clients` is ignored and the user lands on the order-items list.
4. **AC-4** Remove shows a dialog titled "Delete?" with "{qty} x {type name}"; confirming deletes the item and shows "Order Item Deleted"; a failure shows "Could not delete Order Item: <message>".
5. **AC-5** Toggling package status on the order detail panel persists the value and shows "Order package status updated".
6. **AC-6** In print media the panel's action buttons, toggles and Add button are hidden.

**Order items list and toggles**
7. **AC-7** The order-items list always shows a Product Category select (with "All") and an Order Status filter; every category attribute can be added as a filter.
8. **AC-8** With no category selected the columns are exactly client, order number, created, due, status.
9. **AC-9** With a category selected the columns are the always-on set plus every column whose `show_<col>` flag is true, in the fixed order; turning flags on or off changes which columns appear but never their relative order (test with at least two categories with different flags).
10. **AC-10** The initial server HTML for a category-filtered list already contains the correct column headers (no client-side fetch of the category).
11. **AC-11** Clicking a stage toggle updates it immediately, persists the explicit new value, shows "<Stage> Status updated", and leaves other rows' toggles enabled and unchanged.
12. **AC-12** When the stage Server Action fails, the toggle reverts and "Could not update <Stage> Status" is shown.
13. **AC-13** The stage Server Action rejects a stage name outside the 7 allowed; two rapid clicks on one toggle end with the stored value equal to the displayed value.
14. **AC-14** Stage toggles have `aria-pressed` and a text label.
15. **AC-15** The order combobox on the item form lists New orders before orders of any other status.

**Derived columns**
16. **AC-16** `calculated_id`, `pleats`, `wire_metres`, `wire_height` and `order_items_packed` from the new views match the legacy view outputs recorded in `tests/fixtures/derived-columns.json` (extracted from the legacy reference database, covering every product category and the edge cases zero/NULL dimensions and missing pleat spacing), for every row in the fixture.
17. **AC-17** `tests/fixtures/derived-columns.json` contains no client names, addresses, phone numbers or ABN/ACN values.

**Delivery dockets**
18. **AC-18** The docket detail page shows, on screen: date, delivery number, From and To blocks (name and shipping address), and the orders table with order number, status, Items Packed and Show; in print media it also shows the "Delivery Docket" and "The following orders in good order and condition" headings, hides status, Items Packed, Show, Add and Remove, and hides the orders table header row.
19. **AC-19** The Add-order combobox lists only orders for the docket's to-client that are on no docket, and shows the one-docket note; ADD puts the order on the docket and it appears in the list.
20. **AC-20** `addOrderToDocket` refuses an order that is already on a docket or belongs to another client, even when called directly.
21. **AC-21** Remove asks for confirmation, then clears the order's docket and removes it from the list.
22. **AC-22** Changing a docket's to-client while orders are on it is refused with "Remove the orders before changing the client" (also when the Server Action is called directly); with no orders on it, the change saves.

**Notcher feed**
23. **AC-23** `GET /vw-notcher-api?key=<valid>` returns `200` with production's `Content-Type` and CORS headers plus `Cache-Control: no-store`, and only items whose order is New, whose frame status is not done and whose product has `notcher` set, ordered by item id (fixture with items failing each condition).
24. **AC-24** The capture check passes: for the items in a production capture, the new route's raw body bytes equal the captured body except for the listed empty fields for removed columns, and the `Content-Type` matches.
25. **AC-25** `tests/notcher-contract.test.ts` runs in CI against the committed golden file and fails if the feed output changes.
26. **AC-26** Keys appear in the documented PHP order at every level; removed fields (`markup`, `price*`, `invoice`) are present with `null`; `order.status` is `2`/`4`/`5` for new/complete/archived; dates are `d M` (e.g. `07 Jan`); `cutstatus`/`sowstatus` are `-1`/`1` and the other stage statuses `0`/`1`.
27. **AC-27** `php-json-encode.ts` output equals PHP `json_encode` output for the unit-test cases (escaped `/`, quotes, backslashes, control characters, non-ASCII and emoji as `\uXXXX`).
28. **AC-28** A missing or wrong `key` returns `401`, `text/plain; charset=utf-8`, body `unauthorized`, and no database query is made.
29. **AC-29** With `NOTCHER_API_KEY` unset every request returns `401` and an error is logged.
30. **AC-30** A database error returns `200` with body `error`.
31. **AC-31** An unauthenticated request to `/vw-notcher-api` is not redirected; `next.config` does not enable `trailingSlash`; two consecutive requests with different data return different bodies (not cached).
32. **AC-32** Server logs for a feed request don't contain the `key` value.

## Out of scope

- Any change to the notcher feed's URL, headers, body, filtering or error behaviour, and any change to the external notcher software.
- Pointing the production host at Vercel and the cutover checks (`04-data-scripts`).
- Changing the feed's filter, paging it, or emitting `application/json`.
- Running the legacy PHP app in CI.
- Moving an order between dockets in one step (remove, then add).

## Open questions

1. ~~**OQ-1 Derived columns: views or TypeScript?**~~ — resolved 2026-10-31: plain Postgres views.
2. ~~**OQ-2 Real rows for derived-column tests**~~ — resolved 2026-10-31: extracted from the legacy reference files in `../fib-om-v2-reference/migrations/` (see Design).
3. ~~**OQ-3 Notcher software behaviour**~~ — resolved 2026-10-31: unknown; tested on staging before cutover (spec 04). This spec orders by item id either way.
4. ~~**OQ-4 Cut and sow status values**~~ — resolved 2026-10-31: `cutstatus`/`sowstatus` are `-1` when not done and `1` when done (production's defaults), confirmed by the production capture check before cutover.
