import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Spec 09 T / AC-16, AC-18: every e2e or integration test removed or merged by the test-pyramid
// change is mapped in tests/MOVED.md to the test that now covers its behaviour.
//
// Table rows: | old file | old title | new file | new title |
// Titles are matched as substrings of the files' text, so a title built with a template
// (`${key}: …`) is listed by its fixed part.
type Row = { oldFile: string; oldTitle: string; newFile: string; newTitle: string };

function rows(): Row[] {
  const text = readFileSync("tests/MOVED.md", "utf8");
  return text
    .split("\n")
    .filter((l) => /^\|\s*tests\//.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, "")))
    .map(([oldFile, oldTitle, newFile, newTitle]) => ({ oldFile, oldTitle, newFile, newTitle }));
}

describe("09 AC-16 tests/MOVED.md", () => {
  it("exists and maps at least one test per E and I row of the spec", () => {
    expect(existsSync("tests/MOVED.md")).toBe(true);
    const r = rows();
    expect(r.length).toBeGreaterThan(0);
    for (const tag of ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "I1", "I2", "I3"]) {
      expect(readFileSync("tests/MOVED.md", "utf8"), tag).toMatch(new RegExp(`\\b${tag}\\b`));
    }
  });

  it("every mapped target file exists and contains the mapped test title", () => {
    for (const r of rows()) {
      expect(existsSync(r.newFile), `${r.oldTitle} → ${r.newFile}`).toBe(true);
      expect(readFileSync(r.newFile, "utf8"), `${r.oldTitle} → ${r.newFile}: ${r.newTitle}`).toContain(r.newTitle);
    }
  });

  it("a removed test is gone from its old file, unless it was merged into the same file", () => {
    for (const r of rows()) {
      if (r.oldFile === r.newFile || !existsSync(r.oldFile)) continue;
      expect(readFileSync(r.oldFile, "utf8"), `${r.oldFile} still has "${r.oldTitle}"`).not.toContain(`"${r.oldTitle}"`);
    }
  });
});
