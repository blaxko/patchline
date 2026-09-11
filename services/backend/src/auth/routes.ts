import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createSessionToken, verifySessionToken } from "./session.js";

const loginBodySchema = z.object({ password: z.string() });

const PUBLIC_PATHS = new Set(["/api/auth/login", "/ws/session"]);

// Real Safari bug found post-deploy: frontend and backend live on different
// Railway subdomains, making the old session cookie cross-site from the
// browser's point of view. Even with SameSite=None; Secure, Safari's
// Intelligent Tracking Prevention can still block or evict a just-set
// cross-site cookie outright — the login POST appeared to succeed, but the
// very next request had no cookie at all, bouncing straight back to
// /login in a loop. Chrome/Firefox don't apply this restriction, which is
// why it only ever showed up on iPhone Safari.
//
// Fix: stop relying on the browser to auto-attach anything cross-site.
// The signed token (same createSessionToken/verifySessionToken as before —
// only the transport changed) is returned in the login response body, the
// frontend stores it itself (localStorage) and sends it back explicitly as
// an `Authorization: Bearer <token>` header. ITP only targets cookies; a
// token in a request header or a JSON response body isn't cookie storage
// at all, so this failure mode can't recur regardless of how Safari's ITP
// heuristics evolve.
//
// The one exception is /ws/dashboard: the browser's native WebSocket API
// cannot set custom headers on the handshake request, so that connection
// (and, for the same reason, any <audio>/<img>-style plain resource fetch)
// passes the token as a `?token=` query param instead. Scoped to this
// hackathon's single-shared-operator-password trust model (SECURITY.md) —
// a token in a URL can end up in server logs, which would be worth
// tightening before any real multi-tenant use.
function extractToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);

  const queryToken = (request.query as Record<string, unknown> | undefined)?.token;
  return typeof queryToken === "string" ? queryToken : undefined;
}

/**
 * OPERATOR_PASSWORD -> signed bearer token, gating every /api/* route and
 * the /ws/dashboard channel (SECURITY.md "Operator authentication"). The
 * caller-facing /ws/session route is deliberately NOT gated — that's the
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
    return reply.send({ ok: true, token });
  });

  // Stateless token (nothing server-side to revoke, same as when this was a
  // signed cookie) — kept for API shape parity; the frontend's own "logout"
  // is just deleting the token from localStorage.
  app.post("/api/auth/logout", async (_request, reply) => {
    return reply.send({ ok: true });
  });

  app.addHook("onRequest", async (request, reply) => {
    // Auth is off when no password is configured (dev/test convenience — "no
    // default password shipped" per SECURITY.md; the boot-time check in
    // server.ts is what actually enforces this is set in production),
    // always off under the test runner regardless of ambient .env state
    // (Prisma Client auto-loads .env, which could otherwise leak a real
    // OPERATOR_PASSWORD into test runs and make them environment-dependent),
    // and explicitly off when DISABLE_AUTH=1 — a judge-facing deploy with no
    // login wall by deliberate request, not a fallback for a misconfigured
    // production env (see server.ts's boot-time check, which still refuses
    // to start on a missing password unless this same flag is set).
    if (!operatorPassword || process.env.DISABLE_AUTH === "1" || process.env.NODE_ENV === "test") return;

    const path = request.url.split("?")[0];
    const isGated = path.startsWith("/api/") || path === "/ws/dashboard";
    if (!isGated || PUBLIC_PATHS.has(path)) return;

    if (!verifySessionToken(extractToken(request), sessionSecret)) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
