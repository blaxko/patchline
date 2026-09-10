import { describe, it, expect, vi } from "vitest";
import { createSessionToken, verifySessionToken, parseCookies } from "../../src/auth/session.js";

describe("session token signing (SECURITY.md operator auth)", () => {
  it("a freshly created token verifies as valid", () => {
    const token = createSessionToken("test-secret");
    expect(verifySessionToken(token, "test-secret")).toBe(true);
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = createSessionToken("secret-a");
    expect(verifySessionToken(token, "secret-b")).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken("test-secret");
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 999_999_999 })).toString("base64url");
    expect(verifySessionToken(`${tamperedPayload}.${signature}`, "test-secret")).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(verifySessionToken(undefined, "test-secret")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-real-token", "test-secret")).toBe(false);
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken("test-secret");
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z")); // >12h later
    expect(verifySessionToken(token, "test-secret")).toBe(false);
    vi.useRealTimers();
  });
});

describe("parseCookies", () => {
  it("parses a single cookie", () => {
    expect(parseCookies("patchline_session=abc123")).toEqual({ patchline_session: "abc123" });
  });

  it("parses multiple cookies", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("returns an empty object for a missing header", () => {
    expect(parseCookies(undefined)).toEqual({});
  });
});
