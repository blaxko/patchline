const BACKEND_HTTP_URL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error ?? `POST ${path} failed: ${res.status}`) as Error & { detail?: unknown; reason?: string };
    err.detail = data.detail;
    err.reason = data.reason;
    throw err;
  }
  return data as T;
}

export function backendWsUrl(path: string): string {
  const httpUrl = new URL(BACKEND_HTTP_URL);
  const proto = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${httpUrl.host}${path}`;
}
