import { describe, expect, it } from "vitest";

// AC-19: the limiter keys on the client IP: x-real-ip first, then the first x-forwarded-for entry.
describe("AC-19 clientIpFromHeaders", () => {
  const load = () => import("@/lib/auth/client-ip");

  it("prefers x-real-ip", async () => {
    const { clientIpFromHeaders } = await load();
    const h = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });

  it("falls back to the first x-forwarded-for entry", async () => {
    const { clientIpFromHeaders } = await load();
    const h = new Headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("198.51.100.1");
  });

  it("uses a fixed placeholder when neither header is present", async () => {
    const { clientIpFromHeaders } = await load();
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
