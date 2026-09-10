"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { useDashboardLive } from "../../../../lib/useDashboardLive";
import { EvidenceTimeline, type EvidenceEvent } from "../../../../components/dashboard/EvidenceTimeline";

interface SessionDetail {
  session: { id: string; status: string; startedAt: string; callerLabel: string; activeConfig: { name: string } };
  utterances: { id: string; speaker: string; text: string; turnOrder: number }[];
  entities: { id: string; entityType: string; normalizedValue: string; verificationState: string }[];
  events: EvidenceEvent[];
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(() => {
    apiGet<SessionDetail>(`/api/sessions/${params.id}`)
      .then(setDetail)
      .catch(() => setNotFound(true));
  }, [params.id]);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  if (notFound) return <p>Session not found.</p>;
  if (!detail) return <p>Loading…</p>;

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h1>Session Detail</h1>
      <p>
        {detail.session.callerLabel} — <span style={{ opacity: 0.7 }}>{detail.session.status}</span> — config:{" "}
        {detail.session.activeConfig.name}
      </p>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Transcript</h2>
      <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, marginBottom: 20 }}>
        {detail.utterances.map((u) => (
          <p key={u.id} style={{ margin: "4px 0" }}>
            <strong>{u.speaker}:</strong> {u.text}
          </p>
        ))}
        {detail.utterances.length === 0 && <p style={{ opacity: 0.5 }}>No transcript yet.</p>}
      </div>

      <h2 style={{ fontSize: 15 }}>Entities</h2>
      <div style={{ marginBottom: 20 }}>
        {detail.entities.map((e) => (
          <span
            key={e.id}
            style={{ display: "inline-block", background: "#223", borderRadius: 4, padding: "2px 8px", marginRight: 6, marginBottom: 6, fontSize: 12 }}
          >
            {e.entityType}: {e.normalizedValue} ({e.verificationState})
          </span>
        ))}
      </div>

      <h2 style={{ fontSize: 15 }}>Evidence Timeline</h2>
      <EvidenceTimeline events={detail.events} sessionStartedAt={detail.session.startedAt} />
    </div>
  );
}
