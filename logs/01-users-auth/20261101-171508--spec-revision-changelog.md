# Spec revision changelog — 01-users-auth

- Date: 20261101-171508
- Feature: 01-users-auth
- Phase: 3 (Implementation of `03-seed-dummy`)

One author decision, taken while running the tests for `03-seed-dummy`, changes this (already completed) feature.

| Change | Why | Where |
|---|---|---|
| Every local database connection (dev, integration tests, Playwright, CI) goes straight to Postgres with `pg`. The local Neon-compatible proxy was removed from `docker-compose.yml` and from CI's services, along with its `neonConfig` settings and the `LOCAL_DB_VIA_PROXY` switch. `lib/db/local-proxy.ts` became `lib/db/local-host.ts` (`isLocalDatabase`). | The proxy re-authenticated and opened a new Postgres connection for every query (~200–350 ms, against ~1 ms direct). Each CRUD browser test took 22–31 s against a 30 s timeout and failed at random. With direct connections they take 6–13 s, and the suite runs in 5.5 min instead of 12. The author had asked for direct local connections; the earlier change (`a8eefc1`) covered only `next dev`. | Design (Local database), AC-16 test (`project-config.test.ts` now asserts no Neon proxy in CI); overview decision table and CI description; `.env.tpl` |

Consequence: `@neondatabase/serverless` is no longer exercised by any local or CI test, only on staging and production.
