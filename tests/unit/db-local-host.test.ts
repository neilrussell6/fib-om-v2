import { describe, expect, it } from "vitest";
import { isLocalDatabase } from "@/lib/db/local-host";

// Review 01 finding 1: only explicitly local hosts leave the Neon driver's secure defaults.
describe("isLocalDatabase", () => {
  it.each([
    "postgres://u:p@localhost:5432/main",
    "postgres://u:p@127.0.0.1:5432/main",
    "postgres://u:p@[::1]:5432/main",
    "postgres://u:p@db.localtest.me:5432/main",
    "postgres://u:p@localtest.me:5432/main",
  ])("treats %s as local", (url) => {
    expect(isLocalDatabase(url)).toBe(true);
  });

  it.each([
    "postgres://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgres://u:p@db.example.com:5432/main",
    "postgres://u:p@localtest.me.evil.example:5432/main",
    "postgres://u:p@notlocalhost:5432/main",
  ])("keeps secure defaults for %s", (url) => {
    expect(isLocalDatabase(url)).toBe(false);
  });
});

// Local databases connect directly with node-postgres (dev, tests, e2e, CI).
describe("usesDirectConnection", () => {
  const local = "postgres://u:p@db.localtest.me:5432/main";
  const neonUrl = "postgres://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

  it.each([
    ["next dev", { NODE_ENV: "development", DATABASE_URL: local }],
    ["tests", { NODE_ENV: "test", DATABASE_URL: local }],
    ["a production build (next start, e2e)", { NODE_ENV: "production", DATABASE_URL: local }],
  ])("connects directly to a local database under %s", async (_, env) => {
    const { usesDirectConnection } = await import("@/lib/db");
    expect(usesDirectConnection(env)).toBe(true);
  });

  it.each([
    ["a Neon database", { NODE_ENV: "production", DATABASE_URL: neonUrl }],
    ["no DATABASE_URL", { NODE_ENV: "development" }],
  ])("keeps the Neon driver for %s", async (_, env) => {
    const { usesDirectConnection } = await import("@/lib/db");
    expect(usesDirectConnection(env)).toBe(false);
  });
});
