import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

// Review 01 finding 2: the create-user prompt must not echo the password.
afterEach(() => vi.restoreAllMocks());

function fakeStdin() {
  const e = new EventEmitter() as EventEmitter & Record<string, unknown>;
  e.setRawMode = vi.fn();
  e.resume = vi.fn();
  e.pause = vi.fn();
  e.setEncoding = vi.fn();
  return e;
}

describe("readHiddenLine", () => {
  it("returns the typed line without writing it to stdout, handling backspace", async () => {
    const stdin = fakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as never);
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => (writes.push(String(s)), true));
    const { readHiddenLine } = await import("@/scripts/lib/read-hidden");
    const result = readHiddenLine("Password: ");
    stdin.emit("data", "secret-passwordX");
    stdin.emit("data", "\u007f");
    stdin.emit("data", "1\r");
    await expect(result).resolves.toBe("secret-password1");
    expect(writes.join("")).toBe("Password: \n");
    expect(stdin.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
  });

  it("rejects on Ctrl+C and restores the terminal", async () => {
    const stdin = fakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as never);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { readHiddenLine } = await import("@/scripts/lib/read-hidden");
    const result = readHiddenLine("Password: ");
    stdin.emit("data", "abc\u0003");
    await expect(result).rejects.toThrow("Cancelled");
    expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
  });
});
