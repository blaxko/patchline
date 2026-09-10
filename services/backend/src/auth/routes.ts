import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSessionToken, verifySessionToken, parseCookies, SESSION_COOKIE_NAME } from "./session.js";

const loginBodySchema = z.object({ password: z.string() });

const PUBLIC_PATHS = new Set(["/api/auth/login", "/ws/session"]);

// Deployed frontend and backend live on different origins (e.g. separate
// Railway services), which makes this a cross-site request from the
// cookie's point of view. SameSite=Lax (fine for same-origin local dev,
// where frontend and backend share http://localhost) silently drops the
// cookie on cross-site fetch/XHR calls — the login POST would still appear
// to succeed, but every subsequent /api/* call would 401. SameSite=None
// requires Secure, which in turn requires HTTPS — true for both platforms'
// public URLs, never true for local http://localhost, hence the branch.
function cookieAttributes(): string {
  const cross = process.env.NODE_ENV === "production";
  return cross ? "HttpOnly; SameSite=None; Secure; Path=/" : "HttpOnly; SameSite=Lax; Path=/";
}

/**
 * OPERATOR_PASSWORD -> signed httpOnly session cookie, gating every /api/*
 * route and the /ws/dashboard channel (SECURITY.md "Operator authentication").
 * The caller-facing /ws/session route is deliberately NOT gated — that's the
 * public voice-call endpoint, not an operator control.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  const operatorPassword = process.env.OPERATOR_PASSWORD ?? "";
  const sessionSecret = process.env.SESSION_SECRET ?? "";

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_BODY" });
    }

    if (!operatorPassword || parsed.data.password !== operatorPassword) {
      return reply.code(401).send({ error: "INVALID_PASSWORD" });
    }

    const token = createSessionToken(sessionSecret);
    reply.header("Set-Cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes()}; Max-Age=43200`);
    return reply.send({ ok: true });
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.header("Set-Cookie", `${SESSION_COOKIE_NAME}=; ${cookieAttributes()}; Max-Age=0`);
    return reply.send({ ok: true });
  });

  app.addHook("onRequest", async (request, reply) => {
    // Auth is off when no password is configured (dev/test convenience — "no
    // default password shipped" per SECURITY.md; the boot-time check in
    // server.ts is what actually enforces this is set in production), and
    // always off under the test runner regardless of ambient .env state
    // (Prisma Client auto-loads .env, which could otherwise leak a real
    // OPERATOR_PASSWORD into test runs and make them environment-dependent).
    if (!operatorPassword || process.env.NODE_ENV === "test") return;

    const path = request.url.split("?")[0];
    const isGated = path.startsWith("/api/") || path === "/ws/dashboard";
    if (!isGated || PUBLIC_PATHS.has(path)) return;

    const cookies = parseCookies(request.headers.cookie);
    if (!verifySessionToken(cookies[SESSION_COOKIE_NAME], sessionSecret)) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
