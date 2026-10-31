# Revision changelog — 02-basic-crud

- Date: 20261101-001814
- Feature: 02-basic-crud
- Phase: 4 (Review)

Addresses `20261101-000730--review--FAIL.md`.

| Finding | Change |
|---|---|
| 1 (low) a database error in the session check signed users out | New `lib/auth/session-version.ts` `checkSessionVersion`: a confirmed mismatch or deleted user signs out; a lookup error is logged and the token kept for that request. `lib/auth.ts` `jwt` callback uses it. `tests/unit/session-version.test.ts` (5 cases). |
| 2 (note) own password change signs you out everywhere | Kept, by decision. |

Suite: typecheck, lint, build clean; unit + integration 239/239; end-to-end 85/85.
