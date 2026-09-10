import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "prisma", "test-backend.db");

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    testTimeout: 25000,
    env: {
      DATABASE_URL: `file:${testDbPath}`,
      MOCK_ASSEMBLYAI: "1",
      MOCK_ASSEMBLYAI_WS_URL: "ws://localhost:9099",
      RECONNECT_GRACE_MS: "500",
    },
    fileParallelism: false,
  },
});
