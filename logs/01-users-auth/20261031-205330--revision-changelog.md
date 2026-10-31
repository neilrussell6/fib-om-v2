# Revision changelog — 01-users-auth

- Date: 20261031-205330
- Feature: 01-users-auth
- Phase: 4 (Review)

Addresses `20261031-205019--review--FAIL.md` (changes requested by the author at PR validation).

| Finding | Change |
|---|---|
| 1 (medium) insecure local-proxy mode for any non-Neon host | New `lib/db/local-proxy.ts` `usesLocalProxy()`: local mode only for `localhost`, `127.0.0.1`, `::1`, `localtest.me` and `*.localtest.me`; every other host keeps the driver's secure defaults. `lib/db/index.ts` uses it. New `tests/unit/db-local-proxy.test.ts` (9 cases, including `localtest.me.evil.example`). |
| 2 (medium) `create-user` echoed the password | New `scripts/lib/read-hidden.ts` reads the password in raw mode without echo (Enter, Backspace, Ctrl+C). `CREATE_USER_PASSWORD` path unchanged. New `tests/unit/read-hidden.test.ts`. |
| 3 (low) extra `CHECK (email = lower(email))` | Kept; recorded in spec 01 Design as a deliberate exception to O6. |
| 4 (low) session read twice per page | `lib/auth.ts`: `getSession` wrapped in React `cache()`; `requireSession()` uses it. |
| 5 (low) staging deployed regardless of CI | `deploy.yml` `deploy-preview` now triggers on `workflow_run` of CI (completed, `main`), runs only when it succeeded on a push, and checks out `workflow_run.head_sha`. `tests/unit/project-config.test.ts` gains a check. Spec 01 AC-17 and overview O7.1/O7.3/O4 updated to match. |

Suite after the revision: typecheck, lint, build clean; unit 87/87, integration 14/14, end-to-end 32/32.
