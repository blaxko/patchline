"use client";

import { useCallback, useRef, useState } from "react";

export type EntityMarker = {
  entityType: string;
  rawText: string;
  normalizedValue: string;
};

export type TranscriptLine = {
  turnOrder: number;
  text: string;
  final: boolean;
  entities: EntityMarker[];
};

export type SessionBanner = "reconnecting" | "degraded" | null;

// Drives the operator-facing status badge in CallUI. Distinct from the
// internal "connected" boolean, which only gates whether the dropdown/Start
// button are disabled — this is what makes idle vs connecting vs a call that
// ended normally vs one that failed outright visually distinguishable,
// rather than everything collapsing to "not connected" once the socket
// closes for any reason.
export type CallStatus = "idle" | "connecting" | "active" | "reconnecting" | "degraded" | "completed" | "failed";

export type ToolActivity = {
  toolName: string;
  allowed: boolean;
  reason: string | null;
};

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8080/ws/session";

export function useVoiceSession() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [banner, setBanner] = useState<SessionBanner>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [repairQuestion, setRepairQuestion] = useState<string | null>(null);
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (clipId?: string) => {
    // PRD.md §9 Step 15: a demo clip streams server-side through the same
    // Adapter code path as live mic input — the browser sends no audio at
    // all in this mode, so mic capture is skipped entirely.
    const wsUrl = clipId ? `${BACKEND_WS_URL}?clip=${encodeURIComponent(clipId)}` : BACKEND_WS_URL;

    setStatus("connecting");
    setLines([]);
    setToolActivity([]);
    setRepairQuestion(null);
    setSessionId(null);

    if (!clipId) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      await audioCtx.audioWorklet.addModule("/pcm-worklet.js");
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // A close that never got an explicit session_completed/failed message
      // from the server (network drop, tab closed mid-call) shouldn't leave
      // the badge stuck on "active" — treat it as a failure so the operator
      // always sees a definite end state.
      setStatus((prev) => (prev === "active" || prev === "connecting" || prev === "reconnecting" || prev === "degraded" ? "failed" : prev));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "session_id":
          setSessionId(msg.session_id);
          break;
        case "begin":
          setBanner(null);
          setStatus("active");
          break;
        case "partial":
          setLines((prev) =>
            upsertLine(prev, { turnOrder: msg.turn_order, text: msg.transcript, final: false, entities: [] }),
          );
          break;
        case "final":
          setLines((prev) =>
            upsertLine(prev, { turnOrder: msg.turn_order, text: msg.transcript, final: true, entities: [] }),
          );
          break;
        case "entity_detected":
          setLines((prev) =>
            prev.map((line) =>
              line.turnOrder === msg.turn_order
                ? {
                    ...line,
                    entities: [
                      ...line.entities,
                      { entityType: msg.entity_type, rawText: msg.raw_text, normalizedValue: msg.normalized_value },
                    ],
                  }
                : line,
            ),
          );
          break;
        case "action_allowed":
        case "action_blocked":
          setToolActivity((prev) => [
            ...prev,
            { toolName: msg.tool_name, allowed: msg.type === "action_allowed", reason: msg.reason ?? null },
          ]);
          if (msg.type === "action_allowed") setRepairQuestion(null);
          break;
        case "repair_question":
          setRepairQuestion(msg.text);
          break;
        case "repair_audio": {
          const bytes = Uint8Array.from(atob(msg.audio_base64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: `audio/${msg.format ?? "wav"}` });
          const audio = new Audio(URL.createObjectURL(blob));
          void audio.play().catch(() => {});
          break;
        }
        case "escalated":
          setRepairQuestion(null);
          break;
        case "reconnecting":
          setBanner("reconnecting");
          setStatus("reconnecting");
          break;
        case "degraded":
          setBanner("degraded");
          setStatus("degraded");
          break;
        case "session_completed":
          setConnected(false);
          setStatus("completed");
          break;
        case "failed":
          setConnected(false);
          setStatus("failed");
          break;
        default:
          break;
      }
    };

    if (!clipId && streamRef.current && audioCtxRef.current) {
      const source = audioCtxRef.current.createMediaStreamSource(streamRef.current);
      const worklet = new AudioWorkletNode(audioCtxRef.current, "pcm-worklet-processor");
      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };
      source.connect(worklet);
    }
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setConnected(false);
    setStatus("idle");
  }, []);

  return { connected, status, lines, banner, sessionId, repairQuestion, toolActivity, start, stop };
}

function upsertLine(prev: TranscriptLine[], next: TranscriptLine): TranscriptLine[] {
  const idx = prev.findIndex((l) => l.turnOrder === next.turnOrder);
  if (idx === -1) return [...prev, next];
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}
