import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { prisma } from "../db.js";
import { computeMetricsOverview } from "../metrics/overview.js";

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Read-only REST endpoints backing the 5 dashboard screens (PRD.md §9 Step
 * 11) — every one of these is a read of audit_events + the primary tables,
 * never a computed-on-the-fly number the backend didn't already store.
 */
export function registerDashboardRoutes(app: FastifyInstance): void {
  app.get("/api/metrics/overview", async (_request, reply) => {
    return reply.send(await computeMetricsOverview());
  });

  app.get("/api/sessions", async (_request, reply) => {
    const sessions = await prisma.session.findMany({
      orderBy: { startedAt: "desc" },
      include: { activeConfig: { select: { id: true, name: true } } },
    });
    return reply.send({ sessions });
  });

  app.get("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await prisma.session.findUnique({
      where: { id },
      include: { activeConfig: { select: { id: true, name: true } } },
    });
    if (!session) return reply.code(404).send({ error: "SESSION_NOT_FOUND" });

    const [utterances, entities, events] = await Promise.all([
      prisma.utterance.findMany({ where: { sessionId: id }, orderBy: { turnOrder: "asc" } }),
      prisma.entity.findMany({ where: { sessionId: id }, orderBy: { createdAt: "asc" } }),
      prisma.auditEvent.findMany({ where: { correlationId: id }, orderBy: { createdAt: "asc" } }),
    ]);

    return reply.send({
      session,
      utterances,
      entities,
      // Evidence Timeline (§11): one row per audit_events row for this session.
      events: events.map((e) => ({ ...e, payload: parseJson(e.payload) })),
    });
  });

  app.get("/api/regressions", async (_request, reply) => {
    const regressions = await prisma.regression.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ regressions });
  });

  app.get("/api/regressions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const regression = await prisma.regression.findUnique({ where: { id } });
    if (!regression) return reply.code(404).send({ error: "REGRESSION_NOT_FOUND" });

    const replayRuns = await prisma.replayRun.findMany({
      where: { regressionId: id },
      orderBy: { ranAt: "desc" },
    });
    const configIds = [...new Set(replayRuns.map((r) => r.configId))];
    const configs = await prisma.config.findMany({ where: { id: { in: configIds } } });
    const configById = new Map(configs.map((c) => [c.id, c]));

    return reply.send({
      regression,
      // Regression Compare (§11): one row per config, most recent run first.
      replay_runs: replayRuns.map((r) => ({
        ...r,
        transcriptDelta: parseJson(r.transcriptDelta),
        config_name: configById.get(r.configId)?.name ?? r.configId,
        config_status: configById.get(r.configId)?.status ?? null,
      })),
    });
  });

  // Serves the regression's captured clip so the dashboard can play it
  // (§11: "Each row links to the exact audio range via an inline waveform
  // scrubber"). Not yet behind operator auth — Step 13 wraps all /api/*
  // routes; see SECURITY.md.
  app.get("/api/regressions/:id/audio", async (request, reply) => {
    const { id } = request.params as { id: string };
    const regression = await prisma.regression.findUnique({ where: { id } });
    if (!regression) return reply.code(404).send({ error: "REGRESSION_NOT_FOUND" });

    try {
      const bytes = await readFile(regression.audioAsset);
      reply.header("Content-Type", "audio/wav");
      return reply.send(bytes);
    } catch {
      return reply.code(404).send({ error: "AUDIO_SEGMENT_MISSING" });
    }
  });

  app.get("/api/configs", async (_request, reply) => {
    const configs = await prisma.config.findMany({ orderBy: { version: "asc" } });
    return reply.send({
      configs: configs.map((c) => ({ ...c, keytermsPrompt: c.keytermsPrompt ? JSON.parse(c.keytermsPrompt) : null })),
    });
  });
}
