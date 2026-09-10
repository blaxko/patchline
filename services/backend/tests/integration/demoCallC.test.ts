import { describe, it, expect, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { WebSocket } from "ws";
import { buildServer } from "../../src/server.js";
import { prisma } from "../../src/db.js";
import { startMockAssemblyAIServer } from "../mocks/assemblyaiWsServer.js";
import type { AaiTurnMessage } from "../../src/realtime/assemblyaiAdapter.js";

function nextMockPort(): number {
  const port = 20000 + Math.floor(Math.random() * 20000);
  process.env.MOCK_ASSEMBLYAI_WS_URL = `ws://localhost:${port}`;
  return port;
}

function waitForMessage(ws: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

function turn(order: number, transcript: string, startMs: number, endMs: number): AaiTurnMessage {
  return {
    type: "Turn",
    turn_order: order,
    turn_is_formatted: false,
    end_of_turn: true,
    transcript,
    end_of_turn_confidence: 0.95,
    words: [{ text: transcript, start: startMs, end: endMs, confidence: 0.9, word_is_final: true }],
  };
}

/**
 * PRD.md §9 Step 10 / DEMO.md Call A→B→C: production failure -> repair ->
 * regression -> candidate replay -> promotion -> a *later* call with a
 * *different* confusable id succeeds first-pass under the newly active
 * config. No new backend module — this is the integration proof that
 * Step 3's "read configs.active at session start" wiring actually closes
 * the loop once Step 9 flips it.
 */
describe("Demo Call C — closing the learning loop live (PRD.md §9 Step 10)", () => {
  let app: Awaited<ReturnType<typeof buildServer>> | null = null;
  let mock: { close: () => void } | null = null;
  const createdRegressionIds: string[] = [];

  afterEach(async () => {
    mock?.close();
    mock = null;
    if (app) {
      await app.close();
      app = null;
    }
    const regressions = await prisma.regression.findMany({ where: { id: { in: createdRegressionIds } } });
    for (const r of regressions) {
      await rm(r.audioAsset, { force: true });
    }
    await prisma.replayRun.deleteMany({ where: { regressionId: { in: createdRegressionIds } } });
    await prisma.regression.deleteMany({ where: { id: { in: createdRegressionIds } } });
    createdRegressionIds.length = 0;
    await prisma.promotion.deleteMany({ where: { configId: { in: ["cfg_baseline_v1", "cfg_keyterms_v3"] } } });
    await prisma.config.update({ where: { id: "cfg_baseline_v1" }, data: { status: "active", promotedBy: null, promotedAt: null } });
    await prisma.config.update({ where: { id: "cfg_keyterms_v3" }, data: { status: "draft", promotedBy: null, promotedAt: null } });
  });

  it("a call with a different confusable id succeeds first-pass after promotion, no repair needed", async () => {
    app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const appPort = address.port;

    // --- Call B: production failure -> repair -> regression (per DEMO.md) ---
    // Both turns on one continuous mock connection (idleAfterTurns so it
    // never auto-sends Termination and kills the session mid-repair).
    const port1 = nextMockPort();
    mock = startMockAssemblyAIServer(port1, {
      turns: [turn(0, "I need the status of order BRK-7109", 1000, 1900), turn(1, "seven one Q nine", 2500, 3200)],
      turnDelayMs: 500,
      idleAfterTurns: true,
    });

    const client1 = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session`);
    await new Promise((resolve) => client1.once("open", resolve));
    // Regression creation (Step 7) slices real audio out of the rolling
    // buffer, which only fills from binary frames the browser actually
    // sends. Sent immediately on "open" — matching the real Call UI, and
    // exercising the gateway's early-frame buffering (a real client can
    // start streaming mic audio before the server's per-connection async
    // setup finishes; those frames must not be silently dropped).
    client1.send(Buffer.alloc(200_000, 1));

    const sessionMsg1 = await waitForMessage(client1, (m) => m.type === "session_id");
    await waitForMessage(client1, (m) => m.type === "begin");
    await waitForMessage(client1, (m) => m.type === "repair_question");
    await waitForMessage(client1, (m) => m.type === "action_allowed" && m.tool_name === "lookup_order");
    client1.close();
    mock.close();

    const regression = await prisma.regression.findFirstOrThrow({ where: { sourceSessionId: sessionMsg1.session_id } });
    createdRegressionIds.push(regression.id);

    // --- Replay + promote (per DEMO.md Call C steps 2-5) ---
    const port2 = nextMockPort();
    mock = startMockAssemblyAIServer(port2, (url) => {
      const hasKeyterms = url.searchParams.getAll("keyterms_prompt").length > 0;
      return { turns: [turn(0, hasKeyterms ? "order BRK-71Q9" : "order BRK-7109", 0, 900)], turnDelayMs: 10 };
    });

    // Replay only the candidate: the promotion gate only requires the
    // *candidate* to have full suite coverage, and skips the latency check
    // entirely when the active config has no replay history of its own
    // (see promotion/index.ts) — replaying the active config too would add
    // a real wall-clock latency measurement from this mock server's near-
    // instant response, which is too noisy at these sub-50ms scales for a
    // stable 1.25x threshold check and isn't what this test is proving.
    const replayResponse = await app.inject({
      method: "POST",
      url: `/api/regressions/${regression.id}/replay`,
      payload: { config_ids: ["cfg_keyterms_v3"] },
    });
    expect(replayResponse.statusCode).toBe(200);
    mock.close();

    const promoteResponse = await app.inject({
      method: "POST",
      url: "/api/configs/cfg_keyterms_v3/promote",
      payload: { actor: "demo", target_regression_id: regression.id },
    });
    expect(promoteResponse.statusCode).toBe(200);

    const activeConfig = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
    expect(activeConfig.id).toBe("cfg_keyterms_v3");

    // --- Call C: a NEW session, a DIFFERENT confusable id, first-pass ---
    const port3 = nextMockPort();
    mock = startMockAssemblyAIServer(port3, {
      turns: [turn(0, "checking on order ZXA-4B8K", 500, 1400)],
      turnDelayMs: 20,
    });

    const client3 = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session`);
    await new Promise((resolve) => client3.once("open", resolve));
    const sessionMsg3 = await waitForMessage(client3, (m) => m.type === "session_id");
    await waitForMessage(client3, (m) => m.type === "begin");

    const messages: any[] = [];
    client3.on("message", (data: Buffer) => messages.push(JSON.parse(data.toString())));

    const allowedMsg = await waitForMessage(client3, (m) => m.type === "action_allowed" && m.tool_name === "lookup_order");
    expect(allowedMsg.result.order_id).toBe("ZXA-4B8K");
    expect(messages.some((m) => m.type === "repair_question")).toBe(false);

    const sessionRow = await prisma.session.findUniqueOrThrow({ where: { id: sessionMsg3.session_id } });
    expect(sessionRow.activeConfigId).toBe("cfg_keyterms_v3");

    client3.close();
  }, 30000);
});
