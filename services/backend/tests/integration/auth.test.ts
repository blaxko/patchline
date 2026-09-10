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

  it("blocks an /api/* route with no cookie", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/configs" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("blocks an /api/* route with an invalid cookie", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/api/configs",
      headers: { cookie: "patchline_session=garbage" },
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

  it("allows an /api/* route after logging in with the correct password", async () => {
    const app = await buildServer();
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "test-operator-password" },
    });
    expect(loginRes.statusCode).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    expect(setCookie).toBeTruthy();
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookieValue = (cookie as string).split(";")[0];

    const res = await app.inject({ method: "GET", url: "/api/configs", headers: { cookie: cookieValue } });
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
