import { describe, expect, it, vi } from "vitest";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getAdminIdentity,
  getAdminSessionInfo,
  getSessionSigningKey,
  hashPassword,
  isTrustedOrigin,
  loginWithPassword,
  parsePasswordHash,
  readCookie,
  resolveAdminAuthStrategy,
  SESSION_COOKIE_NAME,
  timingSafeEqual,
  verifyPassword,
  verifySessionToken,
  type AuthEnv,
} from "./auth";

const secret = "0123456789abcdef0123456789abcdef";
const origins = "http://localhost:5173,https://demo-restaurant.com";

function loginRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://demo-restaurant.com/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("resolveAdminAuthStrategy", () => {
  it("prefers the explicit ADMIN_AUTH value", () => {
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins, ADMIN_AUTH: "access", ADMIN_PASSWORD_HASH: "x" })).toBe("access");
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins, ADMIN_AUTH: "none", ADMIN_EMAILS: "a@b.c" })).toBe("none");
  });

  it("infers password when a hash is set, access when emails are set, none otherwise", () => {
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins, ADMIN_PASSWORD_HASH: "x", ADMIN_EMAILS: "a@b.c" })).toBe("password");
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins, ADMIN_EMAILS: "a@b.c" })).toBe("access");
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins, ADMIN_EMAILS: " , " })).toBe("none");
    expect(resolveAdminAuthStrategy({ ALLOWED_ORIGINS: origins })).toBe("none");
  });
});

describe("password hashing", () => {
  it("round-trips a password through hash and verify", async () => {
    const encoded = await hashPassword("correct horse battery staple", 1000);

    expect(encoded.startsWith("pbkdf2-sha256$1000$")).toBe(true);
    expect(parsePasswordHash(encoded)?.iterations).toBe(1000);
    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("correct horse battery stapl", encoded)).resolves.toBe(false);
    await expect(verifyPassword("", encoded)).resolves.toBe(false);
  });

  it("uses a fresh salt per hash", async () => {
    const first = await hashPassword("same", 500);
    const second = await hashPassword("same", 500);
    expect(first).not.toBe(second);
  });

  it("rejects malformed or unsafe hash strings", async () => {
    expect(parsePasswordHash("bcrypt$10$abc$def")).toBeNull();
    expect(parsePasswordHash("pbkdf2-sha256$abc$salt$hash")).toBeNull();
    expect(parsePasswordHash("pbkdf2-sha256$99999999$salt$hash")).toBeNull();
    expect(parsePasswordHash("pbkdf2-sha256$1000$salt")).toBeNull();
    await expect(verifyPassword("anything", "garbage")).resolves.toBe(false);
  });

  it("compares byte arrays in a length-safe way", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });
});

describe("session tokens", () => {
  it("signs and verifies a token", async () => {
    const token = await createSessionToken(secret, "owner", 3600, 1_000_000_000);
    const payload = await verifySessionToken(secret, token, 1_000_000_000 + 60_000);

    expect(payload).toEqual({ sub: "owner", iat: 1_000_000, exp: 1_000_000 + 3600 });
  });

  it("rejects expired, tampered, and foreign-secret tokens", async () => {
    const token = await createSessionToken(secret, "owner", 60, 1_000_000_000);

    await expect(verifySessionToken(secret, token, 1_000_000_000 + 61_000)).resolves.toBeNull();
    await expect(verifySessionToken("another-secret-another-secret", token, 1_000_000_000)).resolves.toBeNull();

    const [version, payload, signature] = token.split(".");
    const forgedPayload = payload.slice(0, -2) + (payload.endsWith("AA") ? "BB" : "AA");
    await expect(verifySessionToken(secret, `${version}.${forgedPayload}.${signature}`, 1_000_000_000)).resolves.toBeNull();
    await expect(verifySessionToken(secret, "v0.x.y", 1_000_000_000)).resolves.toBeNull();
    await expect(verifySessionToken(secret, "", 1_000_000_000)).resolves.toBeNull();
  });
});

describe("cookies", () => {
  it("reads the session cookie among others", () => {
    const request = new Request("https://demo-restaurant.com/api/admin/menu/draft", {
      headers: { cookie: `theme=dark; ${SESSION_COOKIE_NAME}=v1.a.b=c; other=1` },
    });

    expect(readCookie(request, SESSION_COOKIE_NAME)).toBe("v1.a.b=c");
    expect(readCookie(request, "missing")).toBeNull();
  });

  it("marks cookies Secure on https only", () => {
    const https = new Request("https://demo-restaurant.com/api/admin/login");
    const http = new Request("http://localhost:8787/api/admin/login");

    expect(buildSessionCookie(https, "tok", 60)).toBe(`${SESSION_COOKIE_NAME}=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure`);
    expect(buildSessionCookie(http, "tok", 60)).not.toContain("Secure");
    expect(buildClearedSessionCookie(https)).toContain("Max-Age=0");
  });
});

describe("isTrustedOrigin", () => {
  const env = { ALLOWED_ORIGINS: origins };

  it("accepts missing, same-origin, and allowed origins", () => {
    expect(isTrustedOrigin(new Request("https://demo-restaurant.com/api/admin/login", { method: "POST" }), env)).toBe(true);
    expect(isTrustedOrigin(new Request("https://api.demo-restaurant.com/api/admin/login", { method: "POST", headers: { origin: "https://api.demo-restaurant.com" } }), env)).toBe(true);
    expect(isTrustedOrigin(new Request("https://api.demo-restaurant.com/api/admin/login", { method: "POST", headers: { origin: "https://demo-restaurant.com" } }), env)).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(isTrustedOrigin(new Request("https://demo-restaurant.com/api/admin/login", { method: "POST", headers: { origin: "https://evil.example.com" } }), env)).toBe(false);
  });
});

describe("loginWithPassword", () => {
  async function passwordEnv(overrides: Partial<AuthEnv> = {}): Promise<AuthEnv> {
    return {
      ALLOWED_ORIGINS: origins,
      ADMIN_PASSWORD_HASH: await hashPassword("open sesame", 1000),
      ADMIN_SESSION_SECRET: secret,
      ...overrides,
    };
  }

  it("issues a session cookie for the right password", async () => {
    const env = await passwordEnv();
    const result = await loginWithPassword(loginRequest({ password: "open sesame" }), env);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.user).toBe("owner");
    expect(result.setCookie).toContain(`${SESSION_COOKIE_NAME}=v1.`);
    expect(result.setCookie).toContain("HttpOnly");

    const cookieValue = result.setCookie.split(";")[0].split("=")[1];
    const authed = new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` } });
    await expect(getAdminIdentity(authed, env)).resolves.toEqual({ user: "owner", strategy: "password" });
    await expect(getAdminSessionInfo(authed, env)).resolves.toEqual({ authenticated: true, strategy: "password", user: "owner" });
  });

  it("rejects wrong passwords and empty or malformed bodies", async () => {
    const env = await passwordEnv();

    expect((await loginWithPassword(loginRequest({ password: "nope" }), env)).status).toBe("wrong-password");
    expect((await loginWithPassword(loginRequest({ password: "" }), env)).status).toBe("bad-request");
    expect((await loginWithPassword(loginRequest({}), env)).status).toBe("bad-request");
    expect((await loginWithPassword(loginRequest("not json"), env)).status).toBe("bad-request");
  });

  it("invalidates sessions when the password hash changes", async () => {
    const env = await passwordEnv();
    const result = await loginWithPassword(loginRequest({ password: "open sesame" }), env);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const cookie = result.setCookie.split(";")[0];
    const request = new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { cookie } });
    await expect(getAdminIdentity(request, env)).resolves.not.toBeNull();

    const rotated = { ...env, ADMIN_PASSWORD_HASH: await hashPassword("new password", 1000) };
    await expect(getAdminIdentity(request, rotated)).resolves.toBeNull();

    const rotatedSecret = { ...env, ADMIN_SESSION_SECRET: "another-secret-another-secret-xx" };
    await expect(getAdminIdentity(request, rotatedSecret)).resolves.toBeNull();
    expect(getSessionSigningKey({ ALLOWED_ORIGINS: origins })).toBeNull();
  });

  it("honours the session TTL override", async () => {
    const env = await passwordEnv({ ADMIN_SESSION_TTL_HOURS: "2" });
    const result = await loginWithPassword(loginRequest({ password: "open sesame" }), env);

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.setCookie).toContain("Max-Age=7200");
  });

  it("applies the rate limiter before verifying", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const env = await passwordEnv({ LOGIN_RATE_LIMITER: { limit } });
    const result = await loginWithPassword(loginRequest({ password: "open sesame" }, { "cf-connecting-ip": "203.0.113.9" }), env);

    expect(result.status).toBe("rate-limited");
    expect(limit).toHaveBeenCalledWith({ key: "login:203.0.113.9" });
  });

  it("ignores x-forwarded-for when keying the rate limiter", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const env = await passwordEnv({ LOGIN_RATE_LIMITER: { limit } });
    await loginWithPassword(loginRequest({ password: "open sesame" }, { "x-forwarded-for": "198.51.100.7" }), env);

    expect(limit).toHaveBeenCalledWith({ key: "login:unknown" });
  });

  it("reports misconfiguration instead of guessing", async () => {
    expect((await loginWithPassword(loginRequest({ password: "x" }), { ALLOWED_ORIGINS: origins, ADMIN_EMAILS: "a@b.c" })).status).toBe("misconfigured");
    expect((await loginWithPassword(loginRequest({ password: "x" }), await passwordEnv({ ADMIN_SESSION_SECRET: "short" }))).status).toBe("misconfigured");
    expect((await loginWithPassword(loginRequest({ password: "x" }), await passwordEnv({ ADMIN_PASSWORD_HASH: "garbage" }))).status).toBe("misconfigured");
  });
});

describe("getAdminIdentity", () => {
  it("uses the Access header only under the access strategy", async () => {
    const request = new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { "cf-access-authenticated-user-email": "Owner@Demo-Restaurant.com" } });

    await expect(getAdminIdentity(request, { ALLOWED_ORIGINS: origins, ADMIN_EMAILS: "owner@demo-restaurant.com" })).resolves.toEqual({ user: "owner@demo-restaurant.com", strategy: "access" });
    await expect(getAdminIdentity(request, { ALLOWED_ORIGINS: origins, ADMIN_EMAILS: "owner@demo-restaurant.com", ADMIN_PASSWORD_HASH: "pbkdf2-sha256$1$a$b", ADMIN_SESSION_SECRET: secret })).resolves.toBeNull();
    await expect(getAdminIdentity(request, { ALLOWED_ORIGINS: origins })).resolves.toBeNull();
  });

  it("ignores a session cookie when no session secret is configured", async () => {
    const token = await createSessionToken(secret, "owner", 3600);
    const request = new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });

    await expect(getAdminIdentity(request, { ALLOWED_ORIGINS: origins, ADMIN_PASSWORD_HASH: "pbkdf2-sha256$1$a$b" })).resolves.toBeNull();
  });
});
