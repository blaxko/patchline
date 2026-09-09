"use client";

import { useCallback, useRef, useState } from "react";

export type TranscriptLine = {
  turnOrder: number;
  text: string;
  final: boolean;
};

export type SessionBanner = "reconnecting" | "degraded" | null;

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8080/ws/session";

export function useVoiceSession() {
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [banner, setBanner] = useState<SessionBanner>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    await audioCtx.audioWorklet.addModule("/pcm-worklet.js");

    const ws = new WebSocket(BACKEND_WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "session_id":
          setSessionId(msg.session_id);
          break;
        case "begin":
          setBanner(null);
          break;
        case "partial":
          setLines((prev) => upsertLine(prev, { turnOrder: msg.turn_order, text: msg.transcript, final: false }));
          break;
        case "final":
          setLines((prev) => upsertLine(prev, { turnOrder: msg.turn_order, text: msg.transcript, final: true }));
          break;
        case "reconnecting":
          setBanner("reconnecting");
          break;
        case "degraded":
          setBanner("degraded");
          break;
        case "session_completed":
        case "failed":
          setConnected(false);
          break;
        default:
          break;
      }
    };

    const source = audioCtx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(audioCtx, "pcm-worklet-processor");
    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };
    source.connect(worklet);
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setConnected(false);
  }, []);

  return { connected, lines, banner, sessionId, start, stop };
}

function upsertLine(prev: TranscriptLine[], next: TranscriptLine): TranscriptLine[] {
  const idx = prev.findIndex((l) => l.turnOrder === next.turnOrder);
  if (idx === -1) return [...prev, next];
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}
