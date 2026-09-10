"use client";

import { useVoiceSession } from "../lib/useVoiceSession";

export function CallUI() {
  const { connected, lines, banner, sessionId, repairQuestion, toolActivity, start, stop } = useVoiceSession();

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

      {repairQuestion && (
        <div style={{ background: "#432", padding: 8, marginBottom: 8, border: "1px solid #a80" }}>
          <strong>Supervisor asks:</strong> {repairQuestion}
        </div>
      )}

      <div>
        {!connected ? (
          <button onClick={() => void start()}>Start call</button>
        ) : (
          <button onClick={stop}>End call</button>
        )}
      </div>

      {toolActivity.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          {toolActivity.map((t, i) => (
            <div key={i} style={{ color: t.allowed ? "#8f8" : "#f88" }}>
              {t.allowed ? "ALLOWED" : "BLOCKED"}: {t.toolName}
              {t.reason ? ` (${t.reason})` : ""}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #444", padding: 12, minHeight: 200 }}>
        {lines.length === 0 && <p style={{ opacity: 0.5 }}>Transcript will appear here…</p>}
        {lines
          .sort((a, b) => a.turnOrder - b.turnOrder)
          .map((line) => (
            <div key={line.turnOrder} style={{ marginBottom: 8 }}>
              <p
                style={{ opacity: line.final ? 1 : 0.5, fontStyle: line.final ? "normal" : "italic", margin: 0 }}
              >
                {line.text}
              </p>
              {line.entities.length > 0 && (
                <p style={{ margin: "2px 0 0", fontSize: 12 }}>
                  {line.entities.map((e, i) => (
                    <span
                      key={i}
                      style={{
                        background: "#264",
                        color: "#cfc",
                        borderRadius: 4,
                        padding: "1px 6px",
                        marginRight: 4,
                      }}
                    >
                      {e.entityType}: {e.normalizedValue}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
