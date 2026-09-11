import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import corsPlugin from "@fastify/cors";
import { registerGateway } from "./realtime/gateway.js";
import { registerDashboardChannel } from "./realtime/dashboardChannel.js";
import { registerApiRoutes } from "./api/routes.js";
import { registerDashboardRoutes } from "./api/dashboardRoutes.js";
import { registerAuthRoutes } from "./auth/routes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  // Operator auth is a bearer token in an Authorization header (auth/routes.ts),
  // not a cookie, so no credentials:true is needed here — restricting the
  // origin is still worth keeping rather than opening this up as a public API.
  await app.register(corsPlugin, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  });
  await app.register(websocketPlugin);
  registerAuthRoutes(app);
  registerGateway(app);
  registerDashboardChannel(app);
  registerApiRoutes(app);
  registerDashboardRoutes(app);
  return app;
}
