import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import corsPlugin from "@fastify/cors";
import { registerGateway } from "./realtime/gateway.js";
import { registerDashboardChannel } from "./realtime/dashboardChannel.js";
import { registerApiRoutes } from "./api/routes.js";
import { registerDashboardRoutes } from "./api/dashboardRoutes.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { cleanupExpiredAudio } from "./reliability/regression/retention.js";
import { env } from "./env.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  // Credentialed cross-origin requests (the dashboard's session cookie) need
  // an explicit allowed origin — "*" is rejected by browsers alongside
  // credentials:"include". Frontend origin only, not a public API.
  await app.register(corsPlugin, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  await app.register(websocketPlugin);
  registerAuthRoutes(app);
  registerGateway(app);
  registerDashboardChannel(app);
  registerApiRoutes(app);
  registerDashboardRoutes(app);
  return app;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  // SECURITY.md: no default password shipped — refuse to boot in production
  // without both set, rather than silently running unauthenticated.
  if (process.env.NODE_ENV === "production" && (!process.env.OPERATOR_PASSWORD || !process.env.SESSION_SECRET)) {
    // eslint-disable-next-line no-console
    console.error("Refusing to start: OPERATOR_PASSWORD and SESSION_SECRET must both be set in production.");
    process.exit(1);
  }

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
