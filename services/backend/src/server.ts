import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import { registerGateway } from "./realtime/gateway.js";
import { registerApiRoutes } from "./api/routes.js";
import { env } from "./env.js";

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(websocketPlugin);
  registerGateway(app);
  registerApiRoutes(app);
  return app;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const app = await buildServer();
  app.listen({ port: env.BACKEND_PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
