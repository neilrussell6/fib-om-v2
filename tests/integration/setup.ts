// Integration tests need a migrated Postgres (docker compose locally, service containers in CI).
for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
  if (!process.env[name]) {
    throw new Error(
      `${name} is not set. Integration tests need the local database: docker compose up -d && npm run db:migrate (see .env.tpl).`,
    );
  }
}
