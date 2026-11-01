# Spec revision changelog — 01-users-auth

- Date: 20261101-190310
- Feature: 01-users-auth
- Phase: after completion (author request, during `03-seed-dummy`)

| Change | Why | Where |
|---|---|---|
| `create-user --target <local\|staging\|production> [--yes] <email>`. Uses spec 03's guard and env-file loader: `.env`, `.env.staging` or `.env.prod`; local hosts only for `local`; `PRODUCTION_DB_HOST` required for staging and production; staging refused on the production host (pooled or direct); typed confirmation of the target's name unless `--yes`. Writes over `DATABASE_URL_UNPOOLED`, the URL the guard checked (it used to write over `DATABASE_URL` from `.env` with no checks). Strict arguments with one-line errors. | Author request: create staff users on staging and production the same way as `seed:dummy` targets them. Writing over the checked URL closes the gap where the guard could approve one database while the script wrote to another. | Spec 01 Design (create-user); `scripts/create-user.ts`; `lib/db/queries/users.ts` (`createUser` takes an optional client); new `scripts/lib/cli.ts` (`UsageError`, `confirmTarget`, `exitWithError`, shared with `seed-dummy`); `tests/integration/create-user.test.ts` (AC-14 cases now `--target local`, plus 9 guard cases); `tests/unit/create-user-args.test.ts`; `tests/e2e/helpers.ts`; README; `.env.tpl` |

Also: `.vercel/**` added to the ESLint ignores (a local `vercel build` output broke `npm run lint`), and the README no longer mentions the removed Neon proxy.

Suite: typecheck, lint, build clean; unit 202/202; integration 141/141; end-to-end 85/85 (4.5m).
