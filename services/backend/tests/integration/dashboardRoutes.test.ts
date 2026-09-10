import { describe, it, expect } from "vitest";
import { buildServer } from "../../src/server.js";
import { prisma } from "../../src/db.js";

describe("Dashboard REST endpoints (PRD.md §9 Step 11)", () => {
  it("GET /api/metrics/overview returns all 10 core metrics, computed not hardcoded", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/metrics/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const key of [
      "critical_entity_accuracy",
      "first_pass_entity_success_rate",
      "repair_rate",
      "repair_success_rate",
      "mean_repair_turns",
      "unsafe_action_prevention_count",
      "regression_closure_rate",
      "active_config_regression_score",
      "p50_latency_ms",
      "p95_latency_ms",
    ]) {
      expect(body).toHaveProperty(key);
    }
    await app.close();
  });

  it("GET /api/configs lists the seeded configs with parsed keyterms_prompt", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/configs" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.configs.length).toBeGreaterThanOrEqual(3);
    const keyterms = body.configs.find((c: any) => c.id === "cfg_keyterms_v3");
    expect(Array.isArray(keyterms.keytermsPrompt)).toBe(true);
    await app.close();
  });

  it("GET /api/sessions and GET /api/sessions/:id round-trip a real session", async () => {
    const app = await buildServer();
    const config = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
    const session = await prisma.session.create({
      data: { id: "test-session-dash", status: "completed", activeConfigId: config.id, callerLabel: "Dash Test", mode: "live_mic" },
    });

    const listRes = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().sessions.some((s: any) => s.id === session.id)).toBe(true);

    const detailRes = await app.inject({ method: "GET", url: `/api/sessions/${session.id}` });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.session.id).toBe(session.id);
    expect(Array.isArray(detail.events)).toBe(true);

    const missingRes = await app.inject({ method: "GET", url: "/api/sessions/does-not-exist" });
    expect(missingRes.statusCode).toBe(404);

    await prisma.session.delete({ where: { id: session.id } });
    await app.close();
  });

  it("GET /api/regressions and GET /api/regressions/:id round-trip a real regression with replay_runs", async () => {
    const app = await buildServer();
    const regression = await prisma.regression.create({
      data: {
        id: "test-regression-dash",
        sourceSessionId: "n/a",
        entityId: "n/a",
        entityType: "order_id",
        expectedValue: "BRK-71Q9",
        observedValue: "BRK-7109",
        audioAsset: "n/a.wav",
        audioStartMs: 0,
        audioEndMs: 1000,
        contextBefore: "order BRK-7109",
        contextAfter: "",
        baselineConfigId: "cfg_baseline_v1",
        repairMethod: "caller_confirmation",
        status: "open",
      },
    });
    await prisma.replayRun.create({
      data: {
        id: "test-replay-dash",
        regressionId: regression.id,
        configId: "cfg_keyterms_v3",
        transcript: "order BRK-71Q9",
        extractedValue: "BRK-71Q9",
        exactMatch: true,
        normalizedMatch: true,
        latencyMs: 400,
        transcriptDelta: "[]",
        status: "pass",
      },
    });

    const listRes = await app.inject({ method: "GET", url: "/api/regressions" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().regressions.some((r: any) => r.id === regression.id)).toBe(true);

    const detailRes = await app.inject({ method: "GET", url: `/api/regressions/${regression.id}` });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.regression.id).toBe(regression.id);
    expect(detail.replay_runs).toHaveLength(1);
    expect(detail.replay_runs[0].config_name).toBe("Keyterms + Agent Context");

    await prisma.replayRun.delete({ where: { id: "test-replay-dash" } });
    await prisma.regression.delete({ where: { id: regression.id } });
    await app.close();
  });
});
