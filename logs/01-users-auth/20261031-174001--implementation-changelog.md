# Implementation changelog — 01-users-auth

- Date: 20261031-174001
- Feature: 01-users-auth
- Phase: 3 (Implementation)

## 20261031-174001 — implement

**Scaffold and tooling**
- Next.js 16.4.3 (App Router, Turbopack, Tailwind v4, Cache Components) scaffolded in a temporary folder and moved to the repo root; shadcn/ui (base-nova style) with button, input, label, sheet, sonner. (Design: Project; AC-1)
- npm scripts `typecheck` (`next typegen && tsc --noEmit`, since route prop types are generated), `test`, `test:integration`, `test:e2e`, `db:*`, `create-user`; `engines.node` 24.x. (AC-1, AC-15)
- Vitest projects `unit` and `integration`, Playwright with a setup project that signs in once and saves the session. (AC-16)
- ESLint ignores `legacy-prod/` and test output.
- `docker-compose.yml`: Postgres 17 plus `local-neon-http-proxy`, so the app's `@neondatabase/serverless` driver works locally exactly as on Neon. (Design: Local database)
- `.env.tpl` (now un-ignored in `.gitignore`), `.vercelignore`, README with local setup. (AC-18)

**Database**
- `lib/db/index.ts`: lazy `sql` tagged template (HTTP), `getPool()`, `tx()`; points `neonConfig` at the local proxy when `DATABASE_URL` isn't a `*.neon.tech` host. (Design: DB access)
- Migration `20261031180000_users_auth.sql`: `users` (unique, lowercase-checked email; bcrypt hash) and `login_attempts` with an `(ip, attempted_at)` index; `atlas.sum`; `atlas.hcl` and `scripts/db.sh` with `--revisions-schema public`. (AC-15)
- `lib/db/types.ts`, `lib/db/queries/users.ts` (`findUserByEmail`, `createUser`, `UserExistsError`).

**Auth**
- `lib/validation/auth.ts`: shared `emailSchema` (trim, lowercase) and `passwordSchema` (12+ characters). (AC-5, AC-14)
- `lib/auth/credentials.ts`: `verifyCredentials` compares against a fixed dummy bcrypt hash for unknown emails, so both failure paths do one bcrypt compare. (AC-5)
- `lib/auth.ts`: Auth.js v5 Credentials provider, JWT sessions (`maxAge` 8h, `updateAge` 15 min from `lib/auth/session-config.ts`), `trustHost`, `requireSession()`; route handler at `app/api/auth/[...nextauth]/route.ts`. (AC-6, AC-7)
- `lib/auth/rate-limit.ts`: 10 attempts per minute per IP in `login_attempts`, inside a transaction with a per-IP advisory lock; refused attempts aren't recorded; rows older than an hour are pruned. `lib/auth/client-ip.ts` reads `x-real-ip`, then `x-forwarded-for`. (AC-19)
- `lib/auth/callback-url.ts`: only single-slash internal paths. (AC-4)
- `proxy.ts`: Auth.js `auth()` wrapper redirects to `/login?callbackUrl=…` unless `isPublicPath()`; matcher excludes `api/auth`, `vw-notcher-api`, Next assets and the favicon. Signed-in requests roll the JWT forward. (AC-2, AC-6, AC-8)
- `/login`: card on `public/bg.jpg` titled "Fibatron"; the `signInAction` Server Action checks the limit before Auth.js `signIn`, maps any `AuthError` to "Email or password is incorrect", and redirects to the guarded `callbackUrl`. (AC-3, AC-4, AC-5, AC-19)
- `scripts/create-user.ts`: password from `CREATE_USER_PASSWORD` or a TTY prompt only (extra arguments are rejected), bcrypt cost 12, fails on an existing email. (AC-14)

**Shell and theme**
- `app/globals.css`: web3 palette as hex CSS variables, system font stack, fixed 16px root; dark variants bound to an unused `.dark` class (light mode only). (AC-12)
- `lib/theme/palette.ts` with the contrast pairs. White on `#0780b0` is 4.45:1, just under AA, so the default button uses the dark primary `#004f6e`; `#0780b0` stays for accents, focus rings and large text. (AC-13)
- Root metadata title "Fibatron". (AC-11)
- `(app)` layout: top bar (banner) with the signed-in email and Sign out, desktop sidebar `nav[aria-label=Main]`, and below `md` a Sheet opened from an "Open menu" button. Session-reading parts sit inside `<Suspense>` (required by Cache Components). (AC-7, AC-9, AC-10)
- `components/app-shell/nav-items.ts` holds the final 11-entry order; only Dashboard is enabled. `SidebarNav` marks the active entry with `aria-current="page"`. (AC-9)
- Dashboard page with the heading only. (AC-3)

**CI and deploy**
- `.github/workflows/ci.yml`: install, typecheck, lint, unit tests, gitleaks (Docker image), Atlas validate/lint/apply, integration tests, build, Playwright, with Postgres 17 and the Neon proxy as services and a throwaway `AUTH_SECRET`. (AC-16, AC-18)
- `.github/workflows/deploy.yml`: `deploy-preview` (guard, pull, migrate, build, `deploy --prebuilt`, alias to `STAGING_DOMAIN` via the API) and `deploy-production` (`--prod`). (AC-17)

**Status at the end of this step**
- Unit tests: 75/75 pass. `npm run typecheck`, `npm run lint` and `npm run build` pass.
- Integration and end-to-end tests not yet run: Docker isn't available in this WSL distro (Docker Desktop's WSL integration is off).

## 20261031-175541 — fix
- Sign out is a client `SignOutButton` calling `signOutAction` through `useTransition`, instead of a `<form action>` (React's hidden `$ACTION_ID` input has no accessible name). (Accessibility; AC-7)
- `requireSession()` awaits `connection()` before `auth()`, fixing "unstable value crypto.getRandomValues() while prerendering" on signed-in requests under Cache Components. (AC-6)
- Local direct connection: `?sslmode=disable&search_path=public` (the local Postgres has no TLS; the Neon proxy's `neon_control_plane` schema made Atlas see the database as not clean), quoted in `.env`/`.env.tpl` because of the `&`; same URL in `ci.yml`.

## 20261031-200849 — run tests: PASS
- No implementation changes in this loop. Two author-approved test fixes (scoped login-error locator; `signInAndWait` for the AC-19 attempts), see the PASS test log.
- Final: typecheck, lint, build clean; unit 75/75, integration 14/14, end-to-end 32/32.
- gitleaks flagged `db/migrations/atlas.sum` (integrity hashes) as a generic API key; added `.gitleaks.toml` (default rules + that one path allowlisted) and pointed `ci.yml` at it. Staged diff re-scanned: no leaks.
