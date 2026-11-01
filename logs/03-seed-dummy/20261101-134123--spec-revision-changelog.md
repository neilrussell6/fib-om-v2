# Spec revision changelog — 03-seed-dummy

- Date: 20261101-134123
- Feature: 03-seed-dummy
- Phase: 1 (Spec)

Addresses the non-blocking finding in `20261101-134123--spec-review--PASS.md`.

| Finding | Change |
|---|---|
| N1 | AC-6 uses `postgres://x@seed-guard.invalid:1/none`. AC-7 sets `PRODUCTION_DB_HOST=seed-guard.invalid` for the production-host case, and checks that local hosts pass the guard by expecting a connection error instead of the guard's message. |
