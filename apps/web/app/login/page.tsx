"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "../../lib/api";
import { setToken } from "../../lib/authToken";
import styles from "../../components/dashboard/Dashboard.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await apiPost<{ ok: true; token: string }>("/api/auth/login", { password });
      setToken(token);
      router.push("/dashboard");
    } catch {
      setError("Incorrect password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div style={{ maxWidth: 360, margin: "0 auto", paddingTop: "12vh" }}>
        <h1 className={styles.h1}>Patchline — Operator Login</h1>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Operator password"
            className={styles.select}
            style={{ marginBottom: 12 }}
            autoFocus
          />
          <button type="submit" disabled={busy} className={`${styles.button} ${styles.buttonPrimary}`} style={{ width: "100%" }}>
            Log in
          </button>
        </form>
        {error && <p style={{ color: "#f37272", fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}
