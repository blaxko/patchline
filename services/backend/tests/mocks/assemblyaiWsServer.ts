import { WebSocketServer, WebSocket } from "ws";
import type { AaiTurnMessage } from "../../src/realtime/assemblyaiAdapter.js";

export interface MockScript {
  turns: AaiTurnMessage[];
  turnDelayMs?: number;
  /** If true, drop the connection abruptly after the scripted turns instead of sending Termination. */
  dropConnection?: boolean;
  /** If true, do nothing after the scripted turns (no Termination, no drop) — for tests that assert mid-session state. */
  idleAfterTurns?: boolean;
}

export type ScriptOrFn = MockScript | ((requestUrl: URL) => MockScript);

export function startMockAssemblyAIServer(port: number, scriptOrFn: ScriptOrFn): { close: () => void } {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws: WebSocket, request) => {
    // Config-aware tests (Step 8 replay) can vary the scripted transcript
    // based on the connecting adapter's query params, simulating a candidate
    // config that actually transcribes better.
    const requestUrl = new URL(request.url ?? "/", `http://localhost:${port}`);
    const script = typeof scriptOrFn === "function" ? scriptOrFn(requestUrl) : scriptOrFn;

    ws.send(JSON.stringify({ type: "Begin", id: "mock-session", expires_at: Date.now() + 60_000 }));

    let i = 0;
    const delay = script.turnDelayMs ?? 20;

    const sendNext = () => {
      if (i >= script.turns.length) {
        if (script.idleAfterTurns) {
          return;
        } else if (script.dropConnection) {
          // Simulate a genuine outage: close the whole listening server, not
          // just this one client socket — otherwise an immediate reconnect
          // attempt would land right back on this same server and replay the
          // script from the top.
          ws.terminate();
          wss.close();
        } else {
          ws.send(
            JSON.stringify({
              type: "Termination",
              audio_duration_seconds: 1,
              session_duration_seconds: 1,
            }),
          );
        }
        return;
      }
      ws.send(JSON.stringify(script.turns[i]));
      i++;
      setTimeout(sendNext, delay);
    };

    setTimeout(sendNext, delay);

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Terminate") {
          ws.send(
            JSON.stringify({ type: "Termination", audio_duration_seconds: 1, session_duration_seconds: 1 }),
          );
          ws.close();
        }
      } catch {
        // ignore
      }
    });
  });

  return {
    close: () => {
      wss.close();
    },
  };
}
