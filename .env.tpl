# Copy to .env for local development. Never commit .env.
# The local values below match docker-compose.yml.

# Pooled connection used by the app at runtime (db.localtest.me resolves to 127.0.0.1).
DATABASE_URL=
# e.g. DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main
# A local host is connected to directly with node-postgres (dev, tests, e2e).

# Direct (unpooled) connection, used for migrations and test setup.
DATABASE_URL_UNPOOLED=
# e.g. DATABASE_URL_UNPOOLED="postgres://postgres:postgres@localhost:5432/main?sslmode=disable&search_path=public"

# Auth.js signing secret (generate with: openssl rand -base64 32).
AUTH_SECRET=

# Notcher feed key (spec 04).
NOTCHER_API_KEY=

# Fibatron's own client id, used as the "from" client on delivery dockets (spec 02).
FROM_CLIENT_ID=

# Operator-only variables for the data scripts (specs 03 and 05). Only on the trusted
# machine: in the shell for the session, or in the gitignored target files below.
# SOURCE_MYSQL_URL=
# SCRATCH_MYSQL_URL=

# Each operator-script --target (create-user, seed:dummy, seed-old) reads its own
# gitignored file; variables set in the shell win:
#   --target local      .env (this file)
#   --target staging    .env.staging
#   --target production .env.prod (create-user, seed-old; seed-dummy refuses production)
# .env.staging / .env.prod hold:
#   DATABASE_URL_UNPOOLED=   that branch's direct (non-pooler) connection string
#   PRODUCTION_DB_HOST=      production's endpoint host (pooled or direct form)
#   FROM_CLIENT_ID=          Vercel's value for that environment (staging: Preview)
