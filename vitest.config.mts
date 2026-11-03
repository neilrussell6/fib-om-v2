import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Local runs read .env (created from .env.tpl); CI sets the variables directly.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file
}

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

// Spec 09: coverage, reported in CI but not enforced there (the CI step continues on error).
// lib/auth.ts (NextAuth wiring) and lib/db/index.ts (whose Neon branch only runs on Vercel)
// are reported but left out of the lib/** threshold.
const HELPERS_90 = [
  "components/resource/list-params.ts",
  "components/resource/format.ts",
  "components/resource/panel/saved-toast.ts",
  "components/resource/panel/use-panel-errors.ts",
  "components/app-shell/sidebar-state.ts",
  "lib/auth/callbacks.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: ["components/ui/**", "**/*.d.ts"],
      reporter: ["text-summary", "html"],
      thresholds: {
        // lib/** except lib/auth.ts and lib/db/index.ts.
        "lib/{!(auth|db).ts,!(auth|db)/**,auth/**,db/!(index).ts,db/*/**}": { lines: 85, branches: 75 },
        ...Object.fromEntries(HELPERS_90.map((f) => [f, { lines: 90 }])),
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          // Integration tests share one database; run files one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
