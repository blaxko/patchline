import type { FastifyInstance } from "fastify";
import { auditEventBus } from "../events.js";

/**
 * Dashboard WS subscription channel (PRD.md §8/§9 Step 11): mirrors the
 * event catalog 1:1 as events are written, so a connected dashboard never
 * has to poll. If this drops, the dashboard frontend falls back to polling
 * the REST endpoints every 3s (its own concern, not this channel's).
 */
export function registerDashboardChannel(app: FastifyInstance): void {
  app.get("/ws/dashboard", { websocket: true }, (socket) => {
    const handler = (event: unknown) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    };

    auditEventBus.on("event", handler);
    socket.on("close", () => {
      auditEventBus.off("event", handler);
    });
  });
}
