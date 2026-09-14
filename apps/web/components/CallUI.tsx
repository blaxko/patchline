"use client";

import { useState } from "react";
import { useVoiceSession, type CallStatus } from "../lib/useVoiceSession";
import styles from "./dashboard/Dashboard.module.css";
import { Nav } from "./dashboard/Nav";

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
  idle: { label: "IDLE — ready to start", color: "#a3a3b3", bg: "rgba(163, 163, 179, 0.12)" },
  connecting: { label: "CONNECTING…", color: "#f3c772", bg: "rgba(255, 200, 100, 0.12)" },
  active: { label: "● ACTIVE", color: "#6199f6", bg: "rgba(97, 153, 246, 0.12)" },
  reconnecting: { label: "RECONNECTING…", color: "#f3c772", bg: "rgba(255, 200, 100, 0.12)" },
  degraded: { label: "DEGRADED — speech service unavailable", color: "#f37272", bg: "rgba(243, 114, 114, 0.12)" },
  completed: { label: "COMPLETED", color: "#6199f6", bg: "rgba(97, 153, 246, 0.12)" },
  failed: { label: "FAILED", color: "#f37272", bg: "rgba(243, 114, 114, 0.12)" },
};

export function CallUI() {
  const { connected, status, lines, banner, sessionId, repairQuestion, toolActivity, start, stop } =
    useVoiceSession();
  const [selectedClip, setSelectedClip] = useState("");

  const busy = status === "connecting";
  const statusInfo = STATUS_DISPLAY[status];

  return (
    <div className={styles.shell}>
      <Nav />
      <div className={styles.content} style={{ maxWidth: 640 }}>
        <h1 className={styles.h1}>Patchline — Call UI</h1>

        <div
          style={{
            display: "inline-block",
            background: statusInfo.bg,
            color: statusInfo.color,
            fontWeight: 600,
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: 100,
            marginBottom: 8,
          }}
        >
          {statusInfo.label}
        </div>

        {sessionId && <p className={styles.muted} style={{ fontSize: 12, margin: "4px 0 12px" }}>Session ID: {sessionId}</p>}
        {!sessionId && <div style={{ marginBottom: 12 }} />}

        {banner === "reconnecting" && (
          <div className={styles.banner} style={{ background: "rgba(255, 200, 100, 0.12)", color: "#f3c772" }}>
            Reconnecting to speech service…
          </div>
        )}
        {banner === "degraded" && (
          <div className={styles.banner} style={{ background: "rgba(243, 114, 114, 0.12)", color: "#f37272" }}>
            Supervisor paused — speech service unavailable. Call continues in degraded mode.
          </div>
        )}

        {repairQuestion && (
          <div
            className={styles.banner}
            style={{ background: "rgba(97, 153, 246, 0.1)", border: "1px solid #4f4f80", color: "#fcfcfc" }}
          >
            <strong>Supervisor asks:</strong> {repairQuestion}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label className={styles.label}>1. Choose a scenario:</label>
          <select
            value={selectedClip}
            onChange={(e) => setSelectedClip(e.target.value)}
            disabled={connected || busy}
            className={styles.select}
          >
            {CLIP_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label className={styles.label}>2. Start it:</label>
          {!connected ? (
            <button
              onClick={() => void start(selectedClip || undefined)}
              disabled={busy}
              className={`${styles.button} ${styles.buttonPrimary}`}
              style={{ fontSize: 15, padding: "12px 28px" }}
            >
              {busy ? "Connecting…" : "▶ Start Call"}
            </button>
          ) : (
            <button
              onClick={stop}
              className={`${styles.button} ${styles.buttonDanger}`}
              style={{ fontSize: 15, padding: "12px 28px" }}
            >
              ■ End Call
            </button>
          )}
        </div>

        {toolActivity.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            {toolActivity.map((t, i) => (
              <div key={i} style={{ color: t.allowed ? "#6199f6" : "#f37272" }}>
                {t.allowed ? "ALLOWED" : "BLOCKED"}: {t.toolName}
                {t.reason ? ` (${t.reason})` : ""}
              </div>
            ))}
          </div>
        )}

        <div className={styles.panel} style={{ marginTop: 16, minHeight: 200 }}>
          {lines.length === 0 && <p className={styles.muted}>Transcript will appear here…</p>}
          {lines
            .sort((a, b) => a.turnOrder - b.turnOrder)
            .map((line) => (
              <div key={line.turnOrder} style={{ marginBottom: 8 }}>
                <p
                  style={{
                    opacity: line.final ? 1 : 0.6,
                    fontStyle: line.final ? "normal" : "italic",
                    margin: 0,
                    color: "#fcfcfc",
                  }}
                >
                  {line.text}
                </p>
                {line.entities.length > 0 && (
                  <p style={{ margin: "2px 0 0" }}>
                    {line.entities.map((e, i) => (
                      <span key={i} className={styles.entityChip}>
                        {e.entityType}: {e.normalizedValue}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
