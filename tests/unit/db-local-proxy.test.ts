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
