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
