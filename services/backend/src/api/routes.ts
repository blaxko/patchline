import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runReplay } from "../reliability/replay/index.js";
import { prisma } from "../db.js";

const replayBodySchema = z.object({
  config_ids: z.array(z.string()).min(1),
});

export function registerApiRoutes(app: FastifyInstance): void {
  // PRD.md §9 Step 8: replay a regression's stored audio against candidate
  // configs; each candidate's connect failure is isolated (one bad config
  // doesn't abort the batch).
  app.post("/api/regressions/:id/replay", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = replayBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_BODY", details: parsed.error.flatten() });
    }

    const regression = await prisma.regression.findUnique({ where: { id } });
    if (!regression) {
      return reply.code(404).send({ error: "REGRESSION_NOT_FOUND" });
    }

    const results = [];
    for (const configId of parsed.data.config_ids) {
      const replayRunId = await runReplay(id, configId);
      const run = await prisma.replayRun.findUniqueOrThrow({ where: { id: replayRunId } });
      results.push(run);
    }

    return reply.send({ regression_id: id, results });
  });
}
