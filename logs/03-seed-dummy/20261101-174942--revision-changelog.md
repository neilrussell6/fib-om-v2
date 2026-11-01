# Revision changelog — 03-seed-dummy

- Date: 20261101-174942
- Feature: 03-seed-dummy
- Phase: 4 (Review)

Addresses `20261101-173948--review--FAIL.md`.

| Finding | Change |
|---|---|
| 1 (medium) the production-host check missed Neon's pooled form | `scripts/lib/target-guard.ts`: new `endpointHost()` drops `-pooler` from the first host label; `checkTarget` and `isProductionHost` compare endpoint hosts. `tests/unit/target-guard.test.ts` (pooled/direct both ways, staging allowed, production target allowed); CLI test refusing before connecting. Spec 03 Target guard and spec 05 updated. |
| 2 (low) spec said only clients get explicit ids | Spec 03 Dataset and Writing now describe the code: explicit ids for clients, reference tables and dockets, each sequence set past its highest id; orders and order items untouched. |
| 3 (low) argument errors | `parseCliArgs` (strict `node:util` `parseArgs`): unknown options, positionals, missing values and non-integer `--seed` are `UsageError`s printed as one line; `--opt=value` supported. `FROM_CLIENT_ID` errors also one line. `targetArg` removed from the guard. Unit tests (`tests/unit/seed-dummy-cli-args.test.ts`) and CLI tests (no stack trace, no connection). Spec 03 behaviour updated. |
| 4 (low) failed ROLLBACK hid the original error | `ROLLBACK` errors swallowed, original rethrown; stub-client unit test. |
| Nit a | Redundant `ALTER … RESTART` removed. |
| Nit b | `setval(seq, coalesce(max(id), 0) + 1, false)`; integration test: empty `delivery_dockets` gives next id 1. |
| Nit c | Inserts in chunks of 500 rows; integration test with 1,440 order items. |

Also: the guard's `env` parameters take a plain `Record<string, string | undefined>` (no casts in tests).

Suite: typecheck, lint, build clean; unit 189/189; integration 132/132; end-to-end 85/85 (4.1m).
