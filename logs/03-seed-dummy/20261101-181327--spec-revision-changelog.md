# Spec revision changelog — 03-seed-dummy

- Date: 20261101-181327
- Feature: 03-seed-dummy
- Phase: after completion (author request)

| Change | Why | Where |
|---|---|---|
| Each `--target` reads its own gitignored env file: `.env` (local), `.env.staging` (staging), `.env.prod` (production; `seed-old` only, since `seed-dummy` refuses production before reading anything). Shell variables win over the file. The staging run prints the database host and the file it read before the prompt. | Author request: keep staging and production settings in files rather than exporting them for every session. Reading only the target's own file keeps the task-review rule that a local `.env` never mixes into a staging run. | Spec 03 behaviour and Changes from the original; spec 05 credentials note; `scripts/lib/target-guard.ts` (`ENV_FILES`, `loadTargetEnv`); `scripts/seed-dummy.ts`; `.env.tpl`; `tests/unit/target-env.test.ts` |

All the files match `.env*` in `.gitignore`. Next.js doesn't load `.env.staging` or `.env.prod` (its production file is `.env.production`).

Suite: typecheck, lint clean; unit 195/195; integration 132/132. No app code changed, so end-to-end wasn't re-run.
