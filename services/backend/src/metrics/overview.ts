import { computeP95 } from "evaluation";
import { prisma } from "../db.js";

// PRD.md §8 core metrics — all computed from entities/tool_calls/repair_events/
// regressions/replay_runs, never hardcoded.
export interface MetricsOverview {
  critical_entity_accuracy: number | null;
  first_pass_entity_success_rate: number | null;
  repair_rate: number | null;
  repair_success_rate: number | null;
  mean_repair_turns: number | null;
  unsafe_action_prevention_count: number;
  regression_closure_rate: number | null;
  active_config_regression_score: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export async function computeMetricsOverview(): Promise<MetricsOverview> {
  const entities = await prisma.entity.findMany({ select: { id: true, verificationState: true } });
  const resolvedStates = new Set(["verified", "confirmed_by_caller", "rejected", "escalated"]);
  const resolvedEntities = entities.filter((e) => resolvedStates.has(e.verificationState));
  const successfulEntities = entities.filter((e) => e.verificationState === "verified" || e.verificationState === "confirmed_by_caller");

  const repairEvents = await prisma.repairEvent.findMany({
    select: { entityId: true, outcome: true, turnCount: true },
    orderBy: { createdAt: "asc" },
  });
  const repairedEntityIds = new Set(repairEvents.map((r) => r.entityId));
  const firstPassEntities = successfulEntities.filter((e) => !repairedEntityIds.has(e.id));

  // One "repair" per entity is its most-recent (highest attempt) row —
  // ordered ascending above so the last Map.set() per key wins.
  const latestRepairByEntity = new Map<string, (typeof repairEvents)[number]>();
  for (const r of repairEvents) {
    latestRepairByEntity.set(r.entityId, r);
  }
  const finalRepairs = [...latestRepairByEntity.values()];
  const terminalRepairs = finalRepairs.filter((r) => r.outcome === "resolved" || r.outcome === "escalated");

  const toolCalls = await prisma.toolCall.findMany({ select: { gateResult: true } });
  const blockedCount = toolCalls.filter((t) => t.gateResult === "blocked").length;

  const regressions = await prisma.regression.findMany({ select: { id: true, status: true } });
  const closedRegressions = regressions.filter((r) => r.status === "closed");

  const activeConfig = await prisma.config.findFirst({ where: { status: "active" } });
  let activeConfigScore: number | null = null;
  if (activeConfig) {
    const latestRuns = await prisma.replayRun.findMany({
      where: { configId: activeConfig.id },
      orderBy: { ranAt: "desc" },
    });
    const latestByRegression = new Map<string, (typeof latestRuns)[number]>();
    for (const run of latestRuns) {
      if (!latestByRegression.has(run.regressionId)) latestByRegression.set(run.regressionId, run);
    }
    const runs = [...latestByRegression.values()];
    activeConfigScore = ratio(runs.filter((r) => r.status === "pass").length, runs.length);
  }

  const allReplayLatencies = (await prisma.replayRun.findMany({ select: { latencyMs: true } }))
    .map((r) => r.latencyMs)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  return {
    critical_entity_accuracy: ratio(successfulEntities.length, resolvedEntities.length),
    first_pass_entity_success_rate: ratio(firstPassEntities.length, resolvedEntities.length),
    repair_rate: ratio(repairedEntityIds.size, entities.length),
    repair_success_rate: ratio(terminalRepairs.filter((r) => r.outcome === "resolved").length, terminalRepairs.length),
    mean_repair_turns:
      finalRepairs.length === 0 ? null : finalRepairs.reduce((sum, r) => sum + r.turnCount, 0) / finalRepairs.length,
    unsafe_action_prevention_count: blockedCount,
    regression_closure_rate: ratio(closedRegressions.length, regressions.length),
    active_config_regression_score: activeConfigScore,
    p50_latency_ms: percentile(allReplayLatencies, 0.5),
    p95_latency_ms: computeP95(allReplayLatencies),
  };
}
