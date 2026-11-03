import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const read = (p: string) => readFileSync(p, "utf8");
const pkg = () => JSON.parse(read("package.json")) as { scripts: Record<string, string> };

describe("AC-1 scripts", () => {
  it("has build, typecheck and lint scripts", () => {
    const { scripts } = pkg();
    expect(scripts.build).toBeTruthy();
    expect(scripts.typecheck).toContain("tsc --noEmit");
    expect(scripts.lint).toBeTruthy();
  });
});

describe("AC-15 Atlas migrations", () => {
  it("has atlas.hcl with the local env, Postgres 17 dev image and the migrations dir", () => {
    const hcl = read("atlas.hcl");
    expect(hcl).toContain('env "local"');
    expect(hcl).toContain('getenv("DATABASE_URL")');
    expect(hcl).toContain("docker://postgres/17/dev");
    expect(hcl).toContain("file://db/migrations");
  });

  it("wraps Atlas in scripts/db.sh with --revisions-schema public", () => {
    const sh = read("scripts/db.sh");
    expect(sh).toContain("atlas migrate");
    expect(sh).toContain("--revisions-schema public");
  });

  it.each(["db:migrate", "db:status", "db:validate", "db:new", "db:hash"])("npm script %s calls scripts/db.sh", (name) => {
    expect(pkg().scripts[name]).toContain("scripts/db.sh");
  });

  it("has a versioned migration creating users and login_attempts, plus atlas.sum", () => {
    expect(existsSync("db/migrations/atlas.sum")).toBe(true);
    const sql = readdirSync("db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => read(`db/migrations/${f}`))
      .join("\n")
      .toLowerCase();
    expect(sql).toMatch(/create table[^;]*users/);
    expect(sql).toMatch(/create table[^;]*login_attempts/);
    expect(sql).not.toMatch(/create table[^;]*sessions/);
  });
});

type Workflow = { on: Record<string, unknown>; jobs: Record<string, { steps?: { run?: string; uses?: string; with?: Record<string, unknown> }[]; services?: Record<string, { image: string }>; environment?: string }> };
const stepText = (wf: Workflow) =>
  JSON.stringify(Object.values(wf.jobs).flatMap((j) => j.steps ?? []));

describe("AC-16 ci.yml", () => {
  const wf = () => parse(read(".github/workflows/ci.yml")) as Workflow;

  it("runs on push to main", () => {
    expect(JSON.stringify(wf().on)).toContain("main");
  });

  it.each([
    "npm ci",
    "typecheck",
    "lint",
    "npm test",
    "gitleaks",
    "ariga/setup-atlas@v0",
    "atlas migrate validate",
    "atlas migrate apply",
    "test:integration",
    "npm run build",
    "playwright install",
    "test:e2e",
  ])("includes %s", (s) => {
    expect(stepText(wf())).toContain(s);
  });

  it("runs Postgres 17 as a service, with no Neon proxy (local connections are direct)", () => {
    const services = Object.values(wf().jobs).flatMap((j) => Object.values(j.services ?? {}).map((s) => s.image));
    expect(services.some((i) => i.startsWith("postgres:17"))).toBe(true);
    expect(services.some((i) => i.includes("neon"))).toBe(false);
  });

  it("orders the steps: validate/lint, then apply, then integration, then e2e", () => {
    const t = stepText(wf());
    const at = (s: string) => t.indexOf(s);
    expect(at("atlas migrate validate")).toBeLessThan(at("atlas migrate apply"));
    expect(at("atlas migrate apply")).toBeLessThan(at("test:integration"));
    expect(at("test:integration")).toBeLessThan(at("test:e2e"));
  });
});

// Spec 09 AC-15: coverage runs in CI, report only.
describe("09 AC-15 coverage", () => {
  type Step = { name?: string; run?: string; uses?: string; if?: string; "continue-on-error"?: boolean; with?: Record<string, unknown> };
  const steps = () => Object.values((parse(read(".github/workflows/ci.yml")) as Workflow).jobs).flatMap((j) => (j.steps ?? []) as Step[]);

  it("test:coverage runs only the unit and integration projects", () => {
    const script = pkg().scripts["test:coverage"];
    expect(script).toBe("vitest run --coverage --project unit --project integration");
  });

  it("CI runs coverage after the unit and integration steps, without failing the build", () => {
    const all = steps();
    const i = all.findIndex((s) => s.run?.includes("test:coverage"));
    expect(i).toBeGreaterThan(-1);
    expect(all[i]["continue-on-error"]).toBe(true);
    expect(i).toBeGreaterThan(all.findIndex((s) => s.run === "npm test"));
    expect(i).toBeGreaterThan(all.findIndex((s) => s.run?.includes("test:integration")));
  });

  it("CI always uploads the coverage report", () => {
    const upload = steps().find((s) => s.uses?.startsWith("actions/upload-artifact") && String(s.with?.path ?? "").includes("coverage"));
    expect(upload).toBeDefined();
    expect(upload!.if).toBe("always()");
  });

  it("vitest.config.mts declares v8 coverage with the spec's thresholds", () => {
    const cfg = read("vitest.config.mts");
    expect(cfg).toMatch(/provider:\s*"v8"/);
    expect(cfg).toContain("thresholds");
    for (const f of [
      "components/resource/list-params.ts",
      "components/resource/format.ts",
      "components/resource/panel/saved-toast.ts",
      "components/resource/panel/use-panel-errors.ts",
      "components/app-shell/sidebar-state.ts",
      "lib/auth/callbacks.ts",
    ]) {
      expect(cfg, f).toContain(f);
    }
    expect(cfg).toMatch(/lib\/auth\.ts/);
    expect(cfg).toMatch(/lib\/db\/index\.ts/);
  });
});

describe("AC-17 deploy.yml", () => {
  const wf = () => parse(read(".github/workflows/deploy.yml")) as Workflow;

  it("deploys preview on push to main and production on workflow_dispatch", () => {
    const w = wf();
    expect(JSON.stringify(w.on)).toContain("main");
    expect(Object.keys(w.on)).toContain("workflow_dispatch");
    expect(w.jobs["deploy-preview"].environment).toBe("staging");
    expect(w.jobs["deploy-production"].environment).toBe("production");
  });

  it("preview: runs only after CI succeeds on a push to main, deploying the tested commit (review 01 finding 5)", () => {
    const w = wf() as Workflow & { on: { workflow_run?: { workflows: string[]; types: string[]; branches: string[] } } };
    expect(w.on.workflow_run).toEqual({ workflows: ["CI"], types: ["completed"], branches: ["main"] });
    expect(Object.keys(w.on)).not.toContain("push");
    const job = w.jobs["deploy-preview"] as unknown as { if: string };
    expect(job.if).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(JSON.stringify(w.jobs["deploy-preview"].steps)).toContain("github.event.workflow_run.head_sha");
  });

  it("preview: guards first deploy, migrates before build, deploys prebuilt, aliases STAGING_DOMAIN", () => {
    const t = JSON.stringify(wf().jobs["deploy-preview"].steps);
    const at = (s: string) => t.indexOf(s);
    expect(t).toContain("vercel pull --environment=preview");
    expect(t).toContain("ariga/atlas-action/migrate/apply@v1");
    expect(t).toContain("DATABASE_URL_UNPOOLED");
    expect(t).toContain("public");
    expect(t).toContain("vercel deploy --prebuilt");
    expect(t).toContain("STAGING_DOMAIN");
    expect(t.toLowerCase()).toContain("production deployment");
    expect(at("migrate/apply")).toBeLessThan(at("vercel build"));
  });

  it("production: same steps with --prod", () => {
    const t = JSON.stringify(wf().jobs["deploy-production"].steps);
    expect(t).toContain("vercel pull --environment=production");
    expect(t).toContain("ariga/atlas-action/migrate/apply@v1");
    expect(t).toContain("vercel build --prod");
    expect(t).toContain("vercel deploy --prebuilt --prod");
  });
});

describe("AC-18 config files", () => {
  it(".env.tpl lists the app variables without values and the operator variables commented out", () => {
    const lines = read(".env.tpl").split("\n");
    for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "AUTH_SECRET", "NOTCHER_API_KEY", "FROM_CLIENT_ID"]) {
      const line = lines.find((l) => l.startsWith(`${name}=`));
      expect(line, name).toBeDefined();
    }
    for (const name of ["AUTH_SECRET", "NOTCHER_API_KEY", "FROM_CLIENT_ID"]) {
      expect(lines.find((l) => l.startsWith(`${name}=`)), name).toBe(`${name}=`);
    }
    for (const name of ["SOURCE_MYSQL_URL", "SCRATCH_MYSQL_URL", "PRODUCTION_DB_HOST"]) {
      expect(lines.some((l) => /^#\s*/.test(l) && l.includes(`${name}=`)), name).toBe(true);
      expect(lines.some((l) => l.startsWith(`${name}=`)), name).toBe(false);
    }
  });

  it(".vercelignore excludes tooling and test output", () => {
    const v = read(".vercelignore");
    for (const entry of [".claude", ".cursor", "playwright-report", "test-results", "coverage"]) {
      expect(v).toContain(entry);
    }
  });

  it("the login background is in public/", () => {
    expect(existsSync("public/bg.jpg")).toBe(true);
  });
});

describe("vercel.json", () => {
  // The Vercel project was created with the "Other" preset, so `vercel build` deployed no
  // Next.js routes (every URL was NOT_FOUND). The repo pins the framework instead.
  it("pins the framework to Next.js", () => {
    expect(JSON.parse(read("vercel.json")).framework).toBe("nextjs");
  });
});
