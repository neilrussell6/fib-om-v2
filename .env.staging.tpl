# Copy to .env.staging for the operator scripts' --target staging:
#   npm run seed:dummy -- --target staging
#   npm run create-user -- --target staging <email>
# Never commit .env.staging (it is gitignored). Variables set in the shell win over it.

# Staging Neon branch, DIRECT (non-pooler) connection string. Every write goes over this.
DATABASE_URL_UNPOOLED=
# e.g. DATABASE_URL_UNPOOLED=postgres://user:password@ep-staging-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# PRODUCTION's endpoint host only (no user, password or path), so the guard can refuse
# if DATABASE_URL_UNPOOLED above points at production. The pooled (-pooler) or the
# direct form both work.
PRODUCTION_DB_HOST=
# e.g. PRODUCTION_DB_HOST=ep-production-name-654321-pooler.us-east-2.aws.neon.tech

# Fibatron's sender client id in Vercel's Preview environment (staging); seed:dummy
# creates the sender client with this id. Not used by create-user.
FROM_CLIENT_ID=
# e.g. FROM_CLIENT_ID=1
