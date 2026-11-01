import { describe, expect, it } from "vitest";
import { checkTarget, endpointHost, isProductionHost } from "@/scripts/lib/target-guard";

// Spec 03 review finding 1: Neon serves each branch on a direct and a "-pooler" host;
// the production-host check must match either form on either side.

const DIRECT = "ep-prod-123456.us-east-2.aws.neon.tech";
const POOLED = "ep-prod-123456-pooler.us-east-2.aws.neon.tech";
const STAGING = "ep-staging-654321.us-east-2.aws.neon.tech";
const url = (host: string) => `postgres://u:p@${host}/neondb?sslmode=require`;

describe("endpointHost", () => {
  it.each([
    [POOLED, DIRECT],
    [DIRECT, DIRECT],
    ["EP-PROD-123456-POOLER.US-EAST-2.AWS.NEON.TECH", DIRECT],
    ["localhost", "localhost"],
    // Only the first label's suffix is dropped.
    ["db.x-pooler.example.com", "db.x-pooler.example.com"],
  ])("%s → %s", (host, expected) => {
    expect(endpointHost(host)).toBe(expected);
  });
});

describe("production host, pooled or direct", () => {
  it.each([
    ["direct URL, pooled PRODUCTION_DB_HOST", DIRECT, POOLED],
    ["pooled URL, direct PRODUCTION_DB_HOST", POOLED, DIRECT],
    ["both direct", DIRECT, DIRECT],
    ["both pooled", POOLED, POOLED],
  ])("refuses --target staging with %s", (_, urlHost, productionHost) => {
    const env = { DATABASE_URL_UNPOOLED: url(urlHost), PRODUCTION_DB_HOST: productionHost };
    expect(() => checkTarget("staging", env)).toThrow(/Refused: DATABASE_URL_UNPOOLED points at the production database/);
    expect(isProductionHost(env)).toBe(true);
  });

  it("allows staging's own endpoint and production with --target production", () => {
    const staging = { DATABASE_URL_UNPOOLED: url(STAGING), PRODUCTION_DB_HOST: POOLED };
    expect(checkTarget("staging", staging)).toBe(STAGING);
    expect(isProductionHost(staging)).toBe(false);
    const prod = { DATABASE_URL_UNPOOLED: url(DIRECT), PRODUCTION_DB_HOST: POOLED };
    expect(checkTarget("production", prod)).toBe(DIRECT);
  });
});
