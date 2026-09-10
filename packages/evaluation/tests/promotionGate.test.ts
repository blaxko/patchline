import { describe, it, expect } from "vitest";
import { evaluatePromotionGate, computeP95, type RegressionSuiteEntry } from "../src/promotionGate.js";

function entry(overrides: Partial<RegressionSuiteEntry> & { regressionId: string }): RegressionSuiteEntry {
  return {
    candidateStatus: "pass",
    candidateLatencyMs: 400,
    wasPassingBefore: false,
    ...overrides,
  };
}

describe("evaluatePromotionGate", () => {
  it("is eligible when the target passes and the full suite holds", () => {
    const suite = [
      entry({ regressionId: "r1", wasPassingBefore: true }),
      entry({ regressionId: "r2", wasPassingBefore: true }),
      entry({ regressionId: "r3" }),
    ];
    const result = evaluatePromotionGate("r1", suite, 400);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects when the target regression itself fails under the candidate", () => {
    const suite = [entry({ regressionId: "r1", candidateStatus: "fail" }), entry({ regressionId: "r2" })];
    const result = evaluatePromotionGate("r1", suite, 400);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("TARGET_FAILS");
  });

  it("rejects when a previously-passing regression flips to fail under the candidate", () => {
    const suite = [
      entry({ regressionId: "r1" }),
      entry({ regressionId: "r2", wasPassingBefore: true, candidateStatus: "fail" }),
    ];
    const result = evaluatePromotionGate("r1", suite, 400);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("SUITE_REGRESSION");
    expect(result.regressedRegressionIds).toEqual(["r2"]);
  });

  it("rejects when the suite's p95 latency exceeds 1.25x the active config's p95", () => {
    const suite = [
      entry({ regressionId: "r1", candidateLatencyMs: 1000 }),
      entry({ regressionId: "r2", candidateLatencyMs: 1000 }),
    ];
    const result = evaluatePromotionGate("r1", suite, 400); // 400*1.25=500, well under 1000
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("LATENCY_REGRESSION");
  });

  it("allows latency at or under the 1.25x threshold", () => {
    const suite = [entry({ regressionId: "r1", candidateLatencyMs: 500 })];
    const result = evaluatePromotionGate("r1", suite, 400); // exactly 1.25x
    expect(result.eligible).toBe(true);
  });

  it("rejects promotion when any regression in the suite hasn't been replayed yet", () => {
    const suite = [entry({ regressionId: "r1" }), entry({ regressionId: "r2", candidateStatus: "not_replayed", candidateLatencyMs: null })];
    const result = evaluatePromotionGate("r1", suite, 400);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("NOT_FULLY_REPLAYED");
  });

  it("does not gate on latency when the active config has no prior latency data", () => {
    const suite = [entry({ regressionId: "r1", candidateLatencyMs: 5000 })];
    const result = evaluatePromotionGate("r1", suite, null);
    expect(result.eligible).toBe(true);
  });
});

describe("computeP95", () => {
  it("returns null for an empty list", () => {
    expect(computeP95([])).toBeNull();
  });

  it("computes the 95th percentile of a sorted list", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(computeP95(values)).toBe(19);
  });
});
