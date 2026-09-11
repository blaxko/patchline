"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "../../../../lib/api";
import { useDashboardLive } from "../../../../lib/useDashboardLive";
import { EvidenceTimeline, type EvidenceEvent } from "../../../../components/dashboard/EvidenceTimeline";
import styles from "../../../../components/dashboard/Dashboard.module.css";

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

  if (notFound) return <p className={styles.muted}>Session not found.</p>;
  if (!detail) return <p className={styles.muted}>Loading…</p>;

  return (
    <div>
      <h1 className={styles.h1}>Session Detail</h1>
      <p className={styles.muted}>
        <span style={{ color: "#fcfcfc" }}>{detail.session.callerLabel}</span> — {detail.session.status} — config:{" "}
        {detail.session.activeConfig.name}
      </p>

      <h2 className={styles.h2}>Transcript</h2>
      <div className={styles.panel} style={{ marginBottom: 20 }}>
        {detail.utterances.map((u) => (
          <p key={u.id} style={{ margin: "4px 0" }}>
            <strong>{u.speaker}:</strong> {u.text}
          </p>
        ))}
        {detail.utterances.length === 0 && <p className={styles.muted}>No transcript yet.</p>}
      </div>

      <h2 className={styles.h2}>Entities</h2>
      <div style={{ marginBottom: 20 }}>
        {detail.entities.map((e) => (
          <span key={e.id} className={styles.entityChip}>
            {e.entityType}: {e.normalizedValue} ({e.verificationState})
          </span>
        ))}
      </div>

      <h2 className={styles.h2}>Evidence Timeline</h2>
      <EvidenceTimeline events={detail.events} sessionStartedAt={detail.session.startedAt} />
    </div>
  );
}
