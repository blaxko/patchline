export interface RegressionSuiteEntry {
  regressionId: string;
  candidateStatus: "pass" | "fail" | "not_replayed";
  candidateLatencyMs: number | null;
  wasPassingBefore: boolean;
}

export type PromotionRejectionReason = "NOT_FULLY_REPLAYED" | "TARGET_FAILS" | "SUITE_REGRESSION" | "LATENCY_REGRESSION";

export interface PromotionGateResult {
  eligible: boolean;
  reason: PromotionRejectionReason | null;
  regressedRegressionIds: string[];
  p95LatencyMs: number | null;
}

export function computeP95(latenciesMs: number[]): number | null {
  if (latenciesMs.length === 0) return null;
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/**
 * Pure, DB-free promotion gate (PRD.md §9 Step 9): a candidate config is
 * eligible only if the target regression passes AND no previously-passing
 * regression in the full suite flips to fail AND the suite's p95 latency
 * stays within `thresholdMultiplier` of the active config's p95.
 */
export function evaluatePromotionGate(
  targetRegressionId: string,
  suite: RegressionSuiteEntry[],
  activeP95LatencyMs: number | null,
  thresholdMultiplier = 1.25,
): PromotionGateResult {
  const notReplayed = suite.filter((s) => s.candidateStatus === "not_replayed");
  if (notReplayed.length > 0) {
    return { eligible: false, reason: "NOT_FULLY_REPLAYED", regressedRegressionIds: [], p95LatencyMs: null };
  }

  const target = suite.find((s) => s.regressionId === targetRegressionId);
  if (!target || target.candidateStatus !== "pass") {
    return { eligible: false, reason: "TARGET_FAILS", regressedRegressionIds: [], p95LatencyMs: null };
  }

  const regressed = suite.filter((s) => s.wasPassingBefore && s.candidateStatus === "fail");
  if (regressed.length > 0) {
    return {
      eligible: false,
      reason: "SUITE_REGRESSION",
      regressedRegressionIds: regressed.map((r) => r.regressionId),
      p95LatencyMs: null,
    };
  }

  const p95 = computeP95(suite.map((s) => s.candidateLatencyMs).filter((v): v is number => v !== null));

  if (activeP95LatencyMs !== null && p95 !== null && p95 > activeP95LatencyMs * thresholdMultiplier) {
    return { eligible: false, reason: "LATENCY_REGRESSION", regressedRegressionIds: [], p95LatencyMs: p95 };
  }

  return { eligible: true, reason: null, regressedRegressionIds: [], p95LatencyMs: p95 };
}
