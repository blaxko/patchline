import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "prisma", "test-backend.db");

export default defineConfig({
  test: {
    // tests/live/** are opt-in real-API smoke tests (TESTING.md §3) run only
    // via `pnpm test:live` / vitest.live.config.ts — never part of this
    // mocked, always-on suite. Otherwise the same defaults vitest itself uses.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "tests/live/**",
    ],
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
