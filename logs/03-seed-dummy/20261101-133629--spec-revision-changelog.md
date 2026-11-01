# Spec revision changelog — 03-seed-dummy

- Date: 20261101-133629
- Feature: 03-seed-dummy
- Phase: 1 (Spec)

Addresses `20261101-133629--spec-review--FAIL.md`, applying the author's decisions D1–D11.

| Decision | Change |
|---|---|
| D1 | Acceptance criteria preamble: tests use a throwaway, migrated database, never the shared test database. |
| D2 | User-visible behaviour, Target guard: `FROM_CLIENT_ID` required for `--target staging`; default `1` locally. AC-6 covers it. |
| D3 | User-visible behaviour, AC-1, AC-11: paging claim narrowed to Clients, Products, Orders and Order Items. |
| D4 | Writing: numbered steps with one `TRUNCATE … CONTINUE IDENTITY` and `ALTER SEQUENCE … RESTART`. AC-4 checks the restarts. |
| D5 | New Code layout section (`lib/data/v1-categories.ts`); Dataset uses v1's names and flags plus two dummy categories; new AC-10. |
| D6 | Code layout: `buildDataset` and `seedDummy` exported; AC-1, AC-2, AC-5, AC-8 test through them. |
| D7 | AC-6, AC-7: CLI runs against an unreachable host, expecting the guard's message and no connection error. |
| D8 | Target guard: local hosts only for `--target local`, also for `seed-old`. |
| D9 | Dataset: every date column set explicitly from the anchor. |
| D10 | User-visible behaviour: `seed:dummy` npm script. |
| D11 | `--yes` flag and staging prompt; OQ-2 resolved. |

Operational AC renumbered from AC-10 to AC-11 (new AC-10 added).
