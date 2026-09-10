import { describe, it, expect, afterEach } from "vitest";
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

function waitForMessage(ws: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 10000): Promise<any> {
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

function turn(order: number, transcript: string): AaiTurnMessage {
  return {
    type: "Turn",
    turn_order: order,
    turn_is_formatted: false,
    end_of_turn: true,
    transcript,
    end_of_turn_confidence: 0.95,
    words: [{ text: transcript, start: 0, end: 900, confidence: 0.9, word_is_final: true }],
  };
}

/**
 * PRD.md §9 Step 15: prerecorded_clip mode runs the demo clip through the
 * same Adapter code path as live mic input, and /api/demo/reset makes the
 * whole script repeatable — run twice, identical outcome both times.
 */
async function runKnownFailureClip(appPort: number, mockPort: number): Promise<{ sessionId: string; regressionId: string }> {
  // turnDelayMs is deliberately generous: regression creation slices real
  // audio out of the rolling buffer around the first entity's timestamp
  // (padded ±1.5s), which only fills as the clip actually streams in the
  // background at real-time pace — the scripted Turn must not outrun it.
  const mock = startMockAssemblyAIServer(mockPort, {
    turns: [turn(0, "I need the status of order BRK-7109"), turn(1, "seven one Q nine")],
    turnDelayMs: 2500,
    idleAfterTurns: true,
  });

  const client = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session?clip=brk_known_failure`);
  await new Promise((resolve) => client.once("open", resolve));

  const sessionMsg = await waitForMessage(client, (m) => m.type === "session_id");
  await waitForMessage(client, (m) => m.type === "begin");
  await waitForMessage(client, (m) => m.type === "repair_question");
  await waitForMessage(client, (m) => m.type === "action_allowed" && m.tool_name === "lookup_order");

  client.close();
  mock.close();

  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionMsg.session_id } });
  expect(session.mode).toBe("prerecorded_clip");

  const regression = await prisma.regression.findFirstOrThrow({ where: { sourceSessionId: sessionMsg.session_id } });
  return { sessionId: sessionMsg.session_id, regressionId: regression.id };
}

describe("Demo mode — prerecorded_clip streaming + reset (PRD.md §9 Step 15)", () => {
  let app: Awaited<ReturnType<typeof buildServer>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("streams a demo clip through the real Adapter path, produces the same repair->regression outcome as a live call, and /api/demo/reset makes it identical on a second run", async () => {
    app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const appPort = address.port;

    const port1 = nextMockPort();
    const firstRun = await runKnownFailureClip(appPort, port1);
    expect(firstRun.regressionId).toBeTruthy();

    const resetResponse = await app.inject({ method: "POST", url: "/api/demo/reset" });
    expect(resetResponse.statusCode).toBe(200);

    // Confirm the reset actually cleared prior demo state.
    const sessionsAfterReset = await prisma.session.count();
    const regressionsAfterReset = await prisma.regression.count();
    expect(sessionsAfterReset).toBe(0);
    expect(regressionsAfterReset).toBe(0);
    const baseline = await prisma.config.findUniqueOrThrow({ where: { id: "cfg_baseline_v1" } });
    expect(baseline.status).toBe("active");

    // Run the identical script again — must reproduce the identical outcome.
    const port2 = nextMockPort();
    const secondRun = await runKnownFailureClip(appPort, port2);

    const firstRegression = await prisma.regression.findUnique({ where: { id: secondRun.regressionId } });
    expect(firstRegression?.expectedValue).toBe("BRK-71Q9");
    expect(firstRegression?.observedValue).toBe("BRK-7109");
    expect(firstRegression?.repairMethod).toBe("caller_confirmation");

    const secondSession = await prisma.session.findUniqueOrThrow({ where: { id: secondRun.sessionId } });
    expect(secondSession.mode).toBe("prerecorded_clip");
  }, 30000);

  it("GET /api/demo/clips lists the seeded demo clips", async () => {
    app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/demo/clips" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.clips.map((c: any) => c.id)).toEqual(expect.arrayContaining(["brk_known_failure", "zxa_post_fix"]));
  });
});
