# Rebuilding FIB OM

FIB OM is the internal order-management system for Fibatron, a filter manufacturer. Staff use it to keep the client list and product catalogue, take orders, track each order item through production (cut, sow, frame, media, wire, assemble, package) and print delivery dockets. A notcher machine on the factory floor reads a JSON feed from the same system to know which filters to notch.

This book follows the rebuild of FIB OM as a single Next.js app on Vercel, backed by Neon Postgres. There are really three systems in this story. **Production** is a PHP app (Zend Framework 2 and Doctrine, with an AngularJS front end) on MySQL, and it's what staff and the notcher machine use today. **v1** (`../fib-om`) was a first rewrite (react-admin, PostgREST, DigitalOcean Postgres) that never went live. **v2**, this repo, is the rebuild. v1 is the reference for how every feature should behave; production is the reference only for the notcher feed, and the source of the real data.

The work is split into four features, built in order. Each gets a chapter, and each chapter grows as the feature moves through the workflow: spec, tasks, implementation, review.

The shared background for all four (architecture, conventions, environments, decisions) lives in `artifacts/docs/nextjs-vercel-neon-migration.md`.

## How the specs came to be

The project started from one long, human-written migration spec. Turning it into something buildable took several rounds. First it was reshaped into the workflow's spec format. Then the author answered its open questions and asked for it to be split into four specs, one per delivery phase: users and auth, basic CRUD, custom behaviour, and data scripts.

The biggest turn came during the first review. The spec treated v1's Express notcher API as the contract for the notcher feed. Checking how that feed would grow past Vercel's 4.5 MB response limit led to a question about how production filters it, and the author pointed to the production PHP code. That code showed production wasn't v1 at all: it was a PHP app on MySQL, with a filtered feed and a different JSON shape. Everything that depended on "the legacy system" was re-examined. The outcome was a clear rule: v1 decides how features behave, production decides what the notcher feed returns and where the data comes from.

Each spec then went through review until it passed: specs 01 and 02 on the second pass, 03 on the third, and 04 on the fourth.

---

# 1. Users and auth (`01-users-auth`)

## Spec

Before any screen can exist, the app needs a home: a Next.js 16 project with Tailwind and shadcn/ui, a Neon database client, versioned migrations, CI, a deploy pipeline and a way to sign in. This first feature builds all of that and stops at a deliberately small piece of real behaviour: staff sign in with email and password, land on an empty Dashboard inside the app shell, and sign out.

The interesting decisions were about how sign-in behaves under pressure. The first draft rate-limited `/api/auth/*` with a Vercel Firewall rule. Review pointed out that Auth.js calls its own session and CSRF endpoints under that path during ordinary use, so staff could be locked out just by working. Then the author confirmed the project runs on Vercel's Hobby plan, so the limiter moved into the app instead: the `/login` Server Action records each attempt in a `login_attempts` table and refuses the eleventh within a minute from the same IP, without checking the password.

Smaller choices fill in the rest. Sessions are an 8-hour rolling JWT, refreshed every 15 minutes of activity. An unknown email is still checked against a dummy bcrypt hash, so a failed login takes the same time either way and doesn't reveal which emails exist. Passwords need at least 12 characters and nothing else. Migrations are Atlas versioned SQL against Postgres 17:

```hcl
env "local" {
  url = getenv("DATABASE_URL")
  dev = "docker://postgres/17/dev"
  migration {
    dir = "file://db/migrations"
  }
}
```

Schema migrations and deploys only ever run from GitHub Actions. A push to `main` deploys to `staging.fibatron.com`, and production is a manual dispatch.

## Tasks

The spec became a checklist of 51 tasks in eight groups: scaffold, database access and migrations, passwords and the `create-user` script, authentication, the app shell and theme, tests, CI and deploy, and the manual setup of Neon, GitHub and Vercel. Each task names the acceptance criterion it serves, so every criterion maps to something buildable.

Reviewing the list took four rounds, and each round found a problem that only showed once the work was laid out step by step. The first noticed that a dozen acceptance criteria rely on Playwright, but nothing would run those tests: CI only ran unit and integration tests, and there was no local database. The author added a docker-compose Postgres and a Playwright step in CI, and the spec's AC-16 grew to match.

That change exposed the second problem. Every browser test signs in from the same IP, and the 10-per-minute sign-in limit from the spec would start refusing them partway through the suite. The fix is a Playwright setup step that signs in once and saves the session. Only the tests that are actually about login sign in themselves, and they clear the attempts table first.

The third round caught something more basic. The app talks to Neon through `@neondatabase/serverless`, which sends queries over HTTP and WebSockets to Neon's own endpoints, so it can't reach a plain Postgres container. Rather than switch drivers outside production, the author chose to run a Neon-compatible proxy next to Postgres, locally and in CI, and point the driver at it:

> when `DATABASE_URL` isn't a Neon host, set `neonConfig` (fetch endpoint, WebSocket proxy, no TLS) to use the local proxy, so the same driver runs locally, in CI and on Neon

The fourth round only added small things: an explicit task for the Auth.js route handler, and a reordering so `.env.tpl` exists before the docker-compose task refers to it. Then the list passed.

## Implementation

The tests came first: 75 unit tests, 14 integration tests and 32 browser tests, each named after the acceptance criterion it checks. None of the code existed yet, so even the scaffold had to arrive before the tests could compile. `create-next-app` won't run in a folder that already has files, so the project was scaffolded in a scratch folder and moved in.

Next.js 16.4 brought two things worth reading the bundled docs for. Middleware is now called `proxy.ts`. And the scaffold turns on Cache Components by default, which prerenders a static shell for every page and streams anything request-specific into it. That shaped the app layout: the signed-in email, the sidebar's active item and the page content all sit inside `<Suspense>` boundaries, and `/` and `/login` build as partially prerendered routes.

The sign-in limit is the most self-contained piece. Every attempt runs in a transaction that takes a per-IP advisory lock, so two simultaneous requests can't both slip under the limit:

```ts
export async function checkSignInRateLimit(ip: string, now: Date = new Date()): Promise<{ allowed: boolean }> {
  return tx(async (client) => {
    // Serialise attempts from the same IP so concurrent requests can't both slip under the limit.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ip]);
    await client.query("DELETE FROM login_attempts WHERE attempted_at < $1", [new Date(now.getTime() - RETENTION_MS)]);
    const { rows } = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1 AND attempted_at > $2",
      [ip, new Date(now.getTime() - SIGN_IN_WINDOW_MS)],
    );
    if (rows[0].n >= SIGN_IN_LIMIT) return { allowed: false };
    await client.query("INSERT INTO login_attempts (ip, attempted_at) VALUES ($1, $2)", [ip, now]);
    return { allowed: true };
  });
}
```

The sign-in Server Action calls it before Auth.js ever sees the password, so a refused attempt costs no bcrypt work at all.

One theme decision came from measuring rather than reading the spec. The spec's primary blue `#0780b0` with white text measures 4.45:1, just under WCAG AA's 4.5. So buttons use the palette's dark primary `#004f6e`, and the brand blue is kept for accents, focus rings and large text.

Running the suite against a real database turned up three problems the unit tests couldn't see. Every signed-in page logged that Next.js had met `crypto.getRandomValues()` while prerendering: Auth.js re-signs the session token during the render. The fix was one line in `requireSession()`, `await connection()`, which tells Next.js that this render belongs to the request. The Sign out form failed the accessibility check, because React adds a hidden input with no label to every `<form action>`; Sign out became a plain button calling the Server Action. And the local database URLs needed `sslmode=disable` and `search_path=public` before Atlas would work with the Neon proxy, which keeps its own schema in the same database.

Two browser tests were wrong rather than the code, and the author agreed to change them. Both looked for "the" alert on the page, but Next.js renders its own route announcer with `role="alert"`, so the lookup now stays inside the login form. The sign-in limit test also fired its eleven attempts without waiting for each reply; every wrong attempt shows the same message, so the check after each one passed immediately on the previous message. A probe confirmed the limiter itself: ten refusals at about 0.75 seconds each, then the eleventh, with the correct password, refused in 125 milliseconds without checking it. The final run was clean: 121 tests, typecheck, lint and build.

## Review

With every test green, the review read the code against the spec once more, looking for what tests don't catch. It found two medium problems and three small ones, and the author asked for all five to be dealt with.

The more serious one was in the database client. To use the local Neon proxy, the code switched to plain HTTP and unencrypted WebSockets whenever the database host *wasn't* Neon. That was the wrong way round for safety: a mistyped production host would quietly send credentials unencrypted instead of failing. The rule was turned into an allowlist, so only explicitly local hosts get the insecure mode:

```ts
export function usesLocalProxy(databaseUrl: string): boolean {
  const host = new URL(databaseUrl).hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host === "localtest.me" ||
    host.endsWith(".localtest.me")
  );
}
```

The second was in `create-user`: the password prompt echoed what was typed, leaving it on screen and in the terminal's scrollback. It now reads the password in raw mode without echo.

The smaller ones:
- **Session read:** the layout read the session twice per page; React's `cache()` now makes that once.
- **Staging gate:** staging deployed on every push whether or not CI passed. It now waits for a successful CI run and deploys exactly the commit CI tested.
- **Email constraint:** a lowercase-email database check broke the project's "no extra constraints" convention. The author kept it as a deliberate exception and recorded why in the spec.

The re-review found nothing new, and the author passed it. One thing remains unproven: the CI and deploy workflows have only been checked as files, since nothing has been pushed yet. They'll get their first real run when the Neon, GitHub and Vercel setup is done and the first production deploy goes out.

---

# 2. Basic CRUD (`02-basic-crud`)

## Spec

The second feature creates the full database schema and gives every resource the same plain screens: list, detail, create, edit and delete. It covers users, clients, products, product categories, types, sizes and media, orders, order items and delivery dockets. Everything that goes beyond plain CRUD is pushed to the next feature, so this one can concentrate on building the shared pieces well: a server-rendered table whose filters, sort and page live in the URL, a server-searching combobox, one form pattern shared by every resource, and one place that turns database errors into the friendly wording staff already know.

That error mapping keys on Postgres SQLSTATE codes rather than matching error text, as v1 did:

| SQLSTATE | Message |
|---|---|
| `23503` on delete | "cannot delete clients that still have orders" |
| `23502` | "please provide a <column>" |
| `22P02` | "please provide a valid integer" |

The most important decision came out of review: which fields are actually required. The legacy schema had every client column `NOT NULL`, v1's form marked none of them required, and the import was going to turn blanks into `NULL`. These rules clashed. The author settled it: only identifying fields are required (a client's name, a product type's name and code, and so on). Everything else is optional and stored as `NULL` when blank. A few rules were also tightened: an order can only sit on a docket belonging to its own client, and nobody can delete their own account or the last remaining user.

## Tasks

The spec became 71 tasks. Dependencies and UI primitives come first, then five Atlas migrations (reference data, orders and dockets, order items, trigram search indexes, display views). Next come the shared server pieces: a list-query builder that only accepts allowlisted filter and sort keys, the SQLSTATE error map, a Server Action helper and a reference-search endpoint. The shared UI follows: the data table, filter bar, pagination, combobox, form helper, confirm dialog, detail layout and print styles. Then each of the ten resources as two tasks (data layer, then pages), and finally the tests, one or more per acceptance criterion.

Review found one thing that would have stopped the tests cold. Creating a delivery docket stamps it with the sender client from the `FROM_CLIENT_ID` environment variable, but the browser tests' database had no client with that id. And the spec's check for an unset or wrong `FROM_CLIENT_ID` couldn't run in a browser at all, because a running server's environment can't change between tests. So the Playwright setup now seeds the sender client with that exact id, and the misconfiguration check moved to an integration test that sets the variable in-process; the docket logic reads it at call time to make that possible.

Three smaller changes followed. Each resource was split in two so progress is easier to check. The way Server Actions are tested directly (thin wrappers, with auth and cache mocked in Vitest) became its own task. And the "can't delete the last user" rule moved to an integration test, since a shared browser-test database always has other users.

One question went back to the author: the spec wanted the schema checked against the production MySQL dump, which hasn't arrived. Rather than wait, that check moved to the data-scripts feature, where the import mapping is built anyway; this feature builds from v1's schema files.

## Implementation

Ten resources with the same shape of screens invited one design rather than ten copies. Each resource is described twice. The client-safe half (`lib/resources/`) lists its fields, list columns, filters and default sort; the server half (`lib/db/queries/resources.ts`) lists the table or view it reads, the columns it may write, and an allowlist of SQL fragments for each filter and sort key. Generic list, detail and form pages, one pair of Server Actions and one search endpoint serve all ten, and each route is a three-line file. The few rules that differ live in one place in the actions: hashing user passwords, stamping a docket's sender from `FROM_CLIENT_ID`, and refusing an order's docket that belongs to another client.

The list query is where the allowlist matters. User input only ever reaches SQL as a parameter; identifiers and fragments come from the config, and an unknown key is an error, not a no-op:

```ts
for (const [name, raw] of Object.entries(params.filters ?? {})) {
  const f = cfg.filters[name];
  if (!f) throw new UnknownKeyError(`Unknown filter: ${name}`);
  if (raw === undefined || raw.trim() === "") continue;
  const value = raw.trim();
  values.push(f.kind === "contains" ? likeEscape(value) : value);
  where.push(condition(f, values.length));
}
```

The same zod schema validates on the client (on blur) and again in the Server Action, and it's built from the field list, so the two can't drift apart.

The browser tests found more in the testing than in the app, and two of those lessons are worth keeping. Next.js 16 with Cache Components keeps the page you just left mounted but hidden, so a label lookup on an edit page also found the hidden list's filter box with the same label. The fix, straight from the Next.js guide, was visibility-aware selectors. And because forms stream in behind a static shell, a test that blurs a field the instant the page loads can beat hydration, so the test retries until the form is live. The one real app bug was small: the asterisk marking a required field sat inside its label, so "Name" was announced as "Name *". It now sits outside, with `aria-required` on the field. The final run: 220 unit and integration tests and 80 browser tests, all green.

One loose end surfaced along the way: Atlas made `migrate lint` a paid feature, and CI still calls it.

## Review

The review checked its suspicions against the running app instead of the code alone, and three medium problems held up.
- **Bad URL filters:** a mistyped date or id in a list's URL crashed the page, because the value reached Postgres as a typed parameter.
- **Duplicate ids:** because Next.js keeps visited pages mounted, two forms could both contain an input with the id `name`, and a label could end up pointing at the hidden one.
- **Keyboard access:** rows opened their detail page only on a mouse click.

All three were fixed. Filter values are now checked against their type and ignored if they don't fit. Form, filter and paging controls take their ids from React's `useId()`. And each row's own name cell is a real link. Two smaller fixes rode along: integers are capped at the database's range, and changing an order's client clears its docket. On the author's decision, CI also stopped calling `atlas migrate lint`, which had become a paid Atlas feature.

Re-running the suite then exposed a bug from the first feature. Sign-out sometimes didn't stick. Spec 01 chose rolling JWT sessions, so every request through `proxy.ts` re-issues the session cookie, and spec 02 had just switched on eleven sidebar links that Next.js prefetches in the background. A prefetch still in flight at the moment of sign-out came back afterwards and put a valid cookie back in place. Turning prefetching off for the sidebar made the failing test pass eight times out of eight, which confirmed the cause.

The obvious cure, database sessions, isn't available: Auth.js refuses them for email-and-password sign-in. So the JWT gained a session version. Each user row carries a counter, the token records it at sign-in, and every request compares the two. Sign-out and a password change bump the counter, so any older cookie, however it comes back, is dead:

```ts
export async function checkSessionVersion<T extends { sub?: string | null; sv?: unknown }>(
  token: T,
  lookup: (userId: string) => Promise<number | null>,
): Promise<T | null> {
  if (!token.sub) return null;
  let current: number | null;
  try {
    current = await lookup(token.sub);
  } catch (err) {
    console.error("Session version lookup failed; keeping the session for this request", err);
    return token;
  }
  if (current === null || current !== token.sv) return null;
  return token;
}
```

The `try` came from the second review round. A failed lookup at first counted as a bad token and signed the user out, which would have logged everyone out during a database hiccup. The author accepted that signing out now ends a user's sessions on every device. A new test replays a cookie captured before sign-out and expects it to be refused. The final review passed with 239 unit and integration tests and 85 browser tests green.

---

# 3. Seed dummy data (`03-seed-dummy`)

## Spec

This feature started life as one bullet in the data-scripts spec. Once the CRUD screens were working and staging was deployed, an empty database became the obvious problem: the custom behaviour in the next feature (category-driven columns, stage toggles, docket printing) is hard to build or show to staff without realistic data. So `seed-dummy` was pulled out into its own feature and moved ahead of custom behaviour. The two later specs were renumbered to match: custom behaviour became `04` and data scripts became `05`.

```
npm run seed:dummy -- --target local
npm run seed:dummy -- --target staging     # asks you to type "staging"
```

The script wipes every app table except `users` and `login_attempts` and fills them with a deterministic synthetic dataset. "Deterministic" took some care:
- **A seeded random generator** (`--seed`, default `1`), so the same seed always gives the same rows.
- **A fixed anchor date** (2026-01-01) for every date column, because `orders.date` and `delivery_dockets.date` default to `current_date`, which would make two runs on different days differ.
- **Explicit client ids.** Docket creation needs a sender client with the id in `FROM_CLIENT_ID`. If the dummy clients took ids from the sequence, one of them could grab that id first. So the dataset assigns every client id itself, skipping the sender's.

Order and order-item ids are the exception. Their sequences are never reset, because `seed-old` will later set them above production's highest ids, and the notcher software must never see an id twice. Postgres made that split awkward: it won't truncate `clients` without truncating every table that references it in the same statement, and `RESTART IDENTITY` applies to all of them. The answer is a single `TRUNCATE … CONTINUE IDENTITY`, then `ALTER SEQUENCE … RESTART` for just the reference tables and dockets.

Most of the review went into the guard. The script refuses `--target production` outright. It also refuses any database whose host matches `PRODUCTION_DB_HOST`, and with `--target local` it only accepts `localhost`, `127.0.0.1` or `db.localtest.me`, so a Neon URL left over in the shell can't be wiped by mistake. Staging needs `FROM_CLIENT_ID` set to Vercel Preview's value and a typed confirmation. The guard lives in `scripts/lib/target-guard.ts`, and `seed-old` will reuse it. v1's category names and column flags go into `lib/data/v1-categories.ts` for the same reason, so seeded and real data show the same columns per category.

Testing a script whose job is to empty the database needed its own arrangement. The integration tests share one Postgres and run in parallel, so these tests create, migrate and drop a throwaway database of their own. The guard tests point the script at `seed-guard.invalid`, a host that can never resolve: a refusal shows up as the guard's message, and any attempt to connect would show up as a connection error instead.

## Tasks

The spec became 22 tasks, with the dataset split into seven sub-tasks. Two shared pieces come first: v1's category list and the target guard, both of which `seed-old` will reuse. Then `seed-dummy` itself, split the way the tests need it: a pure `buildDataset(seed, fromClientId)`, a `seedDummy(client, dataset)` that writes one transaction, and a thin CLI around them. A helper creates, migrates and force-drops a throwaway database for the tests, and the tests follow, one or more per acceptance criterion.

Review caught a quiet flaw in the guard tests. The script reads `.env`, and Node's `loadEnvFile` fills in any variable that isn't already set. So a test that "leaves out" `FROM_CLIENT_ID` gets `1` back from the developer's `.env`, and a case missing two requirements fails on whichever rule runs first. Both still pass, without testing the rule they name. The fix has three parts: an empty value counts as unset, every case gets a complete environment with only its own rule broken and checks that rule's message, and `.env` is now read only for `--target local`. That last part also means a stale local `.env` can never mix into a staging run.

## Implementation

The script has three layers, and the tests reach each one directly. `buildDataset(seed, fromClientId)` is pure: it returns every row the database will hold, ids included, so determinism and the dummy-only rules are checked without a database. `seedDummy(client, dataset)` writes that dataset in one transaction. The CLI around them only parses arguments, runs the guard, asks for confirmation and prints a row count per table.

The dataset is small but deliberately awkward: 37 clients, v1's 8 categories plus "Dummy All Columns" and "Dummy No Columns", 72 products, 24 dockets, 72 orders and 360 order items. Fixed rows cover the edge cases the screens have to handle: every boolean both ways, zero dimensions, non-ASCII names and a `/` in a part number, and the four combinations that decide whether the notcher feed shows an item. Everything else comes from a small seeded generator (mulberry32), so `--seed 2` gives a different but equally repeatable database.

Giving the reference tables and dockets explicit ids as well as the clients turned out simpler than resolving generated ids. Products can point at category 3 directly. The rollback test (AC-5) can insert an order item with a product that doesn't exist and check that nothing was written. Explicit ids leave the sequences behind, so after each table the script sets its sequence one past the highest id:

```ts
// One statement: Postgres won't truncate a table referenced by one left out.
await c.query(`TRUNCATE ${WIPED.join(", ")} CONTINUE IDENTITY`);

// Explicit ids from 1; the next generated id is one past the highest (1 for an empty table).
for (const t of EXPLICIT_IDS) {
  await insertRows(c, t, dataset[t], true); // OVERRIDING SYSTEM VALUE, 500 rows per statement
  await c.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT coalesce(max(id), 0) + 1 FROM ${t}), false)`);
}
```

Orders and order items are the exception, as the spec required: they take ids from sequences that are never reset, and items find their order by position in the dataset.

The tests passed the first time. The full run did not. Four CRUD browser tests from the previous feature timed out, and a different four on each re-run. The Playwright trace showed nothing hanging, just every request taking one to three seconds. Timing a bare `select 1` found the cause: about 1 ms straight to Postgres, about 210 ms through the local Neon-compatible proxy. The proxy re-authenticated and opened a new connection for every query, and each page makes several queries, while the sidebar's link prefetches competed for the same proxy. The author had asked for local connections to be direct, but the earlier change had only covered `next dev`. So now every local database (dev, tests, Playwright, CI) gets node-postgres, and the proxy was removed from Docker Compose and CI. The CRUD round trips dropped from 22–31 s to 6–13 s, and the browser suite from 12 minutes to 5.5. The trade-off is that the Neon driver itself is now exercised only on staging and production. The final run had 167 unit, 125 integration and 85 browser tests, all green.

## Review

The review ran the script for real against a throwaway database, then went looking for ways the guard could be fooled. It found one. Neon gives every branch two hostnames: a direct one, `ep-x.…neon.tech`, and a pooled one, `ep-x-pooler.…neon.tech`. Vercel's `DATABASE_URL` is the pooled form, so that's the easy one to copy into `PRODUCTION_DB_HOST`. The guard compared hosts exactly. So if `DATABASE_URL_UNPOOLED` pointed at production's direct host by mistake, `--target staging` went straight through, and the operator would have typed "staging" to confirm wiping production. A probe confirmed it. The fix compares endpoints rather than names:

```ts
export function endpointHost(host: string): string {
  const [first, ...rest] = host.toLowerCase().split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}
```

The shared guard means `seed-old` inherits it.

The rest was smaller. Arguments went through Node's strict `parseArgs`, so a typo like `--sead 5` is now an error instead of a silent seed 1, and bad values print one line instead of a stack trace. A `ROLLBACK` that fails on a dropped connection no longer hides the error that caused it. Sequences are set to one past the highest id, so an empty table starts at 1, not 2. Inserts go in batches of 500 rows. The spec was also brought in line with the code, which gives the reference tables and dockets explicit ids, not just the clients. The final review passed with 189 unit, 132 integration and 85 browser tests green. One step stays open, because it can't be automated: an operator seeding staging (AC-11).

---

# 4. Custom behaviour (`04-custom-behaviour`)

## Spec

This is where FIB OM stops being a generic admin panel. The order-items list changes its columns depending on the product category picked, driven by about forty `show_*` flags on each category. Production stages can be toggled straight from the list, with the change shown instantly and saved in the background. Orders show their items in a panel that sends you back to the order after an edit. Delivery dockets print as a proper docket, with orders added to and removed from them on screen. Pleat counts and wire lengths are calculated by plain Postgres views ported from v1's `views.sql`.

Then there's the notcher feed, the one part of the system with a frozen contract:

```
GET {origin}/vw-notcher-api?key=<api key>
```

The notcher software can't be updated, so the new feed must return what production returns today. Reading the PHP controller and its Doctrine entities set the rules:
- **Which items:** only items in New orders whose frame stage isn't done and whose product is marked for notching.
- **Format:** keys in PHP's entity property order, with `/` escaped as `\/` and non-ASCII escaped as `\uXXXX`, exactly as PHP's `json_encode` does.
- **Dates:** `d M`, e.g. `07 Jan`.

Review found the details that would quietly break a byte-for-byte match:
- **Integers:** the database driver returns `bigint` values as strings, so they must be turned back into numbers.
- **Blank text:** production sends blank text as `""`, never `null`.
- **Missing fields:** fields the new schema dropped, like prices and markup, still have to appear in the output, as `null`.

The final check against real production output moved to the data-scripts feature, because it needs a production dump. This feature keeps a golden-file test built on synthetic data.

---

# 5. Data scripts (`05-data-scripts`)

## Spec

The last feature gets real data into the new system and plans the switchover. Three scripts run from a trusted operator machine, never from CI, because the data includes client details and order history:
- **`snapshot.sh`** dumps production MySQL and captures the live notcher feed in the same minute.
- **`seed-old`** loads clients and the product catalogue from that snapshot. It keeps their ids, cleans the data, applies v1's category renames and column flags, and verifies the result with checksums.
- **`seed-dummy`** fills a local or staging database with synthetic data.

Several safeguards protect production. `seed-old` keeps the new order and order-item id counters above production's highest ids, so the notcher never sees an id twice. The scripts compare their target host against a known production host, so a mislabelled target can't be wiped. Snapshots stay on an encrypted disk and are deleted after cutover.

The cutover plan changed with the discovery that production is PHP on MySQL. The final archive is a `mysqldump`. The old site stays reachable at `old.fibatron.com` for 30 days. `fibatron.com` itself keeps pointing at the PHP app until staging has been tested thoroughly. Review also removed the one step that would have written to production: a test order created to confirm one JSON field. The notcher machine ignores docket data, and a live test job could have been processed on the factory floor, so the step wasn't worth that risk.

---

# 6. Order items redesign (`06-order-items-design`)

## Spec

With the CRUD screens working, the author mocked up how the app should actually look in Claude Design: a single "Order Items" screen. It used IBM Plex type, a quiet teal-and-grey palette, a light sidebar that collapses to icons, status tabs with counts, and an edit panel that slides in on the right when a row is clicked. This feature turns that mock-up into the real app. It comes before custom behaviour, so the category columns and stage toggles of feature 4 can land on top of the new list rather than being restyled afterwards.

The first decision was how literally to read the design. It looked like a field specification: five item statuses (New, In production, Ready, Dispatched, Archived), a "Due: Next 30 days" filter, a panel with six fields. None of that matched the data. Status lives on the order, not the item, and has three values. An item has seven yes/no production stages and twenty-odd fields. The first draft of the spec tried to honour the design by *deriving* the five statuses from the order status, docket link and stages. Going through the review one item at a time, the author settled it the other way: **the design is a visual reference, not a data spec.** The tabs became the real order statuses:

```
All (n) · New (n) · Complete (n) · Archived (n)      ?status=new|complete|archived
```

The panel holds every field of the item form, the Due filter stays an ordinary From/To range, and the design's status chips set only the chip style. Those chips are editable, and because status and due date belong to the order, the panel says so: "Due date and status apply to all N items on order X".

Review caught two real problems. The draft put the panel's "line 2" and item count into `order_items_v` as window functions. Postgres can't push a list's filters below a window function, so every list query would have numbered the whole table first. Both moved into the panel's single-item query as correlated counts, and the view needed no change at all. The second problem was the Save action, which reused the generic item schema. Once Order became editable in the panel, the spec had to say which order's due date changes when an item moves. The answer: update the item first, then read its order id back from the saved row, so a moved item only ever changes its new order.

The rest is restyling, done mostly through the shared list components, so every page changes at once. The design's palette maps onto the existing shadcn variables. Three of its greys fail WCAG AA for small text (`#7d878b` on the table header is 3.55:1), so they become `#697175`, the closest same-hue shade that passes. That's the one deliberate departure from the design. Fonts come through `next/font`, so nothing is fetched from Google at runtime. The sidebar's collapse state lives in a cookie read inside a Suspense boundary, and the fallback renders the same layout by media query, so the static shell survives Cache Components and the sidebar never changes width while the page loads. The design shows a name in the sidebar, but users only had an email, so a nullable `users.name` column was added, with the email as the fallback. Relative due dates ("2d overdue", "in 3d") are computed in SQL against `Australia/Brisbane`, which has no daylight saving.

## Tasks

The spec became about fifty tasks in eight groups, ordered so each step stands on the one before. The theme comes first, because every later screen is styled against its tokens. The `users.name` migration comes next, ahead of the shell, because the new sidebar footer reads it. Then the shell itself, and then the shared list pieces (`PageHeader`, `FilterBar`, `DataTable`, `Pagination`). Restyling those restyles every list in the app at once. Only then does Order Items get its own page, built from those shared pieces plus status tabs, a Due cell and a status pill, and finally the edit panel and its Save action. The tests come last, grouped by layer: unit tests for the pure helpers (`relativeDue`, the palette's contrast pairs), integration tests for the queries and the transaction, and Playwright for the screens.

Review caught one real problem, a security one. The first draft put the panel's single-item query in the same module as the two Server Actions the browser calls when Product or Order changes. In Next.js, a `"use server"` file turns *every* export into a public endpoint, so the page's query, which has no session check of its own, would have become one too. The fix splits the module in two:

```
lib/order-items/panel-queries.ts   import "server-only"   getOrderItemPanel (page only)
lib/order-items/panel-actions.ts   "use server"           getProductPanelInfo, getOrderPanelInfo (each requireSession())
```

A test makes sure the query file never gains the directive. The other fixes were smaller. The `due_in_days` test now compares against today in Brisbane computed with `Intl`, because Postgres can't fake `now()`. A deep link to an item outside the current tab gets its own e2e step. And the `statusTabs` flag, which switches the list's status filtering and counts on for Order Items only, finally got a task that adds it to the `ResourceUi` type.

## Implementation

The build went in the order of the task list, with tests first. Almost all of the restyle happens in two places. `app/globals.css` maps the design's colours onto the shadcn variables every component already reads, plus a handful of new tokens (`--surface`, `--row-selected`, `--subtle-foreground` and friends). The shared list components (`PageHeader`, `FilterBar`, `DataTable`, `Pagination`) were then restyled once, so every list page changed together. `DataTable` grew a few optional props: `onRowOpen`, `selectedId`, `renderCell`, `optionalColumns`. Order Items uses them to open the panel instead of the detail page, while every other list keeps its old behaviour.

The panel's Save action is the heart of the feature, and it does exactly what review settled on. The item fields go through the existing allowlisted writer. The order fields never reach it. The order that gets updated is read back from the item row after the write:

```ts
const result = await tx(async (client) => {
  if (!(await updateRecord("order_items", String(id), data, client))) return null;
  // The order the item belongs to after the update, read back from the item row.
  const { rows } = await client.query(
    `SELECT o.id, o.due_date::text AS due_date, o.status::text AS status
       FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.id = $1 FOR UPDATE OF o`,
    [String(id)],
  );
  const current = rows[0] as { id: string; due_date: string; status: string };
  if (current.due_date !== order.due_date || current.status !== order.status) {
    await client.query("UPDATE orders SET due_date = $1, status = $2::order_status WHERE id = $3", [order.due_date, order.status, current.id]);
  }
  return order.status;
});
```

The most instructive bug was in the sidebar. The collapse cookie never seemed to be read, even though the server clearly received it. The cause: `SIDEBAR_COOKIE` was exported from the sidebar's `"use client"` module, so the server component that imported it got a client-reference proxy instead of the string `"sidebar"`, and `cookies().get(proxy)` never matches. Moving the constant into a plain `sidebar-state.ts` fixed it. A second sidebar problem showed up in the e2e run: with a cookie set, the Suspense fallback still painted at the default width, so the sidebar visibly jumped as the streamed version arrived. A six-line inline script in `<head>` now copies the cookie onto `<html data-sidebar>` before first paint, and the CSS sizes the fallback from it. The shell stays static, and the first paint is right whether or not there's a cookie.

The tests found smaller things too. The panel's status chips used `sr-only` radios that couldn't be clicked. A done stage hidden by its category vanished the moment it was unticked, instead of staying listed until saved. Typing into the panel before hydration lost the value, so the panel's controls now stay disabled until React has hydrated. One conflict went back to the author: white on the design's avatar orange fails the contrast check the spec itself requires, so the avatar became `#b06223`, the second deliberate departure from the design's colours. The suite finished at 232 unit, 165 integration and 121 end-to-end tests, all passing, on the third run.

## Review

Review checked the diff against all 27 acceptance criteria and found every one met, with no high or critical issues. It did find three smaller problems, all of which the author agreed with.

The most interesting one is in the Save code shown above. The panel always sends the order's due date and status as they were when it opened, and the server writes them whenever they differ from what's stored. That is exactly the rule the spec set, but the spec never asked what happens when the panel is out of date. If a colleague moves the order's due date while you have an item open, and you then save a new quantity, your save quietly puts the old date back on every item of that order. The fix is to send the order fields only when you've actually changed them. The other two were about polish. Closing the panel replaced the history entry that opening it had pushed, so the first Back after closing appeared to do nothing. And on screens narrower than 1024px the server draws the desktop side panel, which only becomes a sheet once the page's scripts start, so the list is briefly squeezed.

The author passed the review without a revision round, so the feature ships as built in phase 3, and the three fixes are written up as follow-ups in the review log. That puts the stale-save fix on spec 04's plate, since spec 04 builds on this list and panel next.

# 7. Panels on every list (`07-list-panels`)

## Spec

Spec 06 gave Order Items the design's way of working: tabs across the top, coloured pills, and a click on any row opening an edit panel beside the list. Every other list got the new look but kept the old routine of clicking through to a detail page and then to an edit page. Once the author had used the Order Items panel, the other lists felt slow by comparison, so spec 07 brings the same behaviour to all nine of them.

Most of it is a matter of generalising. The Order Items panel mixed two kinds of code: the mechanics every panel needs (the frame, the sheet on small screens, Escape, "Discard changes?", where focus goes), and the item-specific parts (its order caption, stage chips and the order's due date). The spec splits those apart. A shared `PanelShell` owns the mechanics, and a generic `RecordPanel` fills it with any resource's form fields, using the same field controls and save action as the edit page. Orders and Delivery Dockets get status tabs (their only status-bearing lists), and the status-tab plumbing stops assuming the column is called `order_status`.

The spec also takes in the three follow-ups from 06's review, since they now apply to every panel rather than one. A stale Order Items panel no longer writes back an order's old due date. Closing a panel no longer leaves a dead entry in browser history. And narrow screens no longer flash a side panel before the sheet appears.

Review found two real gaps. The fix for the history entry closes a panel by going *back*, and Next's back navigation re-shows a cached copy of the list, so after a save the row could still show the old value; the spec now reloads the list's data after a save. And the rule for which cell opens the panel ("the first column that doesn't link elsewhere") turned out to pick the Category column on Products and an empty Name on unnamed Users. Each resource now names its `titleField` outright. Four smaller points were tightened the same way, and the author kept the spec's own calls: no Delete in panels, the docket "Current" pill in the same blue as "New", and `?item=` as the URL key everywhere.

## Tasks

The checklist runs bottom-up in seven groups: config and data first (`titleField`, the `statusTabs` object, a server-side `statusColumn` allowlist, `due_in_days` on orders, the Current pill colour), then the shared list pieces (generic tabs and pills, the history helper, the table's title-cell link), then the shared panel parts lifted out of the Order Items panel. Only once those exist does Order Items move onto them, and only then does the generic `RecordPanel` and the extended `ResourceListPage` bring panels to the other nine lists. Tests come last as their own group, with one e2e test per acceptance criterion and a separate set for the three 06 fixes.

Review caught a case the spec had missed: clicking a second row while a panel is open. Each click pushed a history entry, so closing the second panel went back to the first one, and the first panel's clean-up wiped the second one's "opened from the list" marker. The fix is a single `openPanel` helper used by every opener: with a panel already open it replaces the URL instead of pushing, and hands the marker on. Review also replaced an e2e test that would have forged a Server Action request with one that provokes the same refusal for real, by moving the chosen docket to another client in the database just before saving.

## Implementation

The build followed the checklist from the bottom up. The status tabs stopped being an Order Items special case first: `statusTabs` became `{ key, options }` in the client-safe config, and a matching `statusColumn` (column plus Postgres enum type) went into the server-side query config, so the cast in the SQL still comes only from code. `listRecords` and `countByStatus` read both, and Orders and Delivery Dockets got their tabs without any new query code.

The Order Items panel was then taken apart. Its frame (side panel or sheet, the hydration guard, focus, Escape, "Discard changes?", the footer) became `PanelShell`, and its collapsible sections, error handling, status chips and "Moved to …" toast became small shared pieces. A new `RecordPanel` puts any resource's edit-form fields inside the same shell, using the same `FieldControl` and `saveRecord` as the edit page, so the Users password rule, the docket-belongs-to-client rule and Orders' client-scoped docket picker all came along for free. The Order Items panel itself shrank to its item-specific content.

The trickiest part was fix 2, Back after closing, and it lives in one small module:

```ts
export function openPanel(router: PanelRouter, href: string): void {
  const panelOpen = new URLSearchParams(window.location.search).has("item");
  if (!panelOpen) {
    write(href);
    router.push(href, { scroll: false });
    return;
  }
  const marked = read() === normalise(currentUrl());
  write(marked ? href : null);
  router.replace(href, { scroll: false });
}
```

Opening from the list pushes one history entry and remembers it; switching rows replaces instead, handing the marker on; closing goes back only when the marker matches the current URL. After a save the list must also reload, because Back restores a cached copy from before the save, so `closePanel` waits for the `popstate` before calling `router.refresh()`. Fix 1 was smaller: the Order Items panel now drops the order's Due and Status from what it sends unless the user changed them, and the server leaves the order alone when they're missing. Fix 3 is a single `max-lg:hidden` on the server-rendered side panel.

The test runs found nothing wrong in the app, only in the new tests: a heading locator that also caught the sheet's hidden screen-reader title, a script-blocking route that blocked the stylesheets too (Next serves both from the same folder), and two tests that read table headers before the table had rendered. The suite finished at 434 unit and integration tests and 171 end-to-end tests, all passing.

## Review

Review found the feature doing what the spec asked, with every acceptance criterion met and nothing serious. It did turn up two small problems, both in edge cases the tests hadn't reached. The first came from a Next.js behaviour this project had already met in its form tests: recently visited pages stay mounted but hidden. When a panel closed, focus went to the first link in the page with that record's id, and a hidden Orders list could hold one with the same id as the client you were editing, so keyboard focus vanished. The fix picks the first *visible* link, and a new test builds exactly that situation, with a client and an order sharing an id. The second was a consequence of the stale-write fix: since the order's Due and Status became optional, a direct call sending only one of them was quietly ignored. It is now a field error. A duplicated id check was merged into one helper while the code was open.

The author failed the first review so the fixes could go through a revision round, then passed the re-review. With that, the panels that began as a single Order Items feature in chapter 6 now work the same way on every list in the app.
