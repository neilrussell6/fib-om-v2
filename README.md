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
npm run dev
```

## Tests

```sh
npm test                  # unit
npm run test:integration  # needs the docker compose database, migrated
npm run build && npm run test:e2e   # Playwright against the production build
```

## Migrations

Atlas versioned SQL in `db/migrations/`. Create with `npm run db:new -- <name>`, edit, then `npm run db:hash`.
Staging and production are migrated only by `.github/workflows/deploy.yml`.
