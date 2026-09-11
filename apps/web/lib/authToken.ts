const STORAGE_KEY = "patchline_operator_token";

// localStorage instead of a cookie, deliberately — see auth/routes.ts for
// why (Safari ITP blocks/evicts cross-site cookies between the frontend and
// backend's separate Railway subdomains; a token the frontend reads and
// sends itself sidesteps that class of bug entirely, since it was never
// cookie storage to begin with). Guarded for SSR: these run in "use client"
// components, but Next can still evaluate the module server-side once.
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
