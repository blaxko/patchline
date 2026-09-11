"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "../../lib/api";
import { setToken } from "../../lib/authToken";

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
      router.push("/");
    } catch {
      setError("Incorrect password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 360, margin: "10vh auto" }}>
      <h1>Patchline — Operator Login</h1>
      <form onSubmit={submit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Operator password"
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
          autoFocus
        />
        <button type="submit" disabled={busy} style={{ width: "100%", padding: 8 }}>
          Log in
        </button>
      </form>
      {error && <p style={{ color: "#f84" }}>{error}</p>}
    </div>
  );
}
