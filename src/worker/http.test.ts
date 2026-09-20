import { describe, expect, it } from "vitest";
import { getCorsHeaders, getSafeReturnTo, isAdminRequest, jsonResponse, type HttpEnv } from "./http";

const env: HttpEnv = {
  ADMIN_EMAILS: "owner@demo-restaurant.com, second@demo-restaurant.com",
  ALLOWED_ORIGINS: "http://localhost:5173,https://demo-restaurant.com,https://staging.demo-restaurant.com",
};

function requestWith(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("getCorsHeaders", () => {
  it("echoes an allowed origin with credentials", () => {
    const headers = getCorsHeaders(requestWith("https://demo-restaurant.com/api/menu", { origin: "https://demo-restaurant.com" }), env);

    expect(headers["access-control-allow-origin"]).toBe("https://demo-restaurant.com");
    expect(headers["access-control-allow-credentials"]).toBe("true");
    expect(headers.vary).toBe("Origin");
  });

  it("returns only a vary header for unknown or missing origins", () => {
    expect(getCorsHeaders(requestWith("https://demo-restaurant.com/api/menu", { origin: "https://evil.example.com" }), env)).toEqual({ vary: "Origin" });
    expect(getCorsHeaders(requestWith("https://demo-restaurant.com/api/menu"), env)).toEqual({ vary: "Origin" });
  });
});

describe("getSafeReturnTo", () => {
  it("keeps returnTo urls on allowed origins", () => {
    const request = requestWith(`https://demo-restaurant.com/api/admin/sign-in?returnTo=${encodeURIComponent("https://staging.demo-restaurant.com/admin?tab=menu")}`);

    expect(getSafeReturnTo(request, env)).toBe("https://staging.demo-restaurant.com/admin?tab=menu");
  });

  it("falls back to the production admin url for foreign origins", () => {
    const request = requestWith(`https://demo-restaurant.com/api/admin/sign-in?returnTo=${encodeURIComponent("https://evil.example.com/admin")}`);

    expect(getSafeReturnTo(request, env)).toBe("https://demo-restaurant.com/admin");
  });

  it("falls back for invalid urls and missing returnTo", () => {
    expect(getSafeReturnTo(requestWith("https://demo-restaurant.com/api/admin/sign-in?returnTo=not-a-url"), env)).toBe("https://demo-restaurant.com/admin");
    expect(getSafeReturnTo(requestWith("https://demo-restaurant.com/api/admin/sign-in"), env)).toBe("https://demo-restaurant.com/admin");
  });
});

describe("isAdminRequest", () => {
  it("accepts allowed Access emails case-insensitively", () => {
    const request = requestWith("https://demo-restaurant.com/api/admin/menu/draft", { "cf-access-authenticated-user-email": "Owner@Demo-Restaurant.com" });

    expect(isAdminRequest(request, env)).toBe(true);
  });

  it("rejects unknown or missing Access emails", () => {
    expect(isAdminRequest(requestWith("https://demo-restaurant.com/api/admin/menu/draft", { "cf-access-authenticated-user-email": "intruder@example.com" }), env)).toBe(false);
    expect(isAdminRequest(requestWith("https://demo-restaurant.com/api/admin/menu/draft"), env)).toBe(false);
  });

  it("rejects everything when no admin emails are configured", () => {
    const request = requestWith("https://demo-restaurant.com/api/admin/menu/draft", { "cf-access-authenticated-user-email": "owner@demo-restaurant.com" });

    expect(isAdminRequest(request, { ...env, ADMIN_EMAILS: " " })).toBe(false);
  });
});

describe("jsonResponse", () => {
  it("merges json, cors, and custom headers", async () => {
    const response = jsonResponse({ ok: true }, { status: 201, headers: { "cache-control": "no-store" } }, { vary: "Origin" });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Origin");
    expect(await response.json()).toEqual({ ok: true });
  });
});
