import { defineConfig } from "vitest/config";

// Root-level suites that span the whole repo rather than one workspace
// package (PRD.md §9 Step 12's event-coverage audit, adversarial tests,
// e2e). Per-package suites keep their own vitest.config.ts and run via
// `pnpm -r run test`.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
