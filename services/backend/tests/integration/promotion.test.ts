import { describe, it, expect, afterAll, afterEach } from "vitest";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { promoteConfig, rollbackConfig, PromotionDeniedError } from "../../src/reliability/promotion/index.js";

// Uses the real seeded cfg_baseline_v1 (active) / cfg_keyterms_v3 (draft) —
// this IS the PRD's own Step 9 scenario ("promote the keyterms candidate
// from the demo scenario"). Restores global config state afterward so other
// test files sharing the same test DB aren't affected.
describe("Configuration promotion (PRD.md §9 Step 9)", () => {
  let createdRegressionIds: string[] = [];

  // Isolate each test: the promotion gate legitimately scans *every*
  // regression in the system, so a regression left over from a previous
  // test (with no replay run for the candidate) would otherwise contaminate
  // the next test's suite with a spurious NOT_FULLY_REPLAYED.
  afterEach(async () => {
    await prisma.replayRun.deleteMany({ where: { regressionId: { in: createdRegressionIds } } });
    await prisma.regression.deleteMany({ where: { id: { in: createdRegressionIds } } });
    createdRegressionIds = [];
    // Fully reset global config state after every test, not just at the end —
    // each test assumes the PRD's starting scenario (baseline active, keyterms
    // draft), and a promote/rollback test otherwise leaves keyterms
    // "superseded" for whichever test runs next.
    await prisma.promotion.deleteMany({ where: { configId: { in: ["cfg_baseline_v1", "cfg_keyterms_v3"] } } });
    await prisma.config.update({ where: { id: "cfg_baseline_v1" }, data: { status: "active", promotedBy: null, promotedAt: null } });
    await prisma.config.update({ where: { id: "cfg_keyterms_v3" }, data: { status: "draft", promotedBy: null, promotedAt: null } });
  });

  afterAll(async () => {
    await prisma.promotion.deleteMany({ where: { configId: { in: ["cfg_baseline_v1", "cfg_keyterms_v3"] } } });
    await prisma.config.update({ where: { id: "cfg_baseline_v1" }, data: { status: "active", promotedBy: null, promotedAt: null } });
    await prisma.config.update({ where: { id: "cfg_keyterms_v3" }, data: { status: "draft", promotedBy: null, promotedAt: null } });
  });

  async function makeRegression(): Promise<string> {
    const id = ulid();
    createdRegressionIds.push(id);
    await prisma.regression.create({
      data: {
        id,
        sourceSessionId: ulid(),
        entityId: ulid(),
        entityType: "order_id",
        expectedValue: "BRK-71Q9",
        observedValue: "BRK-7109",
        audioAsset: "unused-in-this-test.wav",
        audioStartMs: 0,
        audioEndMs: 1000,
        contextBefore: "order BRK-7109",
        contextAfter: "",
        baselineConfigId: "cfg_baseline_v1",
        repairMethod: "caller_confirmation",
        status: "open",
      },
    });
    return id;
  }

  async function makeReplayRun(regressionId: string, configId: string, status: "pass" | "fail", latencyMs: number) {
    await prisma.replayRun.create({
      data: {
        id: ulid(),
        regressionId,
        configId,
        transcript: "order BRK-71Q9",
        extractedValue: status === "pass" ? "BRK-71Q9" : "BRK-7109",
        exactMatch: status === "pass",
        normalizedMatch: status === "pass",
        latencyMs,
        transcriptDelta: "[]",
        status,
      },
    });
  }

  it("rejects promotion when a regression hasn't been replayed against the candidate", async () => {
    await makeRegression();

    await expect(promoteConfig("cfg_keyterms_v3", "test-operator")).rejects.toMatchObject({
      reason: "NOT_FULLY_REPLAYED",
    });

    const config = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_keyterms_v3" } });
    expect(config.status).toBe("draft");
  });

  it("promotes when the full suite passes, then rolls back to the previous active config", async () => {
    const regressionId = await makeRegression();
    await makeReplayRun(regressionId, "cfg_keyterms_v3", "pass", 400);
    await makeReplayRun(regressionId, "cfg_baseline_v1", "fail", 350); // active config's own history for this regression

    const promotionId = await promoteConfig("cfg_keyterms_v3", "test-operator", regressionId);
    const promotion = await prisma.promotion.findUniqueOrThrow({ where: { id: promotionId } });
    expect(promotion.action).toBe("promote");
    expect(promotion.previousActiveConfigId).toBe("cfg_baseline_v1");

    const keyterms = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_keyterms_v3" } });
    const baseline = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_baseline_v1" } });
    expect(keyterms.status).toBe("active");
    expect(baseline.status).toBe("superseded");

    const rollbackId = await rollbackConfig("test-operator");
    const rollback = await prisma.promotion.findUniqueOrThrow({ where: { id: rollbackId } });
    expect(rollback.action).toBe("rollback");

    const keytermsAfter = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_keyterms_v3" } });
    const baselineAfter = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_baseline_v1" } });
    expect(baselineAfter.status).toBe("active");
    expect(keytermsAfter.status).toBe("superseded");
  });

  it("rejects promotion when a previously-passing regression would flip to fail under the candidate", async () => {
    const stableRegressionId = await makeRegression();
    await makeReplayRun(stableRegressionId, "cfg_baseline_v1", "pass", 300); // currently passing under active
    await makeReplayRun(stableRegressionId, "cfg_keyterms_v3", "fail", 300); // candidate breaks it

    const targetRegressionId = await makeRegression();
    await makeReplayRun(targetRegressionId, "cfg_baseline_v1", "fail", 300);
    await makeReplayRun(targetRegressionId, "cfg_keyterms_v3", "pass", 300);

    await expect(promoteConfig("cfg_keyterms_v3", "test-operator", targetRegressionId)).rejects.toMatchObject({
      reason: "SUITE_REGRESSION",
    });

    const config = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_keyterms_v3" } });
    expect(config.status).toBe("draft");
  });
});
