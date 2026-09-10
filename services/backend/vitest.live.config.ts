import { defineConfig } from "vitest/config";

// Real-API smoke tests (TESTING.md "CI determinism" §3): opt-in, never part
// of the normal `pnpm test` run, and deliberately does NOT force
// MOCK_ASSEMBLYAI=1 the way vitest.config.ts does for the mocked suite —
// these tests need the real env vars (ASSEMBLYAI_API_KEY, GROQ_API_KEY)
// exactly as the process was invoked with.
export default defineConfig({
  test: {
    include: ["tests/live/**/*.test.ts"],
    setupFiles: ["./tests/live/loadEnv.ts"],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
