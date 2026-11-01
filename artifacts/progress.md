# Progress — fib-om-v2

Running log of where each feature stands in the workflow (`STRATEGY.md`). One bullet per step, oldest first; past entries are never edited.

Shared background for all five features: `artifacts/docs/nextjs-vercel-neon-migration.md`. Earlier history of the combined spec (before the split into four features) is in `logs/nextjs-vercel-neon-migration/`.

> 2026-11-01: `seed-dummy` was extracted into the new `03-seed-dummy`, built next. `03-custom-behaviour` became `04-custom-behaviour` and `04-data-scripts` became `05-data-scripts`; their spec and log folders were renamed. Entries written before then keep the old paths.

## 01-users-auth

- 20261031-140121 — Phase 1, step "spec": done — `artifacts/specs/01-users-auth/spec.md`
- 20261031-143655 — Phase 1, step "commit": done — commit `39c2bdb`
- 20261031-150107 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/01-users-auth/20261031-150107--spec-review--FAIL.md`
- 20261031-150107 — Phase 1, step "spec revision": done — `logs/01-users-auth/20261031-150107--spec-revision-changelog.md`
- 20261031-161830 — Phase 1, step "commit": done — commit `d6baeba`
- 20261031-162027 — Phase 1, step "spec review" + "spec validation": PASS — `logs/01-users-auth/20261031-162027--spec-review--PASS.md`
- 20261031-162027 — Phase 1, step "spec revision" (non-blocking items): done — `logs/01-users-auth/20261031-162027--spec-revision-changelog.md`
- 20261031-170021 — Phase 1, step "commit": done — commit `6a67038`
- 20261031-170759 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/01-users-auth/20261031-170759--book-changelog.md`
- 20261031-170900 — Phase 2, step "tasks": done — `artifacts/specs/01-users-auth/tasks.md`
- 20261031-171701 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/01-users-auth/20261031-171701--task-review--FAIL.md`
- 20261031-171701 — Phase 2, step "task revision": done — `artifacts/specs/01-users-auth/tasks.md` (spec AC-16 also revised: `logs/01-users-auth/20261031-171701--spec-revision-changelog.md`)
- 20261031-171912 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/01-users-auth/20261031-171912--task-review--FAIL.md`
- 20261031-171912 — Phase 2, step "task revision": done — `artifacts/specs/01-users-auth/tasks.md`
- 20261031-172020 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/01-users-auth/20261031-172020--task-review--FAIL.md`
- 20261031-172020 — Phase 2, step "task revision": done — `artifacts/specs/01-users-auth/tasks.md` (spec Design also revised)
- 20261031-172122 — Phase 2, step "review tasks" + "validate tasks": PASS — `logs/01-users-auth/20261031-172122--task-review--PASS.md`
- 20261031-172122 — Phase 2, step "commit": done — commit `08425c5`
- 20261031-172142 — Phase 2, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/01-users-auth/20261031-172142--book-changelog.md`
- 20261031-174001 — Phase 3, step "write tests" + "implement feature": done — `logs/01-users-auth/20261031-174001--implementation-changelog.md`
- 20261031-175541 — Phase 3, step "run tests": FAIL — `logs/01-users-auth/20261031-175541--tests--FAIL.md`
- 20261031-175541 — Phase 3, step "fix": done — `logs/01-users-auth/20261031-174001--implementation-changelog.md` (plus author-approved test fixes)
- 20261031-200849 — Phase 3, step "run tests": PASS — `logs/01-users-auth/20261031-200849--tests--PASS.md`
- 20261031-200949 — Phase 3, step "commit": done — commit `276860d`
- 20261031-200949 — Phase 3, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/01-users-auth/20261031-200949--book-changelog.md`
- 20261031-205019 — Phase 4, step "review" + "PR validation": FAIL — `logs/01-users-auth/20261031-205019--review--FAIL.md`
- 20261031-205019 — Phase 4, step "commit review": done — commit `932fe84`
- 20261031-205019 — Phase 4, step "request changes": done — findings 1, 2, 4, 5 fixed in code; 3 recorded in the spec
- 20261031-205019 — Phase 4, step "revision": done — `logs/01-users-auth/20261031-205330--revision-changelog.md`
- 20261031-205019 — Phase 4, step "commit revision": done — commit `f428a2b`
- 20261031-205602 — Phase 4, step "review" + "PR validation": PASS — `logs/01-users-auth/20261031-205602--review--PASS.md`
- 20261031-205602 — Phase 4, step "commit review": done — commit `2f46d49`
- 20261031-205620 — Phase 4, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/01-users-auth/20261031-205620--book-changelog.md`
- 20261031-205620 — Feature workflow complete (phases 1–4). Open: operational AC-20–22 (first production deploy, Vercel env vars, legacy DB password rotation); CI and deploy workflows not yet executed on GitHub.

## 02-basic-crud

- 20261031-140121 — Phase 1, step "spec": done — `artifacts/specs/02-basic-crud/spec.md`
- 20261031-143655 — Phase 1, step "commit": done — commit `39c2bdb`
- 20261031-150418 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/02-basic-crud/20261031-150418--spec-review--FAIL.md`
- 20261031-150418 — Phase 1, step "spec revision": done — `logs/02-basic-crud/20261031-150418--spec-revision-changelog.md`
- 20261031-161830 — Phase 1, step "commit": done — commit `d6baeba`
- 20261031-162057 — Phase 1, step "spec review" + "spec validation": PASS — `logs/02-basic-crud/20261031-162057--spec-review--PASS.md`
- 20261031-162057 — Phase 1, step "spec revision" (non-blocking items): done — `logs/02-basic-crud/20261031-162057--spec-revision-changelog.md`
- 20261031-170021 — Phase 1, step "commit": done — commit `6a67038`
- 20261031-170759 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/02-basic-crud/20261031-170759--book-changelog.md`
- 20261031-205737 — Phase 2, step "tasks": done — `artifacts/specs/02-basic-crud/tasks.md`
- 20261031-210254 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/02-basic-crud/20261031-210254--task-review--FAIL.md`
- 20261031-210254 — Phase 2, step "task revision": done — `artifacts/specs/02-basic-crud/tasks.md` (specs 02 and 04 also revised: `logs/02-basic-crud/20261031-210254--spec-revision-changelog.md`)
- 20261031-210456 — Phase 2, step "review tasks" + "validate tasks": PASS — `logs/02-basic-crud/20261031-210456--task-review--PASS.md`
- 20261031-210456 — Phase 2, step "commit": done — commit `e798748`
- 20261031-210456 — Phase 2, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/02-basic-crud/20261031-210456--book-changelog.md`
- 20261031-215000 — Phase 3, step "write tests" + "implement feature": done — `logs/02-basic-crud/20261031-215000--implementation-changelog.md`
- 20261031-220338 — Phase 3, step "run tests": FAIL — `logs/02-basic-crud/20261031-220338--tests--FAIL.md`
- 20261031-220338 — Phase 3, step "fix": done — author-approved test fixes (see the FAIL log)
- 20261031-221835 — Phase 3, step "run tests": FAIL — `logs/02-basic-crud/20261031-221835--tests--FAIL.md`
- 20261031-221835 — Phase 3, step "fix": done — author-approved test fixes (see the FAIL log)
- 20261031-222527 — Phase 3, step "run tests": PASS — `logs/02-basic-crud/20261031-222527--tests--PASS.md`
- 20261031-222527 — Phase 3, step "commit": done — commit `a3584d5`
- 20261031-222547 — Phase 3, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/02-basic-crud/20261031-222547--book-changelog.md`
- 20261031-225018 — Phase 4, step "review" + "PR validation": FAIL — `logs/02-basic-crud/20261031-225018--review--FAIL.md`
- 20261031-225018 — Phase 4, step "commit review": done — commit `1d0fe8d`
- 20261031-225018 — Phase 4, step "request changes": done — findings 1–5 to fix; Atlas lint step to be removed
- 20261031-234258 — Phase 4, step "revision": done — `logs/02-basic-crud/20261031-234258--revision-changelog.md` (also the sign-out race; spec 01 revised: `logs/01-users-auth/20261031-233437--spec-revision-changelog.md`)
- 20261031-234258 — Phase 4, step "commit revision": done — commit `682f6ab`
- 20261101-000730 — Phase 4, step "review" + "PR validation": FAIL — `logs/02-basic-crud/20261101-000730--review--FAIL.md`
- 20261101-000730 — Phase 4, step "commit review": done — commit `5aae5d8`
- 20261101-000730 — Phase 4, step "request changes": done — finding 1 to fix; item 2 kept
- 20261101-001814 — Phase 4, step "revision": done — `logs/02-basic-crud/20261101-001814--revision-changelog.md`
- 20261101-001814 — Phase 4, step "commit revision": done — commit `666f57c`
- 20261101-003834 — Phase 4, step "review" + "PR validation": PASS — `logs/02-basic-crud/20261101-003834--review--PASS.md`
- 20261101-003834 — Phase 4, step "commit review": done — commit `1e5e339`
- 20261101-003855 — Phase 4, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/02-basic-crud/20261101-003855--book-changelog.md`
- 20261101-003855 — Feature workflow complete (phases 1–4).

## 03-seed-dummy

- 20261101-125349 — Phase 1, step "spec": done (extracted from `05-data-scripts`) — `artifacts/specs/03-seed-dummy/spec.md`
- 20261101-125349 — Phase 1, step "commit": done — commit `1f43c9b`
- 20261101-133629 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/03-seed-dummy/20261101-133629--spec-review--FAIL.md`
- 20261101-133629 — Phase 1, step "spec revision": done — `logs/03-seed-dummy/20261101-133629--spec-revision-changelog.md` (spec 05 also revised: `logs/05-data-scripts/20261101-133629--spec-revision-changelog.md`)
- 20261101-133629 — Phase 1, step "commit": done — commit `5096ace`
- 20261101-133951 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/03-seed-dummy/20261101-133951--spec-review--FAIL.md`
- 20261101-133951 — Phase 1, step "spec revision": done — `logs/03-seed-dummy/20261101-133951--spec-revision-changelog.md` (spec 05 also revised: `logs/05-data-scripts/20261101-133951--spec-revision-changelog.md`)
- 20261101-133951 — Phase 1, step "commit": done — commit `64659ff`

## 04-custom-behaviour

- 20261101-125349 — Renamed from `03-custom-behaviour`; spec references renumbered.

- 20261031-140121 — Phase 1, step "spec": done — `artifacts/specs/03-custom-behaviour/spec.md`
- 20261031-143655 — Phase 1, step "commit": done — commit `39c2bdb`
- 20261031-160347 — Phase 1, step "spec revision" (notcher contract rebuilt from production PHP): done — `logs/03-custom-behaviour/20261031-160347--spec-revision-changelog.md`
- 20261031-161133 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/03-custom-behaviour/20261031-161133--spec-review--FAIL.md`
- 20261031-161830 — Phase 1, step "commit": done — commit `d6baeba`
- 20261031-165253 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/03-custom-behaviour/20261031-165253--spec-review--FAIL.md`
- 20261031-165253 — Phase 1, step "spec revision": done — `logs/03-custom-behaviour/20261031-165253--spec-revision-changelog.md`
- 20261031-170021 — Phase 1, step "commit": done — commit `6a67038`
- 20261031-170129 — Phase 1, step "spec review" + "spec validation": PASS — `logs/03-custom-behaviour/20261031-170129--spec-review--PASS.md`
- 20261031-170129 — Phase 1, step "spec revision" (non-blocking items): done — `logs/03-custom-behaviour/20261031-170129--spec-revision-changelog.md`
- 20261031-170516 — Phase 1, step "commit": done — commit `4328d14`
- 20261031-170759 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/03-custom-behaviour/20261031-170759--book-changelog.md`

## 05-data-scripts

- 20261101-125349 — Renamed from `04-data-scripts`; `seed-dummy` moved to `03-seed-dummy` — `logs/05-data-scripts/20261101-125349--spec-revision-changelog.md`

- 20261031-140121 — Phase 1, step "spec": done — `artifacts/specs/04-data-scripts/spec.md`
- 20261031-143655 — Phase 1, step "commit": done — commit `39c2bdb`
- 20261031-160347 — Phase 1, step "spec revision" (data source moved to production MySQL): done — `logs/04-data-scripts/20261031-160347--spec-revision-changelog.md`
- 20261031-161259 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/04-data-scripts/20261031-161259--spec-review--FAIL.md`
- 20261031-161830 — Phase 1, step "commit": done — commit `d6baeba`
- 20261031-165731 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/04-data-scripts/20261031-165731--spec-review--FAIL.md`
- 20261031-165731 — Phase 1, step "spec revision": done — `logs/04-data-scripts/20261031-165731--spec-revision-changelog.md`
- 20261031-170021 — Phase 1, step "commit": done — commit `6a67038`
- 20261031-170459 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/04-data-scripts/20261031-170459--spec-review--FAIL.md`
- 20261031-170459 — Phase 1, step "spec revision": done — `logs/04-data-scripts/20261031-170459--spec-revision-changelog.md`
- 20261031-170516 — Phase 1, step "commit": done — commit `4328d14`
- 20261031-170623 — Phase 1, step "spec review" + "spec validation": PASS — `logs/04-data-scripts/20261031-170623--spec-review--PASS.md`
- 20261031-170623 — Phase 1, step "spec revision" (non-blocking items): done — `logs/04-data-scripts/20261031-170623--spec-revision-changelog.md`
- 20261031-170629 — Phase 1, step "commit": done — commit `fadc02c`
- 20261031-170759 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/04-data-scripts/20261031-170759--book-changelog.md`
