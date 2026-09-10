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
