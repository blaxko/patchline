import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { buildServer } from "../../src/server.js";
import { startMockAssemblyAIServer } from "../mocks/assemblyaiWsServer.js";
import { pcm16ToWav } from "../../src/reliability/regression/wav.js";
import type { AaiTurnMessage } from "../../src/realtime/assemblyaiAdapter.js";

function nextMockPort(): number {
  const port = 20000 + Math.floor(Math.random() * 20000);
  process.env.MOCK_ASSEMBLYAI_WS_URL = `ws://localhost:${port}`;
  return port;
}

function turn(transcript: string): AaiTurnMessage {
  return {
    type: "Turn",
    turn_order: 0,
    turn_is_formatted: false,
    end_of_turn: true,
    transcript,
    end_of_turn_confidence: 0.95,
    words: [{ text: transcript, start: 0, end: 900, confidence: 0.9, word_is_final: true }],
  };
}

describe("Regression Lab — replay against candidate configs (PRD.md §9 Step 8)", () => {
  let mock: { close: () => void } | null = null;
  let app: Awaited<ReturnType<typeof buildServer>> | null = null;
  let tmpDir: string | null = null;

  afterEach(async () => {
    mock?.close();
    mock = null;
    if (app) {
      await app.close();
      app = null;
    }
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it("baseline fails and the keyterms candidate passes on the same confusable-id regression", async () => {
    // Simulates a config-dependent transcription result: the keyterms config
    // (whose query params include keyterms_prompt) recognizes the id
    // correctly; the baseline config (no keyterms_prompt) mishears it — this
    // is what "replayed against candidate configs" means without needing a
    // real AssemblyAI account in CI (TESTING.md's mocked-server requirement).
    const port = nextMockPort();
    mock = startMockAssemblyAIServer(port, (url) => {
      const hasKeyterms = url.searchParams.getAll("keyterms_prompt").length > 0;
      return { turns: [turn(hasKeyterms ? "order BRK-71Q9" : "order BRK-7109")], turnDelayMs: 10 };
    });

    tmpDir = await mkdtemp(join(tmpdir(), "patchline-replay-"));
    const wavPath = join(tmpDir, "fixture.wav");
    const pcm = Buffer.alloc(1600, 0); // 50ms of silence — content is irrelevant, the mock scripts the transcript
    await writeFile(wavPath, pcm16ToWav(pcm));

    const config = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
    const regressionId = ulid();
    await prisma.regression.create({
      data: {
        id: regressionId,
        sourceSessionId: ulid(),
        entityId: ulid(),
        entityType: "order_id",
        expectedValue: "BRK-71Q9",
        observedValue: "BRK-7109",
        audioAsset: wavPath,
        audioStartMs: 0,
        audioEndMs: 900,
        contextBefore: "order BRK-7109",
        contextAfter: "",
        baselineConfigId: config.id,
        repairMethod: "caller_confirmation",
        status: "open",
      },
    });

    app = await buildServer();
    await app.inject({ method: "GET", url: "/nonexistent" }); // warm up router, harmless

    const response = await app.inject({
      method: "POST",
      url: `/api/regressions/${regressionId}/replay`,
      payload: { config_ids: ["cfg_baseline_v1", "cfg_keyterms_v3"] },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { results: { configId: string; status: string; extractedValue: string | null }[] };

    const baselineRun = body.results.find((r: any) => r.configId === "cfg_baseline_v1");
    const keytermsRun = body.results.find((r: any) => r.configId === "cfg_keyterms_v3");

    expect(baselineRun?.status).toBe("fail");
    expect(baselineRun?.extractedValue).toBe("BRK-7109");
    expect(keytermsRun?.status).toBe("pass");
    expect(keytermsRun?.extractedValue).toBe("BRK-71Q9");

    const storedRuns = await prisma.replayRun.findMany({ where: { regressionId } });
    expect(storedRuns).toHaveLength(2);
  }, 20000);
});
