import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Spec 03 AC-6: scripts/seed-dummy.ts refuses before opening any connection. Spec 09 T I1:
// the refusal rules are unit tests (tests/unit/seed-dummy-guard.test.ts); this one spawn
// checks the real CLI's wiring: non-zero exit, one line, no stack trace, no connection.
// A variable that must be "missing" is passed as an empty string, because the script reads
// .env for --target local and .env would otherwise fill it back in.
const CONNECTION_ERROR = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|connect /;

describe("AC-6 refusals before connecting", () => {
  it("the CLI refuses --target staging without FROM_CLIENT_ID in one line, before connecting", () => {
    const r = spawnSync("npx", ["tsx", "scripts/seed-dummy.ts", "--target", "staging", "--yes"], {
      env: { ...process.env, DATABASE_URL_UNPOOLED: "postgres://x@seed-guard.invalid:1/none", PRODUCTION_DB_HOST: "other.invalid", FROM_CLIENT_ID: "" },
      input: "", // stdin is not a terminal
      encoding: "utf8",
      timeout: 60_000,
    });
    const out = `${r.stdout}\n${r.stderr}`;
    expect(r.status).not.toBe(0);
    expect(out).toMatch(/Refused: FROM_CLIENT_ID must be set/);
    expect(out).not.toMatch(CONNECTION_ERROR);
    expect(out).not.toMatch(/\n\s+at /);
  });
});
