# fib-om-v2

Fibatron order management, rebuilt as a Next.js app on Vercel with Neon Postgres.
Background and decisions: `artifacts/docs/nextjs-vercel-neon-migration.md`.
Feature specs: `artifacts/specs/`.

## Local development

Requires Node 24 (`.tool-versions`), Docker and [Atlas](https://atlasgo.io) (`curl -sSf https://atlasgo.sh | sh`).

```sh
cp .env.tpl .env                 # fill in the local values shown as examples, and AUTH_SECRET
docker compose up -d             # Postgres 17
npm install
npm run db:migrate               # apply db/migrations
npm run create-user -- --target local you@example.com   # prompts for a password (12+ characters)
npm run seed:dummy -- --target local   # optional: fill the app tables with dummy data
npm run dev
```

## Dummy data

`seed:dummy` **wipes every app table except `users` and `login_attempts`** and fills them with a deterministic synthetic dataset (spec 03). It never runs against production or from CI.

```sh
npm run seed:dummy -- --target local             # reads .env; local database hosts only
npm run seed:dummy -- --target local --seed 2    # a different, equally repeatable dataset
npm run seed:dummy -- --target staging           # reads .env.staging; asks you to type "staging"
```

For staging, copy `.env.staging.tpl` to `.env.staging` and fill in staging's direct `DATABASE_URL_UNPOOLED`, production's `PRODUCTION_DB_HOST` (so the guard can refuse production) and Vercel Preview's `FROM_CLIENT_ID`. `--yes` skips the prompt. `create-user` takes the same `--target` values and env files.

## Tests

```sh
npm test                  # unit
npm run test:integration  # needs the docker compose database, migrated
npm run build && npm run test:e2e   # Playwright against the production build
```

## Migrations

Atlas versioned SQL in `db/migrations/`. Create with `npm run db:new -- <name>`, edit, then `npm run db:hash`.
Staging and production are migrated only by `.github/workflows/deploy.yml`.
