# Atlas versioned migrations (overview O7.2). scripts/db.sh passes the direct
# (unpooled) connection string via --url and adds --revisions-schema public.
env "local" {
  url = getenv("DATABASE_URL")
  dev = "docker://postgres/17/dev"
  migration {
    dir = "file://db/migrations"
  }
}
