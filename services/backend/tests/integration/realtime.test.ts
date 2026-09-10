import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { buildServer } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import { startMockAssemblyAIServer } from "../mocks/assemblyaiWsServer.js";
import type { AaiTurnMessage } from "../../src/realtime/assemblyaiAdapter.js";

// A fresh random port per test avoids TIME_WAIT collisions between test runs
// on a fixed port (observed flakiness when reusing one port back-to-back).
function nextMockPort(): number {
  const port = 20000 + Math.floor(Math.random() * 20000);
  process.env.MOCK_ASSEMBLYAI_WS_URL = `ws://localhost:${port}`;
  return port;
}

function waitForMessage(ws: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 12000): Promise<any> {
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

function turn(order: number, transcript: string, endOfTurn: boolean, startMs: number, endMs: number): AaiTurnMessage {
  return {
    type: "Turn",
    turn_order: order,
    turn_is_formatted: false,
    end_of_turn: endOfTurn,
    transcript,
    end_of_turn_confidence: endOfTurn ? 0.95 : 0.1,
    words: [{ text: transcript, start: startMs, end: endMs, confidence: 0.9, word_is_final: endOfTurn }],
  };
}

describe("realtime voice session (mocked AssemblyAI)", () => {
  let mock: { close: () => void } | null = null;
  let appPort: number | null = null;
  let app: Awaited<ReturnType<typeof buildServer>> | null = null;

  afterEach(async () => {
    mock?.close();
    mock = null;
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("stores utterances with correct timestamps for a multi-turn call", async () => {
    mock = startMockAssemblyAIServer(nextMockPort(), {
      turns: [
        turn(0, "hello there", false, 0, 500),
        turn(0, "hello there", true, 0, 500),
        turn(1, "I need help with an order", true, 600, 1800),
      ],
      turnDelayMs: 30,
    });

    app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    appPort = address.port;

    const client = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session`);
    await new Promise((resolve) => client.once("open", resolve));

    const sessionMsg = await waitForMessage(client, (m) => m.type === "session_id");
    const sessionId: string = sessionMsg.session_id;

    await waitForMessage(client, (m) => m.type === "begin");
    const partial = await waitForMessage(client, (m) => m.type === "partial");
    expect(partial.transcript).toBe("hello there");

    await waitForMessage(client, (m) => m.type === "final" && m.turn_order === 0);
    await waitForMessage(client, (m) => m.type === "final" && m.turn_order === 1);
    await waitForMessage(client, (m) => m.type === "session_completed");

    const utterances = await prisma.utterance.findMany({
      where: { sessionId },
      orderBy: { turnOrder: "asc" },
    });

    expect(utterances).toHaveLength(2);
    expect(utterances[0]).toMatchObject({ text: "hello there", startMs: 0, endMs: 500, turnOrder: 0 });
    expect(utterances[1]).toMatchObject({
      text: "I need help with an order",
      startMs: 600,
      endMs: 1800,
      turnOrder: 1,
    });

    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe("completed");

    client.close();
  });

  it("survives a simulated AssemblyAI WS drop by reconnecting within the grace window", async () => {
    const reconnectPort = nextMockPort();
    mock = startMockAssemblyAIServer(reconnectPort, {
      turns: [turn(0, "first turn before drop", true, 0, 400)],
      turnDelayMs: 20,
      dropConnection: true,
    });

    app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    appPort = address.port;

    const client = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session`);
    await new Promise((resolve) => client.once("open", resolve));

    const sessionMsg = await waitForMessage(client, (m) => m.type === "session_id");
    const sessionId: string = sessionMsg.session_id;

    await waitForMessage(client, (m) => m.type === "begin");
    await waitForMessage(client, (m) => m.type === "final" && m.turn_order === 0);

    // Mock server drops the connection after the scripted turn. Backend should
    // report "reconnecting" then succeed once a new mock server comes up on
    // the same port within the grace window.
    await waitForMessage(client, (m) => m.type === "reconnecting");

    mock.close();
    await new Promise((r) => setTimeout(r, 150));

    mock = startMockAssemblyAIServer(reconnectPort, {
      turns: [turn(1, "second turn after reconnect", true, 500, 900)],
      turnDelayMs: 20,
      idleAfterTurns: true,
    });

    await waitForMessage(client, (m) => m.type === "begin");

    // The reconnect succeeded (a fresh "begin" was received) — the session
    // must be back to "active" before the second mock's scripted Termination
    // arrives and completes it.
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe("active");

    await waitForMessage(client, (m) => m.type === "final" && m.turn_order === 1);

    const utterances = await prisma.utterance.findMany({ where: { sessionId }, orderBy: { turnOrder: "asc" } });
    expect(utterances.map((u) => u.turnOrder)).toEqual([0, 1]);

    client.close();
  });

  it("reports a hard failure (not a reconnect loop) when AssemblyAI is unreachable at connect time", async () => {
    nextMockPort(); // deliberately do not start a mock server on this port
    app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    appPort = address.port;

    const client = new WebSocket(`ws://127.0.0.1:${appPort}/ws/session`);
    await new Promise((resolve) => client.once("open", resolve));

    const messages: any[] = [];
    client.on("message", (data: Buffer) => messages.push(JSON.parse(data.toString())));

    const failedMsg = await waitForMessage(client, (m) => m.type === "failed");
    expect(failedMsg.type).toBe("failed");
    // Must never emit "reconnecting" for a connection that never succeeded once.
    expect(messages.some((m) => m.type === "reconnecting")).toBe(false);

    client.close();
  });
});
