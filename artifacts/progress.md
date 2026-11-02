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
- 20261101-171508 — Change after completion (author decision, during `03-seed-dummy`): every local database connection goes direct to Postgres, and the local Neon proxy is removed — commit `2dbddae`, `logs/01-users-auth/20261101-171508--spec-revision-changelog.md`
- 20261101-190310 — Change after completion (author request): `create-user --target local|staging|production` with the shared guard and env files — `logs/01-users-auth/20261101-190310--spec-revision-changelog.md`

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
- 20261101-134123 — Phase 1, step "spec review" + "spec validation": PASS — `logs/03-seed-dummy/20261101-134123--spec-review--PASS.md`
- 20261101-134123 — Phase 1, step "spec revision" (non-blocking items): done — `logs/03-seed-dummy/20261101-134123--spec-revision-changelog.md`
- 20261101-134123 — Phase 1, step "commit": done — commit `7e89e42`
- 20261101-134200 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/03-seed-dummy/20261101-134200--book-changelog.md`
- 20261101-134500 — Phase 2, step "tasks": done — `artifacts/specs/03-seed-dummy/tasks.md`
- 20261101-134809 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/03-seed-dummy/20261101-134809--task-review--FAIL.md`
- 20261101-134809 — Phase 2, step "task revision": done — `artifacts/specs/03-seed-dummy/tasks.md` (spec also revised: `logs/03-seed-dummy/20261101-134809--spec-revision-changelog.md`)
- 20261101-134901 — Phase 2, step "review tasks" + "validate tasks": PASS — `logs/03-seed-dummy/20261101-134901--task-review--PASS.md`
- 20261101-134901 — Phase 2, step "commit": done — commit `d3c81b1`
- 20261101-134901 — Phase 2, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/03-seed-dummy/20261101-134901--book-changelog.md`
- 20261101-135619 — Phase 3, step "write tests" + "implement feature": done — `logs/03-seed-dummy/20261101-135619--implementation-changelog.md`
- 20261101-162939 — Phase 3, step "run tests": FAIL — `logs/03-seed-dummy/20261101-162939--tests--FAIL.md` (CRUD browser-test timeouts; cause: the local Neon proxy)
- 20261101-171508 — Phase 3, step "fix": done — no feature code changed; local proxy removed by author decision (commit `2dbddae`)
- 20261101-171508 — Phase 3, step "run tests": PASS — `logs/03-seed-dummy/20261101-171508--tests--PASS.md`
- 20261101-171508 — Phase 3, step "commit": done — commit `a0367d6`
- 20261101-171508 — Phase 3, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/03-seed-dummy/20261101-171508--book-changelog.md`
- 20261101-173948 — Phase 4, step "review" + "PR validation": FAIL — `logs/03-seed-dummy/20261101-173948--review--FAIL.md`
- 20261101-173948 — Phase 4, step "commit review": done — commit `e811135`
- 20261101-173948 — Phase 4, step "request changes": done — findings 1–4 and nits a–c, author decisions in the review log
- 20261101-174942 — Phase 4, step "revision": done — `logs/03-seed-dummy/20261101-174942--revision-changelog.md`
- 20261101-174942 — Phase 4, step "commit revision": done — commit `c350bca`
- 20261101-175050 — Phase 4, step "review" + "PR validation": PASS — `logs/03-seed-dummy/20261101-175050--review--PASS.md`
- 20261101-175050 — Phase 4, step "commit review": done — commit `b7e848d`
- 20261101-175050 — Phase 4, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/03-seed-dummy/20261101-175050--book-changelog.md`
- 20261101-175050 — Feature workflow complete (phases 1–4). Open: AC-11, an operator seeds staging (`--target staging` with staging's `DATABASE_URL_UNPOOLED`, `PRODUCTION_DB_HOST` and Vercel Preview's `FROM_CLIENT_ID`).
- 20261101-181327 — Change after completion (author request): each `--target` reads its own env file (`.env`, `.env.staging`, `.env.prod`) — `logs/03-seed-dummy/20261101-181327--spec-revision-changelog.md`

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

## 06-order-items-design

- 20261101-214031 — Phase 1, step "research": done — `artifacts/specs/06-order-items-design/research.md`
- 20261101-214031 — Phase 1, step "spec": done — `artifacts/specs/06-order-items-design/spec.md`
- 20261101-220928 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/06-order-items-design/20261101-220928--spec-review--FAIL.md`
- 20261101-221144 — Phase 1, step "spec revision": done — `logs/06-order-items-design/20261101-221144--spec-revision-changelog.md`
- 20261101-221402 — Phase 1, step "spec revision" (non-blocking items): done — `logs/06-order-items-design/20261101-221402--spec-revision-changelog.md`
- 20261101-221422 — Phase 1, step "spec review" + "spec validation": PASS — `logs/06-order-items-design/20261101-221422--spec-review--PASS.md`
- 20261101-221422 — Phase 1, step "commit": done — commit `0f3a638`
- 20261101-221452 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/06-order-items-design/20261101-221452--book-changelog.md`
- 20261101-221557 — Phase 2, step "tasks": done — `artifacts/specs/06-order-items-design/tasks.md`
- 20261101-222117 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/06-order-items-design/20261101-222117--task-review--FAIL.md`
- 20261101-222117 — Phase 2, step "task revision": done — `artifacts/specs/06-order-items-design/tasks.md`
- 20261101-222151 — Phase 2, step "review tasks" + "validate tasks": PASS — `logs/06-order-items-design/20261101-222151--task-review--PASS.md`
- 20261101-222151 — Phase 2, step "commit": done — commit `50d8354`
- 20261101-222204 — Phase 2, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/06-order-items-design/20261101-222204--book-changelog.md`
- 20261101-230158 — Phase 3, step "write tests" + "implement feature": done — `logs/06-order-items-design/20261101-230158--implementation-changelog.md`
- 20261101-231048 — Phase 3, step "run tests": FAIL — `logs/06-order-items-design/20261101-231048--tests--FAIL.md`
- 20261101-231048 — Phase 3, step "fix": done — implementation changelog; the author chose the avatar colour (`logs/06-order-items-design/20261101-235243--spec-revision-changelog.md`)
- 20261102-000414 — Phase 3, step "run tests": FAIL — `logs/06-order-items-design/20261102-000414--tests--FAIL.md`
- 20261102-000414 — Phase 3, step "fix": done — implementation changelog
- 20261102-002229 — Phase 3, step "run tests": PASS — `logs/06-order-items-design/20261102-002229--tests--PASS.md`
- 20261102-002229 — Phase 3, step "commit": done — commit `954362f`
- 20261102-002256 — Phase 3, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/06-order-items-design/20261102-002256--book-changelog.md`
- 20261102-090312 — Phase 4, step "review" + "PR validation": PASS (author) — `logs/06-order-items-design/20261102-090312--review--PASS.md`; 3 accepted findings (1 medium, 2 low) left as follow-ups, no revision round
- 20261102-090312 — Phase 4, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/06-order-items-design/20261102-090312--book-changelog.md`
- 20261102-090312 — Phase 4: feature workflow complete for 06-order-items-design

## 07-list-panels

- 20261102-090834 — Phase 1, step "research": done — `artifacts/specs/07-list-panels/research.md`
- 20261102-090834 — Phase 1, step "spec": done — `artifacts/specs/07-list-panels/spec.md`
- 20261102-093758 — Phase 1, step "spec review" + "spec validation": FAIL — `logs/07-list-panels/20261102-093758--spec-review--FAIL.md`
- 20261102-093758 — Phase 1, step "spec revision": done — `logs/07-list-panels/20261102-093758--spec-revision-changelog.md`
- 20261102-102139 — Phase 1, step "spec review" + "spec validation": PASS (with fix) — `logs/07-list-panels/20261102-102139--spec-review--PASS.md`
- 20261102-102139 — Phase 1, step "spec revision" (non-blocking item): done — `logs/07-list-panels/20261102-102139--spec-revision-changelog.md`
- 20261102-102139 — Phase 1, step "commit": done — commit `bfe8e6f`
- 20261102-102139 — Phase 1, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/07-list-panels/20261102-102139--book-changelog.md`
- 20261102-102248 — Phase 2, step "tasks": done — `artifacts/specs/07-list-panels/tasks.md`
- 20261102-103338 — Phase 2, step "review tasks" + "validate tasks": FAIL — `logs/07-list-panels/20261102-103338--task-review--FAIL.md`
- 20261102-103338 — Phase 2, step "task revision": done — `artifacts/specs/07-list-panels/tasks.md`
- 20261102-103520 — Phase 2, step "review tasks" + "validate tasks": PASS — `logs/07-list-panels/20261102-103520--task-review--PASS.md`
- 20261102-103520 — Phase 2, step "commit": done — commit `325b3ee`
- 20261102-103520 — Phase 2, step "book": done — `artifacts/books/fib-om-v2.md`, `logs/07-list-panels/20261102-103520--book-changelog.md`
