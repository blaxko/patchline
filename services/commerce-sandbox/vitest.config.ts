import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "prisma", "test.db");

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    testTimeout: 15000,
    env: {
      DATABASE_URL: `file:${testDbPath}`,
    },
  },
});
