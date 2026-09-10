"use client";

import { useEffect, useRef, useState } from "react";
import { backendWsUrl } from "./api";

/**
 * Subscribes to the dashboard WS channel (PRD.md §8/§9 Step 11) and calls
 * `onEvent` for every push. If the WS drops, falls back to polling
 * `onEvent` every 3s until it reconnects — per the step's own error-case
 * spec, the dashboard never shows a blank screen while reconnecting.
 */
export function useDashboardLive(onEvent: () => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => onEventRef.current(), 3000);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(backendWsUrl("/ws/dashboard"));
      ws.onopen = () => {
        setConnected(true);
        stopPolling();
      };
      ws.onmessage = () => onEventRef.current();
      ws.onclose = () => {
        setConnected(false);
        startPolling();
        if (!stopped) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      stopped = true;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { connected };
}
