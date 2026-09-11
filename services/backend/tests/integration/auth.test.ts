import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../../src/app.js";

// Exercises the real onRequest hook, which is normally a no-op under
// NODE_ENV=test (see auth/routes.ts) — deliberately overridden for just this
// file so the actual gating logic gets covered, then restored so no other
// test file in the same run is affected (fileParallelism:false keeps files
// sequential, not concurrent, so this is safe).
describe("Operator auth middleware (PRD.md §9 Step 13)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPassword = process.env.OPERATOR_PASSWORD;
  const originalSecret = process.env.SESSION_SECRET;

  beforeAll(() => {
    process.env.NODE_ENV = "integration-test-with-real-auth";
    process.env.OPERATOR_PASSWORD = "test-operator-password";
    process.env.SESSION_SECRET = "test-session-secret";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.OPERATOR_PASSWORD = originalPassword;
    process.env.SESSION_SECRET = originalSecret;
  });

  it("blocks an /api/* route with no token", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/configs" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("blocks an /api/* route with an invalid bearer token", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/configs",
      headers: { authorization: "Bearer garbage" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects login with the wrong password", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { password: "wrong" } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("allows an /api/* route after logging in with the correct password, via an Authorization header", async () => {
    const app = await buildServer();
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "test-operator-password" },
    });
    expect(loginRes.statusCode).toBe(200);
    const { token } = loginRes.json();
    expect(typeof token).toBe("string");

    const res = await app.inject({
      method: "GET",
      url: "/api/configs",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("also accepts the token as a ?token= query param, for the WS dashboard channel/<audio> src that can't set headers", async () => {
    const app = await buildServer();
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "test-operator-password" },
    });
    const { token } = loginRes.json();

    const res = await app.inject({ method: "GET", url: `/api/configs?token=${token}` });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("never gates the caller-facing /ws/session route", async () => {
    const app = await buildServer();
    // No websocket upgrade here, just confirming the auth hook itself
    // doesn't 401 this path before the route handler even runs.
    const res = await app.inject({ method: "GET", url: "/ws/session" });
    expect(res.statusCode).not.toBe(401);
    await app.close();
  });
});
