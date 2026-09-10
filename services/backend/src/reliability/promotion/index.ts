import { ulid } from "ulid";
import { evaluatePromotionGate, computeP95, type RegressionSuiteEntry } from "evaluation";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { writeAuditEvent } from "../../events.js";

export class PromotionDeniedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail: unknown,
  ) {
    super(`POLICY_DENIED: ${reason}`);
  }
}

async function latestReplayRun(regressionId: string, configId: string) {
  return prisma.replayRun.findFirst({
    where: { regressionId, configId },
    orderBy: { ranAt: "desc" },
  });
}

async function buildSuite(candidateConfigId: string, activeConfigId: string): Promise<RegressionSuiteEntry[]> {
  const regressions = await prisma.regression.findMany();

  const suite: RegressionSuiteEntry[] = [];
  for (const regression of regressions) {
    const candidateRun = await latestReplayRun(regression.id, candidateConfigId);
    const activeRun = await latestReplayRun(regression.id, activeConfigId);

    suite.push({
      regressionId: regression.id,
      candidateStatus: candidateRun ? (candidateRun.status as "pass" | "fail") : "not_replayed",
      candidateLatencyMs: candidateRun?.latencyMs ?? null,
      wasPassingBefore: activeRun?.status === "pass",
    });
  }
  return suite;
}

async function activeConfigP95(activeConfigId: string): Promise<number | null> {
  const runs = await prisma.replayRun.findMany({ where: { configId: activeConfigId } });
  return computeP95(runs.map((r) => r.latencyMs).filter((v): v is number => v !== null));
}

/**
 * PRD.md §9 Step 9: promotes a candidate config only if it passes the full
 * regression suite (not just whatever motivated testing it) and doesn't
 * regress latency beyond LATENCY_REGRESSION_THRESHOLD. `targetRegressionId`
 * defaults to the first regression in the suite when not given — the UI
 * (Step 11) always has one in context (the Regression Compare row the
 * operator clicked "Promote" from).
 */
export async function promoteConfig(configId: string, actor: string, targetRegressionId?: string): Promise<string> {
  const candidate = await prisma.config.findUniqueOrThrow({ where: { id: configId } });
  const active = await prisma.config.findFirstOrThrow({ where: { status: "active" } });

  const suite = await buildSuite(configId, active.id);
  const targetId = targetRegressionId ?? suite[0]?.regressionId ?? "";
  const activeP95 = await activeConfigP95(active.id);

  const gateResult = evaluatePromotionGate(targetId, suite, activeP95, env.LATENCY_REGRESSION_THRESHOLD);

  if (!gateResult.eligible) {
    throw new PromotionDeniedError(gateResult.reason ?? "UNKNOWN", { suite, gateResult });
  }

  const promotionId = ulid();

  await prisma.$transaction([
    prisma.config.update({ where: { id: active.id }, data: { status: "superseded" } }),
    prisma.config.update({
      where: { id: candidate.id },
      data: { status: "active", promotedBy: actor, promotedAt: new Date() },
    }),
    prisma.promotion.create({
      data: {
        id: promotionId,
        configId: candidate.id,
        action: "promote",
        previousActiveConfigId: active.id,
        suiteResults: JSON.stringify(suite),
        actor,
      },
    }),
  ]);

  await writeAuditEvent({
    eventType: "config.promoted",
    actor,
    resourceType: "config",
    resourceId: candidate.id,
    payload: { previous_active_config_id: active.id, suite_size: suite.length },
    correlationId: promotionId,
  });

  return promotionId;
}

/** Reverts to the config active immediately before the current one's promotion. */
export async function rollbackConfig(actor: string): Promise<string> {
  const active = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
  const lastPromotion = await prisma.promotion.findFirst({
    where: { configId: active.id, action: "promote" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastPromotion || !lastPromotion.previousActiveConfigId) {
    throw new PromotionDeniedError("NO_PRIOR_CONFIG", null);
  }

  const promotionId = ulid();

  await prisma.$transaction([
    prisma.config.update({ where: { id: active.id }, data: { status: "superseded" } }),
    prisma.config.update({ where: { id: lastPromotion.previousActiveConfigId }, data: { status: "active" } }),
    prisma.promotion.create({
      data: {
        id: promotionId,
        configId: lastPromotion.previousActiveConfigId,
        action: "rollback",
        previousActiveConfigId: active.id,
        suiteResults: JSON.stringify([]),
        actor,
      },
    }),
  ]);

  await writeAuditEvent({
    eventType: "config.rolled_back",
    actor,
    resourceType: "config",
    resourceId: lastPromotion.previousActiveConfigId,
    payload: { rolled_back_from: active.id },
    correlationId: promotionId,
  });

  return promotionId;
}
