# Tasks — 01-users-auth

- Date: 20261031-170900
- Feature: 01-users-auth
- Phase: 2 (Tasks)

Built from `artifacts/specs/01-users-auth/spec.md` and the overview `artifacts/docs/nextjs-vercel-neon-migration.md` (O4.1, O5, O7). References in brackets point at the spec's acceptance criteria (AC n) or Design bullets.

## Tasks

### Project scaffold

- [ ] Create the Next.js 16 App Router project with TypeScript, Turbopack, Tailwind v4 and ESLint, on Node 24 (matching `.tool-versions`): scaffold it in a temporary folder (`create-next-app` refuses a non-empty folder), move the files to the repo root, and keep the existing `.gitignore` entries, `STRATEGY.md`, `bin/`, `artifacts/` and `logs/` (Design: Project)
- [ ] Add `typecheck` (`tsc --noEmit`), `lint` and `build` npm scripts and make all three pass on the empty project (AC 1)
- [ ] Initialise shadcn/ui and add the components this feature needs (button, input, label, form, sheet, sonner/toast) (Design: Project)
- [ ] Add `.env.tpl` listing `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NOTCHER_API_KEY`, `FROM_CLIENT_ID` without values, plus `SOURCE_MYSQL_URL`, `SCRATCH_MYSQL_URL`, `PRODUCTION_DB_HOST` commented out with a note that they are set only on the trusted machine (Design: Config; AC 18)
- [ ] Add `docker-compose.yml` with a local Postgres 17 service plus a Neon-compatible HTTP/WebSocket proxy in front of it (e.g. the community `local-neon-http-proxy` image) for development and tests, and document in `.env.tpl` the matching local `DATABASE_URL` (overview O7.4 Local; AC 16)
- [ ] Set up Vitest for unit and integration tests and Playwright for end-to-end tests, with `test`, `test:integration` and `test:e2e` npm scripts; integration and end-to-end tests read `DATABASE_URL` for a migrated Postgres (the docker-compose one locally) (overview O4 Tests; AC 16)
- [ ] Add `.vercelignore` excluding `.claude`, `.cursor` and test output (`coverage/`, `playwright-report/`, `test-results/`) (Design: Config; AC 18)

### Database access and migrations

- [ ] Add `lib/db/index.ts` exporting the `neon()` tagged-template `sql` (pooled `DATABASE_URL`), a `Pool`, and a `tx(async (client) => …)` transaction helper; when `DATABASE_URL` isn't a Neon host, set `neonConfig` (fetch endpoint, WebSocket proxy, no TLS) to use the local proxy, so the same driver runs locally, in CI and on Neon (Design: DB access)
- [ ] Integration test: `sql` and `tx` both work against the docker-compose Postgres through the proxy (Design: DB access)
- [ ] Add `atlas.hcl` with the `local` env (`DATABASE_URL`, dev `docker://postgres/17/dev`, dir `file://db/migrations`) (Design: Migrations; AC 15)
- [ ] Add `scripts/db.sh` wrapping Atlas with `--revisions-schema public`, and npm scripts `db:migrate`, `db:status`, `db:validate`, `db:new`, `db:hash` that call it (Design: Migrations; AC 15)
- [ ] Write the Atlas migration creating `users` (`id` identity, `email` `NOT NULL` unique stored lowercased, `password_hash` `NOT NULL`, `created_at`) and `login_attempts` (`ip`, `attempted_at`, index on `(ip, attempted_at)`); run `db:hash` and confirm `db:validate` passes (Design: Migrations, Sign-in rate limit; AC 15)
- [ ] Add hand-written row types for `users` and `login_attempts` in `lib/db/types.ts` and a query module `lib/db/queries/users.ts` (find by email, create) (Design: DB access; overview O5)

### Passwords and the create-user script

- [ ] Add the shared zod password schema (minimum 12 characters, no other rules) and email schema (trimmed, lowercased) in `lib/validation/auth.ts`, for reuse by spec 02's Users screen (Design: create-user; AC 14)
- [ ] Write `scripts/create-user.ts`: `create-user <email>`, password from an interactive prompt or `CREATE_USER_PASSWORD` (never argv), validated with the shared schema, hashed with bcrypt cost ≥ 10, failing without changes if the email exists (Design: create-user; AC 14)
- [ ] Test `create-user`: bcrypt hash stored (not plaintext); duplicate email fails and leaves the user unchanged; 11 characters rejected, 12 accepted; a password passed as an argument is not used (AC 14)

### Authentication

- [ ] Add `lib/auth.ts`: Auth.js v5 Credentials provider that trims and lowercases the email, looks up the user, and checks the password with `bcryptjs.compare`, comparing against a fixed dummy bcrypt hash when the email is unknown; JWT session strategy, `maxAge` 8h, `updateAge` 15 minutes, `AUTH_SECRET` (Design: Auth; AC 5, AC 6)
- [ ] Add the Auth.js route handler at `app/api/auth/[...nextauth]/route.ts` exporting the handlers from `lib/auth.ts` (serves `/api/auth/session` and sign-out) (Design: Auth; AC 7, AC 8, AC 19)
- [ ] Add the `callbackUrl` guard: accept only values starting with a single `/` (not `//`, no scheme); anything else becomes `/` (Design: callbackUrl safety; AC 4)
- [ ] Add the sign-in rate limiter: on each attempt, delete `login_attempts` rows older than one hour, count the IP's attempts in the last 60 seconds, refuse at 10 or more without checking the password, otherwise record the attempt; IP from `x-real-ip`, falling back to the first `x-forwarded-for` entry (Design: Sign-in rate limit; AC 19)
- [ ] Build `/login` (`app/(auth)/login/page.tsx`): email/password form on the `bg.jpg` background (copied from the legacy repo into `public/`), titled "Fibatron", submitting to a sign-in Server Action that applies the rate limiter, then signs in and redirects to the guarded `callbackUrl`; show "Email or password is incorrect" for any failed login and "Too many sign-in attempts. Try again in a minute." when limited (User-visible: Login and sessions; AC 3, AC 4, AC 5, AC 19)
- [ ] Add `proxy.ts` redirecting unauthenticated requests to `/login?callbackUrl=<path>`, with a `matcher` that excludes `/login`, `/api/auth/*`, Next static assets, public files and `/vw-notcher-api` (Design: Route protection; AC 2, AC 8)
- [ ] Add a server-side session check helper and use it in the `(app)` layout and every Server Action (defence in depth) (Design: Route protection)

### App shell, Dashboard and theme

- [ ] Define the theme as shadcn CSS variables with the web3 palette (primary `#0780b0`, light `#11b0f1`, dark `#004f6e`; secondary `#2c2c2c`; body text `#676767`; muted `#919191` for large or decorative text only; frame/sidebar `#8e989b`; active item `#284e5d` with white text and icon; white content), the system font stack and a fixed rem type scale; light mode only (User-visible: Theme; AC 12)
- [ ] Set the root metadata title to "Fibatron" (AC 11)
- [ ] Build the `(app)` layout with a sidebar and a top bar; the sidebar takes an ordered list of entries (final order: Dashboard, Orders, Order Items, Delivery Dockets, Clients, Product Categories, Product Media, Products, Product Sizes, Product Types, Users), each with a lucide icon, and marks the active entry with `aria-current="page"`; in this feature only Dashboard is passed in (User-visible: App shell; AC 9)
- [ ] Make the sidebar collapse below the `md` breakpoint into a shadcn Sheet opened from a labelled menu button, keyboard operable and closing on Escape (User-visible: App shell; AC 10)
- [ ] Show the signed-in email and a Sign out action in the top bar; sign-out ends the session (User-visible: Login and sessions; AC 7)
- [ ] Add the Dashboard page at `app/(app)/page.tsx` with the heading "Dashboard" and no other content (User-visible: Dashboard; AC 3)
- [ ] Make sure every control on `/login` and in the shell has a label and is keyboard reachable (User-visible: Accessibility)

### Tests for auth, shell and theme

- [ ] Add a Playwright setup project that runs `create-user` (with `CREATE_USER_PASSWORD`) against the test database, signs in once and saves the session (`storageState`); every other test reuses it. Only the login tests (AC 3, 4, 5, 7, 19) sign in themselves, and they clear `login_attempts` first through a test-only database helper, so the sign-in limit never trips the suite (AC 19)
- [ ] Playwright: unauthenticated `/` redirects to `/login?callbackUrl=%2F` (AC 2)
- [ ] Playwright: log in with a `create-user` user, land on `/` showing "Dashboard" in the shell (AC 3)
- [ ] Playwright: an internal `callbackUrl` is honoured; `https://evil.example`, `//evil.example` and `javascript:alert(1)` land on `/` (AC 4)
- [ ] Tests: wrong password and unknown email both show exactly "Email or password is incorrect"; a bcrypt-compare spy is called on both paths; mixed-case email logs in (AC 5)
- [ ] Tests: no sessions table exists; `updateAge` is 15 minutes; a token idle more than 8 hours is rejected; a request more than 15 minutes after the last refresh extends the expiry (AC 6)
- [ ] Playwright: top bar shows the email; Sign out, then `/` redirects to `/login` (AC 7)
- [ ] Tests: `/login`, `/api/auth/*`, a static asset and `/vw-notcher-api` are not redirected for an unauthenticated request; another path is (AC 8)
- [ ] Unit test: the sidebar renders entries in the final order when given the full list; Playwright: Dashboard is shown with an icon and `aria-current="page"` on `/` (AC 9)
- [ ] Playwright: below `md` the sidebar is hidden, the menu button opens the sheet, keyboard works, Escape closes it (AC 10)
- [ ] Playwright: the document title contains "Fibatron" (AC 11)
- [ ] Playwright: the palette variables are defined and the root font size is identical at 375px and 1920px (AC 12)
- [ ] Contrast check (WCAG AA): a unit test computing the contrast ratio of the theme's text/background pairs (body text, muted text at body size must not be `#919191`, primary and secondary buttons), plus Playwright axe scans of `/login` and `/` with the `color-contrast` rule on and no critical violations (AC 13)
- [ ] Tests: 10 sign-in attempts in a minute from one IP are processed; the 11th is refused with the limit message and the password isn't checked; attempts work again after 60 seconds; page loads, `/api/auth/session` and sign-out are never limited (AC 19)

### CI and deploy

- [ ] Add `.github/workflows/ci.yml`: `npm ci`, typecheck, lint, unit tests, gitleaks, `ariga/setup-atlas@v0`, `atlas migrate validate`, `atlas migrate lint --latest 1` with Docker for the dev database, then `atlas migrate apply` (direct Postgres connection) and integration tests against a `postgres:17` service container with the same Neon-compatible proxy as a second service, then `npm run build`, start the app against that database, install Playwright browsers and run `test:e2e` with a throwaway `AUTH_SECRET` set in the workflow (not a real secret); runs on push to `main` (and pull requests) (Design: CI / deploy; AC 16, AC 18)
- [ ] Add `.github/workflows/deploy.yml` per overview O7.3: `deploy-preview` on push to `main` (guard that a production deployment exists; `vercel pull --environment=preview`; migrations via `ariga/atlas-action/migrate/apply@v1` over `DATABASE_URL_UNPOOLED` with `revisions-schema: public`, stopping on failure; `vercel build` + `vercel deploy --prebuilt`; alias to the `STAGING_DOMAIN` repo variable through the Vercel API) and `deploy-production` on `workflow_dispatch` (same steps with `--environment=production` and `--prod`) (Design: CI / deploy; AC 17)

### Operational setup (recorded checks)

- [ ] Configure Neon: one project on Postgres 17 with `production` and `staging` branches; per-preview branching off if added through the Marketplace (Design: Migrations; overview O7.4)
- [ ] Configure GitHub: repo variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_EMAIL`, `STAGING_DOMAIN=staging.fibatron.com`; secret `VERCEL_TOKEN`; environments `staging` and `production` each with `DATABASE_URL_UNPOOLED` (Design: Config; overview O7.4)
- [ ] Configure Vercel (Hobby): one Next.js project on Node 24 with Git auto-deploys off; Production and Preview env vars `DATABASE_URL`, `AUTH_SECRET` (distinct per environment), `NOTCHER_API_KEY`, `FROM_CLIENT_ID`, marked Sensitive; record it (AC 21)
- [ ] Run the first deploy manually as **Deploy → production**, then push to `main` and confirm it deploys to `staging.fibatron.com`; record it (AC 20)
- [ ] Rotate the legacy DigitalOcean DB password hardcoded in `packages/notcher-api/src/index.js` and record confirmation (Design: Security; AC 22)

## Not in this feature

- The Users admin screen and every other resource screen (`02-basic-crud`).
- The notcher feed itself (`04-custom-behaviour`); this feature only keeps its path free of auth redirects.
- Dashboard content beyond the heading.
- Migrating legacy users or their password hashes (accounts are recreated).
- Password reset by email, self sign-up, roles or permissions.
- Dark mode.
