# Copy to .env for local development. Never commit .env.
# The local values below match docker-compose.yml.

# Pooled connection used by the app at runtime. Locally this is the
# Neon-compatible proxy in front of Postgres (db.localtest.me resolves to 127.0.0.1).
DATABASE_URL=
# e.g. DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main

# Direct (unpooled) connection, used for migrations and test setup.
DATABASE_URL_UNPOOLED=
# e.g. DATABASE_URL_UNPOOLED="postgres://postgres:postgres@localhost:5432/main?sslmode=disable&search_path=public"

# Auth.js signing secret (generate with: openssl rand -base64 32).
AUTH_SECRET=

# Notcher feed key (spec 03).
NOTCHER_API_KEY=

# Fibatron's own client id, used as the "from" client on delivery dockets (spec 02).
FROM_CLIENT_ID=

# Operator-only variables for spec 04's data scripts. Set them only on the
# trusted machine, for the session; never in .env files that leave it.
# SOURCE_MYSQL_URL=
# SCRATCH_MYSQL_URL=
# PRODUCTION_DB_HOST=
