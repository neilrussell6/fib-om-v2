import { describe, expect, it } from "vitest";
import { usesLocalProxy } from "@/lib/db/local-proxy";

// Review 01 finding 1: insecure local-proxy mode only for explicitly local hosts.
describe("usesLocalProxy", () => {
  it.each([
    "postgres://u:p@localhost:5432/main",
    "postgres://u:p@127.0.0.1:5432/main",
    "postgres://u:p@[::1]:5432/main",
    "postgres://u:p@db.localtest.me:5432/main",
    "postgres://u:p@localtest.me:5432/main",
  ])("uses local-proxy mode for %s", (url) => {
    expect(usesLocalProxy(url)).toBe(true);
  });

  it.each([
    "postgres://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgres://u:p@db.example.com:5432/main",
    "postgres://u:p@localtest.me.evil.example:5432/main",
    "postgres://u:p@notlocalhost:5432/main",
  ])("keeps secure defaults for %s", (url) => {
    expect(usesLocalProxy(url)).toBe(false);
  });
});

// Dev-only direct connection: `next dev` against a local database skips the slow local proxy.
describe("usesDirectDevConnection", () => {
  const local = "postgres://u:p@db.localtest.me:5432/main";
  const neonUrl = "postgres://u:p@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

  it("connects directly under next dev with a local database", async () => {
    const { usesDirectDevConnection } = await import("@/lib/db");
    expect(usesDirectDevConnection({ NODE_ENV: "development", DATABASE_URL: local })).toBe(true);
  });

  it.each([
    ["a Neon database in dev", { NODE_ENV: "development", DATABASE_URL: neonUrl }],
    ["tests", { NODE_ENV: "test", DATABASE_URL: local }],
    ["a production build (next start, e2e)", { NODE_ENV: "production", DATABASE_URL: local }],
    ["the LOCAL_DB_VIA_PROXY=1 opt-out", { NODE_ENV: "development", DATABASE_URL: local, LOCAL_DB_VIA_PROXY: "1" }],
    ["no DATABASE_URL", { NODE_ENV: "development" }],
  ])("keeps the Neon driver for %s", async (_, env) => {
    const { usesDirectDevConnection } = await import("@/lib/db");
    expect(usesDirectDevConnection(env)).toBe(false);
  });
});
