"use client";

import { useVoiceSession } from "../lib/useVoiceSession";

export function CallUI() {
  const { connected, lines, banner, sessionId, start, stop } = useVoiceSession();

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 640, margin: "2rem auto" }}>
      <h1>Patchline — Call UI</h1>
      <p>Session: {sessionId ?? "(not started)"}</p>

      {banner === "reconnecting" && (
        <div style={{ background: "#553", padding: 8, marginBottom: 8 }}>Reconnecting to speech service…</div>
      )}
      {banner === "degraded" && (
        <div style={{ background: "#733", padding: 8, marginBottom: 8 }}>
          Supervisor paused — speech service unavailable. Call continues in degraded mode.
        </div>
      )}

      <div>
        {!connected ? (
          <button onClick={() => void start()}>Start call</button>
        ) : (
          <button onClick={stop}>End call</button>
        )}
      </div>

      <div style={{ marginTop: 16, border: "1px solid #444", padding: 12, minHeight: 200 }}>
        {lines.length === 0 && <p style={{ opacity: 0.5 }}>Transcript will appear here…</p>}
        {lines
          .sort((a, b) => a.turnOrder - b.turnOrder)
          .map((line) => (
            <p key={line.turnOrder} style={{ opacity: line.final ? 1 : 0.5, fontStyle: line.final ? "normal" : "italic" }}>
              {line.text}
            </p>
          ))}
      </div>
    </div>
  );
}
