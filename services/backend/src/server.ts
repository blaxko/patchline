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

  const { buildServer } = await import("./app.js");
  const { cleanupExpiredAudio } = await import("./reliability/regression/retention.js");

  const app = await buildServer();
  // "::" (not "0.0.0.0") binds dual-stack IPv4+IPv6 on Windows/Linux, where
  // IPV6_V6ONLY defaults off — real bug found while restyling the dashboard:
  // "localhost" resolved to the IPv6 loopback (::1) for the browser's
  // WebSocket connection specifically (fetch() on the same page happened to
  // resolve IPv4 and worked fine), and since the server only listened on
  // 0.0.0.0 (IPv4-only), that WS connection got an immediate ECONNREFUSED —
  // surfacing as "WebSocket is closed before the connection is established"
  // and an indefinite "reconnecting…" in the dashboard nav, indistinguishable
  // from the (also-real, separate) "no backend running at all" case.
  app.listen({ port: env.BACKEND_PORT, host: "::" }).catch((err) => {
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
