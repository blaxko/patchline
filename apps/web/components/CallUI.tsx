"use client";

import { useState } from "react";
import { useVoiceSession, type CallStatus } from "../lib/useVoiceSession";

// PRD.md §9 Step 15: clip picker (Live Mic / demo clips, matching
// fixtures/audio/demo/manifest.json). "" means live mic. Kept as a static
// list (not fetched from GET /api/demo/clips) since that route sits behind
// operator auth and this page must work for a judge who isn't logged in —
// keep this in sync with the manifest by hand when clips change.
const CLIP_OPTIONS = [
  { id: "", label: "Live Mic (Call A — clean success)" },
  { id: "brk_known_failure", label: "Demo Clip: BRK-71Q9 known failure (Call B)" },
  { id: "zxa_known_failure", label: "Demo Clip: ZXA-4B8K repair (Call B2 — promotes the fix)" },
  { id: "zxa_post_fix", label: "Demo Clip: ZXA-4B8K post-fix (Call C — first-pass success)" },
];

const STATUS_DISPLAY: Record<CallStatus, { label: string; color: string; bg: string }> = {
  idle: { label: "IDLE — ready to start", color: "#aaa", bg: "#333" },
  connecting: { label: "CONNECTING…", color: "#fd6", bg: "#553" },
  active: { label: "● ACTIVE", color: "#8f8", bg: "#264" },
  reconnecting: { label: "RECONNECTING…", color: "#fd6", bg: "#553" },
  degraded: { label: "DEGRADED — speech service unavailable", color: "#f88", bg: "#733" },
  completed: { label: "COMPLETED", color: "#8cf", bg: "#335" },
  failed: { label: "FAILED", color: "#f88", bg: "#733" },
};

export function CallUI() {
  const { connected, status, lines, banner, sessionId, repairQuestion, toolActivity, start, stop } =
    useVoiceSession();
  const [selectedClip, setSelectedClip] = useState("");

  const busy = status === "connecting";
  const statusInfo = STATUS_DISPLAY[status];

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 640, margin: "2rem auto" }}>
      <h1>Patchline — Call UI</h1>

      <div
        style={{
          display: "inline-block",
          background: statusInfo.bg,
          color: statusInfo.color,
          fontWeight: 700,
          padding: "6px 14px",
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        {statusInfo.label}
      </div>

      {sessionId && (
        <p style={{ opacity: 0.6, fontSize: 12, margin: "4px 0 12px" }}>Session ID: {sessionId}</p>
      )}
      {!sessionId && <div style={{ marginBottom: 12 }} />}

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

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          1. Choose a scenario:
        </label>
        <select
          value={selectedClip}
          onChange={(e) => setSelectedClip(e.target.value)}
          disabled={connected || busy}
          style={{ fontFamily: "monospace", fontSize: 14, padding: 6, width: "100%" }}
        >
          {CLIP_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          2. Start it:
        </label>
        {!connected ? (
          <button
            onClick={() => void start(selectedClip || undefined)}
            disabled={busy}
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 700,
              padding: "12px 28px",
              background: busy ? "#456" : "#2a6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Connecting…" : "▶ Start Call"}
          </button>
        ) : (
          <button
            onClick={stop}
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 700,
              padding: "12px 28px",
              background: "#a33",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ■ End Call
          </button>
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
