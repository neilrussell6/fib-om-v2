# Spec revision changelog — nextjs-vercel-neon-migration

- Date: 20261031-140121
- Feature: nextjs-vercel-neon-migration
- Phase: 1 (Spec)

Trigger: the author's second round of answers (in conversation).

## Answers applied

| Question | Answer | Where it landed |
|---|---|---|
| Open orders at cutover | Close them in the old system | Overview O3.1; spec 04 cutover step 3, AC-15 |
| Fibatron client id | Use the `FROM_CLIENT_ID` env var | Overview O3.1; spec 02 docket create |
| Real data / snapshot | A bash script connects to the legacy DB and takes a data dump | Spec 04 `scripts/snapshot.sh` |
| Dashboard | Empty for now; Dashboard first and Users last in the sidebar | Spec 01 |
| Data script | Snapshot is a file; `seed-dummy` refuses production only | Spec 04 |
| Structure | Four specs | See below |

## Restructure

The combined spec `artifacts/specs/nextjs-vercel-neon-migration/spec.md` was split and then removed:

- Shared background (legacy system, data model, goals, decisions, architecture, repo layout, SQL and schema conventions, environments and CI, security) → `artifacts/docs/nextjs-vercel-neon-migration.md` (sections O1–O9).
- `artifacts/specs/01-users-auth/spec.md`: scaffold, CI/deploy, theme, app shell, login, JWT sessions, Dashboard, `create-user`.
- `artifacts/specs/02-basic-crud/spec.md`: full schema, shared building blocks, plain CRUD for every resource including Users, error mapping, generic print styles.
- `artifacts/specs/03-custom-behaviour/spec.md`: order items panel, category-driven columns, stage toggles, derived columns, docket print layout and order management, notcher feed and contract test.
- `artifacts/specs/04-data-scripts/spec.md`: `snapshot.sh`, `seed-old`, `seed-dummy`, the reference-data workflow, cutover.

Acceptance criteria are renumbered from AC-1 within each spec.

## Design choices made while splitting (flagged in each spec)

- Users admin screen moved from phase 1 to `02-basic-crud`, since it is plain CRUD.
- Grouped `show_*` switches and the product type filter fix moved to `02-basic-crud` (form layout and a filter, not custom behaviour).
- `seed-old` restores the snapshot into a scratch Postgres and copies from there (spec 04 OQ-4).
- `seed-old` sets the order id sequences from the legacy max ids in the snapshot (spec 04 OQ-3).
- `users.email` is unique (needed for login).
