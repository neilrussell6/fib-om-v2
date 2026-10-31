# Revision changelog — 02-basic-crud

- Date: 20261031-234258
- Feature: 02-basic-crud
- Phase: 4 (Review)

Addresses `20261031-225018--review--FAIL.md`, plus a sign-out bug found while re-running the suite.

| Finding | Change |
|---|---|
| 1 (medium) invalid URL filter values crashed the list | `lib/db/list-query.ts` `isValidValue`: dates must be real `YYYY-MM-DD` dates, integers/ids within range, enum values among the filter's options; invalid values are ignored. Integration tests (8 cases) and an end-to-end test. |
| 2 (medium) duplicate ids across hidden preserved routes | Form fields, list filters and the page-size picker use `useId()` prefixes. Error messages carry `data-field-error`; tests use a `fieldError()` helper instead of `#<field>-error`. End-to-end test checks no duplicate ids after client-side navigation. |
| 3 (medium) rows not keyboard-openable | The identifying cell (first column that doesn't link elsewhere) is a real link to the detail page. End-to-end test focuses it and presses Enter. CRUD test's Edit lookup made exact (edited names contain "Edit"). |
| 4 (low) out-of-range integers | Schema caps integers at the 32-bit range; `22003` maps to "please provide a valid integer". Unit tests. |
| 5 (low) stale docket after client change | Changing the order's client clears dependent reference fields (the docket). End-to-end test. |
| Atlas lint (author decision) | `atlas migrate lint` removed from `ci.yml`; project-config test, spec 01 AC-16, spec 02 AC-1 and the overview updated. |
| Sign-out didn't always stick (found re-running AC-7; author chose the fix) | Migration `session_version` on users; the JWT carries it and every auth check compares it with the database (`jwt` callback returns null on mismatch); sign-out and a password change bump it. AC-7 uses its own user (sign-out now ends all of a user's sessions); session tests carry a real id and version; new test replays a pre-sign-out cookie; integration test for the password-change bump. Spec 01 revised (`logs/01-users-auth/20261031-233437--spec-revision-changelog.md`). |

Suite after the revision: typecheck, lint, build, `db:validate` clean; unit + integration 234/234; end-to-end 85/85.
