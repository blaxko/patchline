import type { FastifyInstance } from "fastify";
import type { WebSocket as WsSocket } from "ws";
import { ulid } from "ulid";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { writeAuditEvent } from "../events.js";
import { AssemblyAIAdapter, type ConfigForAdapter } from "./assemblyaiAdapter.js";
import { getActiveConfig } from "./configMapping.js";
import { audioBufferStore } from "./audioBuffer.js";
import { extractEntitiesForUtterance } from "../reliability/extraction/index.js";
import { maybeAutoProposeToolCalls, executeTool } from "../reliability/autoTrigger.js";
import { hasPendingRepair, handleRepairTurn, clearPendingRepair } from "../reliability/repair/index.js";

type SessionStatus = "connecting" | "active" | "reconnecting" | "degraded" | "completed" | "failed";

interface SessionState {
  id: string;
  status: SessionStatus;
  config: ConfigForAdapter;
  adapter: AssemblyAIAdapter;
  browserWs: WsSocket;
  reconnectTimer: NodeJS.Timeout | null;
  reconnecting: boolean;
  hasBegun: boolean;
}

function send(ws: WsSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function wireAdapter(state: SessionState): Promise<void> {
  const { adapter, browserWs, id: sessionId } = state;

  // Prevent EventEmitter's special-cased "error" event from throwing when
  // unhandled — connect() failures already surface via its own rejected
  // promise, this just stops that same underlying error from also crashing
  // the process when the adapter re-emits it.
  adapter.on("error", () => {});

  adapter.on("begin", async () => {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    state.hasBegun = true;
    state.status = "active";
    await prisma.session.update({ where: { id: sessionId }, data: { status: "active" } });
    send(browserWs, { type: "begin" });
  });

  adapter.on("turn", async (msg: { end_of_turn: boolean; transcript: string; turn_order: number; end_of_turn_confidence: number; words: { start: number; end: number }[] }) => {
    if (!msg.end_of_turn) {
      await writeAuditEvent({
        eventType: "transcript.partial",
        actor: "system",
        resourceType: "session",
        resourceId: sessionId,
        payload: { transcript: msg.transcript, turn_order: msg.turn_order },
        correlationId: sessionId,
      });
      send(browserWs, { type: "partial", transcript: msg.transcript, turn_order: msg.turn_order });
      return;
    }

    const startMs = msg.words[0]?.start ?? 0;
    const endMs = msg.words[msg.words.length - 1]?.end ?? 0;
    const utteranceId = ulid();

    await prisma.utterance.create({
      data: {
        id: utteranceId,
        sessionId,
        speaker: "caller",
        text: msg.transcript,
        startMs,
        endMs,
        turnOrder: msg.turn_order,
        endOfTurnConfidence: msg.end_of_turn_confidence,
      },
    });

    await writeAuditEvent({
      eventType: "transcript.final",
      actor: "system",
      resourceType: "session",
      resourceId: sessionId,
      payload: { transcript: msg.transcript, turn_order: msg.turn_order, start_ms: startMs, end_ms: endMs },
      correlationId: sessionId,
    });

    send(browserWs, {
      type: "final",
      transcript: msg.transcript,
      turn_order: msg.turn_order,
      start_ms: startMs,
      end_ms: endMs,
    });

    // A turn while a repair question is outstanding is the caller's answer to
    // it, not a fresh statement to extract/gate from scratch (PRD.md §2.4).
    if (hasPendingRepair(sessionId)) {
      const repairResult = await handleRepairTurn(sessionId, msg.transcript, browserWs, executeTool);
      if (repairResult.toolResult) {
        send(browserWs, {
          type: repairResult.toolResult.allowed ? "action_allowed" : "action_blocked",
          tool_name: repairResult.toolResult.toolName,
          reason: repairResult.toolResult.reason,
          result: repairResult.toolResult.result ?? null,
        });
      }
      return;
    }

    // Sent after "final" so the browser already has a line for this turn_order
    // to attach markers to (PRD.md §9 Step 4: entity markers shown inline on
    // the transcript as they're detected).
    const detectedEntities = await extractEntitiesForUtterance({
      id: utteranceId,
      sessionId,
      text: msg.transcript,
      startMs,
      endMs,
    });
    for (const entity of detectedEntities) {
      send(browserWs, {
        type: "entity_detected",
        turn_order: msg.turn_order,
        entity_type: entity.entityType,
        raw_text: entity.rawText,
        normalized_value: entity.normalizedValue,
      });
    }

    const toolResults = await maybeAutoProposeToolCalls(sessionId, detectedEntities, browserWs);
    for (const toolResult of toolResults) {
      send(browserWs, {
        type: toolResult.allowed ? "action_allowed" : "action_blocked",
        tool_name: toolResult.toolName,
        reason: toolResult.reason,
        result: toolResult.result ?? null,
      });
    }
  });

  adapter.on("termination", async () => {
    await completeSession(state, "completed");
  });

  adapter.on("close", async () => {
    if (state.status === "completed" || state.status === "failed") return;
    // A close before the session ever reached "active" is the initial
    // connect() attempt failing — that path's own rejected promise (in
    // registerGateway) already handles it as a hard failure, not a
    // mid-call drop to recover from.
    if (!state.hasBegun) return;
    // A single dropped connection can surface as both an "error" and a "close"
    // event on the same underlying socket; only one reconnect loop may run at
    // a time per session, or duplicate loops would each reconnect and each
    // replay/duplicate the resulting transcript.
    if (state.reconnecting) return;
    state.reconnecting = true;

    state.status = "reconnecting";
    await prisma.session.update({ where: { id: sessionId }, data: { status: "reconnecting" } });
    send(browserWs, { type: "reconnecting" });

    const deadline = Date.now() + env.RECONNECT_GRACE_MS;
    const retryIntervalMs = Math.min(200, Math.max(50, env.RECONNECT_GRACE_MS / 10));

    const attempt = async (): Promise<void> => {
      if (state.status !== "reconnecting") {
        state.reconnecting = false;
        return; // superseded by degraded or completed
      }

      if (Date.now() >= deadline) {
        state.status = "degraded";
        state.reconnecting = false;
        await prisma.session.update({ where: { id: sessionId }, data: { status: "degraded" } });
        send(browserWs, { type: "degraded" });
        return;
      }

      try {
        const newAdapter = new AssemblyAIAdapter();
        state.adapter = newAdapter;
        await wireAdapter(state);
        await newAdapter.connect(state.config);
        // success: connection is open; the adapter's own "begin" handler
        // flips state.status back to "active" once AssemblyAI confirms.
        state.reconnecting = false;
      } catch {
        state.reconnectTimer = setTimeout(attempt, retryIntervalMs);
      }
    };

    void attempt();
  });
}

async function completeSession(state: SessionState, status: "completed" | "failed"): Promise<void> {
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  state.status = status;
  await prisma.session.update({ where: { id: state.id }, data: { status, endedAt: new Date() } });
  await writeAuditEvent({
    eventType: "session.completed",
    actor: "system",
    resourceType: "session",
    resourceId: state.id,
    payload: { status },
    correlationId: state.id,
  });
  send(state.browserWs, { type: "session_completed", status });
  audioBufferStore.clear(state.id);
  clearPendingRepair(state.id);
  state.adapter.close();
}

export function registerGateway(app: FastifyInstance): void {
  app.get("/ws/session", { websocket: true }, (socket) => {
    // Registered synchronously, before any async session setup below —
    // otherwise a client that starts sending mic audio the instant its WS
    // opens (as the real Call UI does) can have those very first frames
    // silently dropped, since a "message" listener attached only after an
    // await never sees events that arrived before it existed.
    const earlyAudioFrames: Buffer[] = [];
    let flushEarlyFrames: ((data: Buffer) => void) | null = null;
    socket.on("message", (data: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      if (flushEarlyFrames) {
        flushEarlyFrames(data);
      } else {
        earlyAudioFrames.push(data);
      }
    });

    void (async () => {
      const sessionId = ulid();
      const activeConfig = await getActiveConfig();

      await prisma.session.create({
        data: {
          id: sessionId,
          status: "connecting",
          activeConfigId: activeConfig.id,
          callerLabel: `Demo Caller ${sessionId.slice(-4)}`,
          mode: "live_mic",
        },
      });

      await writeAuditEvent({
        eventType: "session.started",
        actor: "system",
        resourceType: "session",
        resourceId: sessionId,
        payload: { active_config_id: activeConfig.id },
        correlationId: sessionId,
      });

      const adapter = new AssemblyAIAdapter();
      const state: SessionState = {
        id: sessionId,
        status: "connecting",
        config: activeConfig,
        adapter,
        browserWs: socket,
        reconnectTimer: null,
        reconnecting: false,
        hasBegun: false,
      };

      await wireAdapter(state);

      try {
        await adapter.connect(activeConfig);
      } catch (err) {
        state.status = "failed";
        await prisma.session.update({ where: { id: sessionId }, data: { status: "failed" } });
        send(socket, { type: "failed", reason: (err as Error).message });
        socket.close();
        return;
      }

      send(socket, { type: "session_id", session_id: sessionId });

      const handleAudioFrame = (data: Buffer) => {
        audioBufferStore.push(sessionId, data);
        adapter.sendAudio(data);
      };
      for (const frame of earlyAudioFrames) handleAudioFrame(frame);
      earlyAudioFrames.length = 0;
      flushEarlyFrames = handleAudioFrame;

      socket.on("close", async () => {
        if (state.status !== "completed" && state.status !== "failed") {
          adapter.terminate();
          await completeSession(state, "completed");
        }
      });
    })();
  });
}
