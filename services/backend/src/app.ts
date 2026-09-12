import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import corsPlugin from "@fastify/cors";
import { registerGateway } from "./realtime/gateway.js";
import { registerDashboardChannel } from "./realtime/dashboardChannel.js";
import { registerApiRoutes } from "./api/routes.js";
import { registerDashboardRoutes } from "./api/dashboardRoutes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  // No operator auth on this deploy (removed by request) — every /api/*
  // route and /ws/dashboard are open. Origin is still restricted rather
  // than opening this up as a public API.
  await app.register(corsPlugin, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  });
  await app.register(websocketPlugin);
  registerGateway(app);
  registerDashboardChannel(app);
  registerApiRoutes(app);
  registerDashboardRoutes(app);
  return app;
}
