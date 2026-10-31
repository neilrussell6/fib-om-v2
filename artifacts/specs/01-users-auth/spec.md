# Spec — 01-users-auth

- Date: 20261031-140121
- Feature: 01-users-auth
- Phase: 1 (Spec)

> Part 1 of 4 of the FIB OM migration. Read with the overview
> [`artifacts/docs/nextjs-vercel-neon-migration.md`](../../docs/nextjs-vercel-neon-migration.md)
> (sections O1–O9). Next: `02-basic-crud`.

## Summary

Stand up the new app and everything around it: the Next.js project, theme, database client, Atlas migrations, CI and the deploy pipeline, then the first piece of real behaviour, which is signing in. Staff can log in with email and password, land on an (empty) Dashboard inside the app shell, and sign out. Every route except the login page, static assets and the notcher feed path requires a session. The first user is created with a script; the Users admin screen comes in `02-basic-crud`.

## User-visible behaviour

### Login and sessions
- An email/password login page at `/login`, on the background image from `web3/src/assets/bg.jpg` (copied into `public/`), titled "Fibatron". (Using the logo `fibatron_logo128x128.png` on the login card is optional.)
- A failed login shows one generic message, "Email or password is incorrect" **(improvement: no account enumeration)**.
- **Sign-in attempts are rate-limited in the app** (the project is on Vercel Hobby, so no Firewall rule): at most 10 sign-in attempts per minute per IP. The 11th attempt within the window is refused without checking the password and shows "Too many sign-in attempts. Try again in a minute." Only sign-in attempts count; normal page use, session checks and sign-out are never limited.
- Every route needs a session except `/login`, static assets and `/vw-notcher-api` (protected by its own `key` in `03-custom-behaviour`).
- An unauthenticated or expired session sends the user to `/login?callbackUrl=<current path>`, and after signing in they go back there **(improvement: web3 always drops you at the default page)**. Only internal paths are honoured; anything else falls back to `/`.
- Sessions are a JWT cookie with an 8-hour rolling lifetime (web3: fixed 1 hour).
- A sign-out action sits in the top bar, showing the signed-in email **(improvement: web3 shows no identity)**.

### App shell
- A sidebar and a top bar around every authenticated page.
- **Sidebar order (final):** Dashboard, Orders, Order Items, Delivery Dockets, Clients, Product Categories, Product Media, Products, Product Sizes, Product Types, Users. Each has an icon (lucide equivalents of the current MUI icons) and the active item is highlighted. In this feature only **Dashboard** exists, so only Dashboard is shown; each later feature adds its entries in that order.
- On narrow screens the sidebar collapses into a sheet **(improvement)**.
- The browser title is "Fibatron". Page headings follow `<Resource plural>`, `<Resource>`, `Edit <Resource>`, `Create a <Resource>` (used from `02-basic-crud` on).

### Dashboard
- `/` is the Dashboard: the page heading "Dashboard" and no other content for now. It replaces web3's redirect to `/orders`.

### Theme
- The web3 palette as shadcn CSS variables:
  - primary `#0780b0` (light `#11b0f1`, dark `#004f6e`)
  - secondary `#2c2c2c`
  - body text `#676767` (muted `#919191`)
  - app frame and sidebar `#8e989b`
  - active menu item `#284e5d` with white text and icon
  - content area white
- The system font stack.
- **(improvement)** A fixed rem type scale; web3 scales the base font with the viewport (`calc(10px + 1vmin)`).
- **(improvement)** Text and button colours meet WCAG AA contrast. `#919191` on white does not, so it is used only for large or decorative text.
- Light mode is required; dark mode is out of scope.

### Accessibility (improvement)
- Every control has a label; keyboard navigation works in the sidebar, sheet and login form.

## Design

- **Project:** Next.js 16 App Router, TypeScript, Turbopack, Tailwind v4, shadcn/ui, Node 24 (matches `.tool-versions`). Layout as in overview O4.1 (paths marked `[01]`).
- **DB access:** `lib/db/index.ts` exports the `neon()` tagged-template `sql`, a `Pool`, and `tx(async (client) => …)`. Conventions in O5.
- **Migrations:** Atlas, `atlas.hcl`, `scripts/db.sh` and the `db:*` npm scripts, exactly as O7.2. Postgres 17 (Neon and the `atlas.hcl` dev image). This feature's migrations create `login_attempts` (above) and `users`: `id` (identity), `email` (`NOT NULL`, unique, stored lowercased), `password_hash` (`NOT NULL`, bcrypt), `created_at`. (A unique email is needed for login, so it is not one of the rejected "new data rules".)
- **Auth:** Auth.js (NextAuth v5) Credentials provider in `lib/auth.ts`; sign-in is a Server Action on `/login`. The typed email is trimmed and lowercased before lookup. Passwords are checked with `bcryptjs.compare`; for an unknown email the password is compared against a fixed dummy bcrypt hash so both failure cases take the same time. Session strategy `jwt` with `maxAge` 8h and `updateAge` 15 minutes, so activity extends the session; signed with `AUTH_SECRET`.
- **Sign-in rate limit:** a `login_attempts` table (`ip`, `attempted_at`, index on `(ip, attempted_at)`). The sign-in Server Action records each attempt and refuses when the IP has 10 or more attempts in the last 60 seconds. The client IP is read from Vercel's `x-real-ip` header (falling back to the first `x-forwarded-for` entry). Rows older than one hour are deleted opportunistically on each attempt.
- **Route protection:** `proxy.ts` redirects unauthenticated requests to `/login?callbackUrl=…`. Its `matcher` excludes `/login`, `/api/auth/*`, Next static assets, public files and `/vw-notcher-api`. Pages and Server Actions also check the session on the server (defence in depth).
- **`callbackUrl` safety:** accepted only if it starts with a single `/` (not `//`, not a scheme).
- **`scripts/create-user.ts`:** `create-user <email>`; reads the password from a prompt or `CREATE_USER_PASSWORD`, never from argv; rejects passwords shorter than 12 characters (no other rules); hashes with bcrypt (cost ≥ 10); fails if the email already exists. The password rule lives in a shared zod schema so the Users screen (spec 02) uses the same one.
- **CI / deploy:** `ci.yml` and `deploy.yml` as O7.3. `ci.yml` also runs gitleaks over the repo, and runs `atlas migrate lint` with Docker available for the dev database (`docker://postgres/17/dev`). The staging domain comes from the GitHub repo variable `STAGING_DOMAIN` (`staging.fibatron.com`). The first deploy is a manual production run so the staging guard passes.
- **Vercel plan:** Hobby (author decision). No Firewall rules are relied on.
- **Config:** `.env.tpl` lists `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NOTCHER_API_KEY`, `FROM_CLIENT_ID` with no values. It also lists, commented out, the operator-only variables used by spec 04's data scripts (`SOURCE_MYSQL_URL`, `SCRATCH_MYSQL_URL`, `PRODUCTION_DB_HOST`), with a note that they are set only on the trusted machine. `.vercelignore` as O7.4. GitHub/Vercel/Neon configuration as O7.4.
- **Security:** rotate the legacy hardcoded DigitalOcean DB password (O8).

## Acceptance criteria

Automated (unit, integration against Postgres with migrations applied, or Playwright):

1. **AC-1** `npm run build` succeeds, and `npm run typecheck` and `npm run lint` exit 0.
2. **AC-2** An unauthenticated request to `/` redirects to `/login?callbackUrl=%2F`.
3. **AC-3** Logging in with a valid email and password (user created by `create-user`) lands on `/`, which shows the heading "Dashboard" inside the app shell.
4. **AC-4** Logging in from `/login?callbackUrl=/some/internal/path` lands on `/some/internal/path`; `callbackUrl` values `https://evil.example`, `//evil.example` and `javascript:alert(1)` land on `/` instead.
5. **AC-5** A wrong password for an existing email, and any password for an unknown email, both show exactly "Email or password is incorrect"; both paths call bcrypt compare (unit test with a spy), so their timing doesn't reveal whether the email exists. Logging in with the email in different case (e.g. `Staff@Example.com`) works.
6. **AC-6** The session is a JWT cookie (no sessions table exists); `updateAge` is 15 minutes; a session idle for more than 8 hours is rejected, and a request more than 15 minutes after the last refresh (within 8 hours) extends the expiry.
7. **AC-7** The top bar shows the signed-in user's email; Sign out ends the session, and the next request to `/` redirects to `/login`.
8. **AC-8** `/login`, `/api/auth/*`, static assets and `/vw-notcher-api` are not redirected by `proxy.ts` for an unauthenticated request; every other path is.
9. **AC-9** The sidebar shows Dashboard with an icon, marked `aria-current="page"` on `/`; the sidebar component renders entries in the final order given above when given the full list (unit test).
10. **AC-10** At a viewport narrower than the `md` breakpoint the sidebar is hidden and opens as a sheet from a labelled menu button; the sheet is keyboard operable and closes with Escape.
11. **AC-11** The document `<title>` contains "Fibatron".
12. **AC-12** The theme defines the palette above as CSS variables; the root font size is a fixed rem value that is the same at 375px and 1920px viewport widths.
13. **AC-13** An automated contrast check passes WCAG AA for body text, muted text used at body size (must not use `#919191`), and primary/secondary buttons; an axe scan of `/login` and `/` reports no critical violations.
14. **AC-14** `scripts/create-user.ts` creates a user whose password is stored as a bcrypt hash (never plaintext) and who can log in; running it again with the same email fails without changing the user; an 11-character password is rejected and a 12-character one accepted; the password is not accepted as a command-line argument.
15. **AC-15** The `users` migration is an Atlas versioned migration; `npm run db:validate` passes; `db:migrate`, `db:status`, `db:new` and `db:hash` exist and call Atlas through `scripts/db.sh` with `--revisions-schema public`.
16. **AC-16** `ci.yml` runs install, typecheck, lint, unit tests, gitleaks, `atlas migrate validate`, `atlas migrate lint --latest 1` (with Docker for the dev database), then integration tests against a Postgres service container after `atlas migrate apply`; a failing step fails the run.
17. **AC-17** `deploy.yml`: on push to `main` it fails if no production deployment exists, applies migrations over `DATABASE_URL_UNPOOLED` with `revisions-schema: public` before `vercel build`/`vercel deploy --prebuilt`, stops if migrations fail, and aliases to the domain in the `STAGING_DOMAIN` repo variable via the Vercel API; on `workflow_dispatch` it does the same for production with `--prod`.
18. **AC-18** No secret is committed (gitleaks passes in CI); `.env.tpl` lists the five variables above without values, plus the three operator-only variables commented out; `.vercelignore` excludes `.claude`, `.cursor` and test output.

19. **AC-19** From one IP, 10 sign-in attempts within a minute are each processed normally; the 11th is refused with "Too many sign-in attempts. Try again in a minute." and the password is not checked; after 60 seconds attempts are accepted again; page loads, `/api/auth/session` and sign-out are never refused by the limiter.

Operational (recorded check, not CI):

20. **AC-20** The first manual production deploy has run, and a subsequent push to `main` deploys to `staging.fibatron.com`.
21. **AC-21** Vercel Git auto-deploys are off; Production and Preview each have `DATABASE_URL`, `AUTH_SECRET` (distinct values), `NOTCHER_API_KEY` and `FROM_CLIENT_ID`, marked Sensitive.
22. **AC-22** The legacy DigitalOcean DB password hardcoded in `packages/notcher-api/src/index.js` has been rotated (recorded confirmation).

## Out of scope

- The Users admin screen and every other resource screen (`02-basic-crud`).
- The notcher feed itself (`03-custom-behaviour`); this feature only keeps its path free of auth redirects.
- Dashboard content beyond the heading.
- Migrating legacy users or their password hashes (accounts are recreated).
- Password reset by email, self sign-up, roles or permissions.
- Dark mode.

## Open questions

1. ~~**OQ-1 Sign-in limit**~~ — resolved 2026-10-31: 10 sign-in attempts per minute per IP, enforced in the app (Vercel Hobby).
2. ~~**OQ-2 Password policy**~~ — resolved 2026-10-31: minimum 12 characters, no other rules (applies to `create-user` and the Users screen in spec 02).
