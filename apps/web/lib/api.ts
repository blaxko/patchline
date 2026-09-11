import { clearToken, getToken } from "./authToken";

const BACKEND_HTTP_URL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
  }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(status: number): void {
  if (status === 401) clearToken();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  if (res.status === 401) {
    handleUnauthorized(res.status);
    throw new UnauthorizedError();
  }
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_HTTP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401) {
    handleUnauthorized(res.status);
    throw new UnauthorizedError();
  }
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

// The browser's native WebSocket API can't set an Authorization header on
// the handshake request, so the dashboard channel takes the token as a
// query param instead (auth/routes.ts's extractToken accepts either).
export function backendAuthedWsUrl(path: string): string {
  const token = getToken();
  const url = backendWsUrl(path);
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

// Same reasoning for plain resource loads (an <audio src>) that aren't a
// fetch() call the app controls.
export function backendAuthedResourceUrl(path: string): string {
  const token = getToken();
  const url = `${BACKEND_HTTP_URL}${path}`;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}
