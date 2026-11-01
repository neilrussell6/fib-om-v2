import { describe, expect, it } from "vitest";
import { UsageError } from "@/scripts/lib/cli";
import { parseCreateUserArgs } from "@/scripts/create-user";

describe("parseCreateUserArgs", () => {
  it.each<[string[], { target?: string; yes: boolean; email: string }]>([
    [["--target", "local", "a@example.com"], { target: "local", yes: false, email: "a@example.com" }],
    [["a@example.com", "--target=production", "--yes"], { target: "production", yes: true, email: "a@example.com" }],
    [["a@example.com"], { target: undefined, yes: false, email: "a@example.com" }],
  ])("parses %j", (argv, expected) => {
    expect(parseCreateUserArgs(argv)).toEqual(expected);
  });

  it.each<[string[], RegExp]>([
    [["--target", "local"], /expected one email, got 0/],
    [["--target", "local", "a@example.com", "a-password-in-argv"], /expected one email, got 2/],
    [["--target", "local", "--password", "x", "a@example.com"], /Unknown option '--password'/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCreateUserArgs(argv)).toThrow(UsageError);
    expect(() => parseCreateUserArgs(argv)).toThrow(message);
  });
});
