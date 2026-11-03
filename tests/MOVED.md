# Moved tests (spec 09, test pyramid)

Every e2e or integration test that spec 09's "T — test pyramid" removed or merged, with the test
that now covers its behaviour. `tests/unit/moved-map.test.ts` checks every row: the new file
exists and contains the new title, and a removed test is gone from its old file.

Titles built from a template (`${key}: …`, `%s`) are listed by their fixed part.

## E1 — proxy paths → unit (proxy matcher)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/routes.spec.ts | /login is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /api/auth/session is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /api/auth/csrf is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /favicon.ico is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /bg.jpg is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /vw-notcher-api is not redirected to /login | tests/unit/proxy-matcher.test.ts | is not redirected to /login |
| tests/e2e/routes.spec.ts | /orders redirects to /login | tests/unit/proxy-matcher.test.ts | redirects to /login |
| tests/e2e/routes.spec.ts | /users/1/edit redirects to /login | tests/unit/proxy-matcher.test.ts | sends a signed-out request to /login with the path and query as callbackUrl |

## E2 — CRUD lifecycle per resource → integration

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/crud.spec.ts | AC-5 Client: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Product Category: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Product Type: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Product Size: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Product Media: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Product: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Delivery Docket: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |
| tests/e2e/crud.spec.ts | AC-5 Order: create, list, detail, edit, delete | tests/integration/crud-lifecycle.test.ts | create, list, read, edit, delete |

## E3 — list defaults per resource → unit (config)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Users: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Products: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Product categories: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Product types: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Product sizes: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Product media: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | AC-6 list defaults, filters and columns |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Orders: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | 06 AC-8 list titles and New buttons |
| tests/e2e/lists.spec.ts | AC-6 / 06 AC-8 Delivery dockets: heading, columns, default sort, New button, no bulk selection | tests/unit/resources-config.test.ts | 06 AC-8 list titles and New buttons |

## E4 — deep link per resource → unit (panel render)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/list-panels.spec.ts | users: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | product_categories: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | product_types: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | product_sizes: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | product_media: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | products: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |
| tests/e2e/list-panels.spec.ts | delivery_dockets: ?item opens the panel with the caption and title heading | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |

## E5 — panel fields → unit (panel render)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/list-panels.spec.ts | each panel holds every field of the resource's edit form | tests/unit/record-panel-fields.test.tsx | each panel holds every field of the resource's edit form |

## E6 — stale order writes → integration (already covered)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/list-panels.spec.ts | a colleague's change to the order survives a quantity-only save | tests/integration/list-panels.test.ts | a save without the order fields leaves an externally changed order untouched |

## E7 — unsafe callbackUrls → unit (already covered)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/login.spec.ts | AC-4 callbackUrl https://evil.example lands on / | tests/unit/callback-url.test.ts | AC-4 safeCallbackUrl |
| tests/e2e/login.spec.ts | AC-4 callbackUrl javascript:alert(1) lands on / | tests/unit/callback-url.test.ts | AC-4 safeCallbackUrl |

## E8 — email case → unit (already covered)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/login.spec.ts | AC-5 email in a different case signs in | tests/unit/credentials.test.ts | matches the email case-insensitively and trimmed |

## E9 — sign-in limit → integration (login action)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/login.spec.ts | AC-19 the 11th sign-in attempt in a minute is refused, without checking the password | tests/integration/sign-in-action.test.ts | lets 10 attempts reach signIn, then refuses the 11th without checking the password |

## E10 — list filtering → integration and unit (already covered)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/lists.spec.ts | AC-11 list text filters match anywhere, case-insensitively | tests/integration/list-query.test.ts | a search for 'cme' finds ACME |
| tests/e2e/lists.spec.ts | Review 02 finding 1: invalid filter values in the URL don't break the list | tests/unit/list-query-builder.test.ts | Review 02 finding 1: invalid filter values are ignored, not sent to Postgres |
| tests/e2e/forms.spec.ts | AC-23 filtering products by type returns exactly that type's products | tests/integration/list-query.test.ts | returns exactly the products with that type_id |

## E11 — form fields → unit (config, panel render)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/forms.spec.ts | AC-24 the category form shows every show_* flag as a switch, under the heading, in groups | tests/unit/resources-config.test.ts | has every show_* flag as a switch, grouped under the heading in the v1 groups |
| tests/e2e/forms.spec.ts | AC-25 the client form has every field, with Label Use Part Number as a switch | tests/unit/resources-config.test.ts | has every client field, with label use part number as a switch |

## E12 — bad item ids on Order Items → merged

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/order-items.spec.ts | 06 AC-18 non-numeric and unknown ids open no panel; unknown shows a toast | tests/e2e/list-panels.spec.ts | a record outside the current page or tab still opens; bad ids open nothing |

## E13 — Users create dialog rules → integration (already covered)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/create-dialogs.spec.ts | Password is required; a user with a blank name is created | tests/integration/create-dialogs.test.ts | requires a password on create |

## E14 — axe sweeps → one sweep

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/e2e/shell.spec.ts | 06 AC-7 axe finds no critical violations and no contrast failures on | tests/e2e/shell.spec.ts | 06 AC-7 / 02 AC-30 axe sweep |
| tests/e2e/forms.spec.ts | AC-30 axe: no critical violations and every control labelled, on every list, detail and form page | tests/e2e/shell.spec.ts | 06 AC-7 / 02 AC-30 axe sweep |

## I1 — CLI refusals → unit (guards in-process)

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/integration/create-user.test.ts | refuses no --target before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses an unknown target before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses --target local with a non-local host before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses --target staging without PRODUCTION_DB_HOST before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses --target staging with no terminal and no --yes before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses --target production with no terminal and no --yes before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | refuses an unknown option before connecting, in one line | tests/unit/create-user-guard.test.ts | refuses %s before connecting, in one line |
| tests/integration/create-user.test.ts | lets --target production --yes through the guard (it then tries to connect) | tests/unit/create-user-guard.test.ts | lets --target production --yes through the guard |
| tests/integration/seed-dummy-cli.test.ts | --target production | tests/unit/seed-dummy-guard.test.ts | --target production |
| tests/integration/seed-dummy-cli.test.ts | no --target | tests/unit/seed-dummy-guard.test.ts | no --target |
| tests/integration/seed-dummy-cli.test.ts | --target prod | tests/unit/seed-dummy-guard.test.ts | --target prod |
| tests/integration/seed-dummy-cli.test.ts | --target local with a non-local host | tests/unit/seed-dummy-guard.test.ts | --target local with a non-local host |
| tests/integration/seed-dummy-cli.test.ts | --target staging without PRODUCTION_DB_HOST | tests/unit/seed-dummy-guard.test.ts | --target staging without PRODUCTION_DB_HOST |
| tests/integration/seed-dummy-cli.test.ts | --target staging with no terminal and no --yes | tests/unit/seed-dummy-guard.test.ts | --target staging with no terminal and no --yes |
| tests/integration/seed-dummy-cli.test.ts | refuses --target staging --yes when the host is the production host | tests/unit/seed-dummy-guard.test.ts | refuses --target staging --yes when the host is the production host |
| tests/integration/seed-dummy-cli.test.ts | lets --target local through for localhost | tests/unit/seed-dummy-guard.test.ts | lets --target local through for %s |
| tests/integration/seed-dummy-cli.test.ts | lets --target local through for 127.0.0.1 | tests/unit/seed-dummy-guard.test.ts | lets --target local through for %s |
| tests/integration/seed-dummy-cli.test.ts | lets --target local through for db.localtest.me | tests/unit/seed-dummy-guard.test.ts | lets --target local through for %s |
| tests/integration/seed-dummy-cli.test.ts | prints one line for an unknown option, before connecting | tests/unit/seed-dummy-guard.test.ts | prints one line for %s, before connecting |
| tests/integration/seed-dummy-cli.test.ts | prints one line for a non-integer --seed, before connecting | tests/unit/seed-dummy-guard.test.ts | prints one line for %s, before connecting |
| tests/integration/seed-dummy-cli.test.ts | prints one line for a non-numeric FROM_CLIENT_ID, before connecting | tests/unit/seed-dummy-guard.test.ts | prints one line for %s, before connecting |
| tests/integration/seed-dummy-cli.test.ts | accepts --target=local --seed=5 | tests/unit/seed-dummy-guard.test.ts | accepts --target=local --seed=5 |
| tests/integration/seed-dummy-cli.test.ts | refuses --target staging --yes when PRODUCTION_DB_HOST is the pooled form of the URL's host | tests/unit/seed-dummy-guard.test.ts | refuses --target staging --yes when PRODUCTION_DB_HOST is the pooled form of the URL's host |

The seed-dummy "--target staging without FROM_CLIENT_ID" case stays spawned in
`tests/integration/seed-dummy-cli.test.ts`, as the one check of the real CLI's wiring, and also
runs in-process in `tests/unit/seed-dummy-guard.test.ts`.

## I2 — create-user runs in-process

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/integration/create-user.test.ts | does not take the password from the command line | tests/unit/create-user-args.test.ts | a-password-in-argv |

The other AC-14 cases stay in `tests/integration/create-user.test.ts`, calling `createUser`
in-process; "the CLI creates a user with a bcrypt hash, not plaintext" keeps one spawn.

## I3 — list-query builder → unit

| Old file | Old test | New file | New test |
|---|---|---|---|
| tests/integration/list-query.test.ts | rejects an unknown filter key | tests/unit/list-query-builder.test.ts | rejects an unknown filter key |
| tests/integration/list-query.test.ts | rejects an unknown sort key | tests/unit/list-query-builder.test.ts | rejects an unknown sort key |
| tests/integration/list-query.test.ts | %s %j lists unfiltered for that key | tests/unit/list-query-builder.test.ts | %s %j adds no condition |
| tests/integration/list-query.test.ts | %s status %j lists unfiltered | tests/unit/list-query-builder.test.ts | %s status %j adds no condition (All) |
| tests/integration/list-panels.test.ts | rejects status filtering and counting for resources without status tabs | tests/unit/list-query-builder.test.ts | rejects status filtering for resources without status tabs |
| tests/integration/list-panels.test.ts | the old status filter is gone from orders and dockets | tests/unit/list-query-builder.test.ts | the old status filter is gone from orders and dockets |

"injection string is data", "valid values still filter" and one invalid-value case
(`created_from: "abc"`) stay in `tests/integration/list-query.test.ts`.
