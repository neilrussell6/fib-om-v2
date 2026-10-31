# Spec revision changelog — 01-users-auth

- Date: 20261031-171701
- Feature: 01-users-auth
- Phase: 2 (Tasks)

Author decision at "validate tasks" (`20261031-171701--task-review--FAIL.md`, B1): Playwright tests run locally against a docker-compose Postgres and in CI.

| Change | Where |
|---|---|
| `docker-compose.yml` local Postgres 17 | Design (Local database) |
| `ci.yml` builds and starts the app and runs Playwright | Design (CI / deploy), AC-16 |
- 20261031-172020: Local and CI Postgres sit behind a Neon-compatible proxy so `@neondatabase/serverless` works everywhere (`20261031-172020--task-review--FAIL.md`, B1); Design (Local database) updated.
