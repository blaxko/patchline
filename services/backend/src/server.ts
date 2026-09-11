// This file is the real process entrypoint (`tsx services/backend/src/server.ts`).
// It deliberately has NO static imports beyond loadEnvFile.ts (which has no
// dependency on @prisma/client or anything else that could mutate
// process.env before we get a chance to). Everything else is imported
// dynamically, after loadEnvFileDefaults() has already run — see that
// function's own comment for exactly why this ordering matters.
import { loadEnvFileDefaults } from "./loadEnvFile.js";

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  loadEnvFileDefaults();

  const { env } = await import("./env.js");

  // Unmissable at boot, regardless of the fix above — per the same "never
  // silently run in the wrong mode" principle, stated as loudly as possible
  // as a second, independent line of defense.
  if (env.MOCK_ASSEMBLYAI) {
    console.log(
      `[patchline] AssemblyAI mode: MOCK (MOCK_ASSEMBLYAI=1, connecting to ${env.MOCK_ASSEMBLYAI_WS_URL}) — set MOCK_ASSEMBLYAI=0 explicitly to use the real AssemblyAI API.`,
    );
  } else if (!env.ASSEMBLYAI_API_KEY) {
    console.error(
      "[patchline] Refusing to start: MOCK_ASSEMBLYAI is off (real mode) but ASSEMBLYAI_API_KEY is empty. " +
        "Set ASSEMBLYAI_API_KEY, or set MOCK_ASSEMBLYAI=1 to run against the mock server instead.",
    );
    process.exit(1);
  } else {
    console.log("[patchline] AssemblyAI mode: LIVE (real API, ASSEMBLYAI_API_KEY configured).");
  }

  // SECURITY.md: no default password shipped — refuse to boot in production
  // without both set, rather than silently running unauthenticated. The one
  // explicit escape hatch is DISABLE_AUTH=1 (judge-facing deploy with no
  // login wall, by deliberate request) — that path needs neither var at
  // all, so it's checked first rather than folded into the condition below.
  const authDisabled = process.env.DISABLE_AUTH === "1";
  if (authDisabled) {
    console.log(
      "[patchline] Operator auth: DISABLED (DISABLE_AUTH=1) — every /api/* route and /ws/dashboard are open, no login required.",
    );
  } else if (process.env.NODE_ENV === "production" && (!process.env.OPERATOR_PASSWORD || !process.env.SESSION_SECRET)) {
    console.error(
      "[patchline] Refusing to start: OPERATOR_PASSWORD and SESSION_SECRET must both be set in production, " +
        "or set DISABLE_AUTH=1 to run this deploy with no operator login at all.",
    );
    process.exit(1);
  }

  const { buildServer } = await import("./app.js");
  const { cleanupExpiredAudio } = await import("./reliability/regression/retention.js");

  const app = await buildServer();
  app.listen({ port: env.BACKEND_PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

  // Audio retention cleanup (SECURITY.md / PRD.md §9 Step 13) — daily is
  // plenty for a retention window measured in days.
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    cleanupExpiredAudio().catch((err) => app.log.error(err, "audio retention cleanup failed"));
  }, CLEANUP_INTERVAL_MS);
}
