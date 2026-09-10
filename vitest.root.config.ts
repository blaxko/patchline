import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "prisma", "test-root.db");

// Root-level suites that span the whole repo rather than one workspace
// package (PRD.md §9 Step 12's event-coverage audit, Step 14's adversarial
// suite, e2e). Per-package suites keep their own vitest.config.ts and run
// via `pnpm -r run test`.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: "./tests/global-setup.ts",
    testTimeout: 20000,
    env: {
      DATABASE_URL: `file:${testDbPath}`,
      MOCK_ASSEMBLYAI: "1",
    },
  },
});
