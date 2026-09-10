import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runReplay } from "../reliability/replay/index.js";
import { promoteConfig, rollbackConfig, PromotionDeniedError } from "../reliability/promotion/index.js";
import { resetDemo } from "../demo/reset.js";
import { listDemoClips } from "../demo/clips.js";
import { prisma } from "../db.js";

const replayBodySchema = z.object({
  config_ids: z.array(z.string()).min(1),
});

const promoteBodySchema = z.object({
  actor: z.string().default("operator"),
  target_regression_id: z.string().optional(),
});

const rollbackBodySchema = z.object({
  actor: z.string().default("operator"),
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

  // PRD.md §9 Step 9: promotion runs the full regression suite gate before
  // ever flipping configs.active — a 422 here means "policy denied", never a
  // 500, so the UI can render the specific reason.
  app.post("/api/configs/:id/promote", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = promoteBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_BODY", details: parsed.error.flatten() });
    }

    try {
      const promotionId = await promoteConfig(id, parsed.data.actor, parsed.data.target_regression_id);
      const promotion = await prisma.promotion.findUniqueOrThrow({ where: { id: promotionId } });
      return reply.send(promotion);
    } catch (err) {
      if (err instanceof PromotionDeniedError) {
        return reply.code(422).send({ error: "POLICY_DENIED", reason: err.reason, detail: err.detail });
      }
      throw err;
    }
  });

  app.post("/api/configs/:id/rollback", async (request, reply) => {
    const parsed = rollbackBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_BODY", details: parsed.error.flatten() });
    }

    try {
      const promotionId = await rollbackConfig(parsed.data.actor);
      const promotion = await prisma.promotion.findUniqueOrThrow({ where: { id: promotionId } });
      return reply.send(promotion);
    } catch (err) {
      if (err instanceof PromotionDeniedError) {
        return reply.code(422).send({ error: "POLICY_DENIED", reason: err.reason });
      }
      throw err;
    }
  });

  // PRD.md §9 Step 15: restores the seeded DB + baseline config for a
  // repeatable judge demo, independent of live mic/network conditions.
  app.post("/api/demo/reset", async (_request, reply) => {
    await resetDemo();
    return reply.send({ ok: true });
  });

  app.get("/api/demo/clips", async (_request, reply) => {
    return reply.send({ clips: listDemoClips() });
  });
}
