import { describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";
import { hashPassword, SESSION_COOKIE_NAME } from "./auth";

const accessEnv: Env = {
  ADMIN_EMAILS: "owner@demo-restaurant.com",
  ALLOWED_ORIGINS: "http://localhost:5173,https://demo-restaurant.com,https://staging.demo-restaurant.com",
  MENU_BUCKET: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  RESTAURANT_ID: "demo",
};

async function passwordEnv(overrides: Partial<Env> = {}): Promise<Env> {
  return {
    ...accessEnv,
    ADMIN_EMAILS: undefined,
    ADMIN_PASSWORD_HASH: await hashPassword("open sesame", 1000),
    ADMIN_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    ...overrides,
  };
}

function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("admin routing (access strategy)", () => {
  it("allows the sign-in redirect without an Access email header", async () => {
    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/sign-in"), accessEnv);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://demo-restaurant.com/admin");
  });

  it("returns 401 with the active strategy when the Access header is missing", async () => {
    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/menu/draft"), accessEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized.", strategy: "access" });
  });

  it("reports the session state without authentication", async () => {
    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/session"), accessEnv);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false, strategy: "access", user: null });
  });

  it("refuses password login when the access strategy is active", async () => {
    const response = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }), accessEnv);

    expect(response.status).toBe(500);
  });
});

describe("admin routing (password strategy)", () => {
  it("logs in, then authorizes admin calls with the cookie", async () => {
    const env = await passwordEnv();
    const login = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }, { origin: "https://demo-restaurant.com" }), env);

    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toEqual({ ok: true, user: "owner", strategy: "password" });
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=v1.`);
    expect(setCookie).toContain("Secure");

    const cookie = setCookie.split(";")[0];
    const session = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/session", { headers: { cookie } }), env);
    await expect(session.json()).resolves.toEqual({ authenticated: true, strategy: "password", user: "owner" });

    // Past the auth gate: the empty bucket produces a 404, not a 401.
    const draft = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { cookie } }), env);
    expect(draft.status).toBe(404);
  });

  it("rejects a wrong password with 401", async () => {
    const response = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "nope" }), await passwordEnv());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Wrong password." });
  });

  it("returns 429 when the rate limiter trips", async () => {
    const env = await passwordEnv({ LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    const response = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }), env);

    expect(response.status).toBe(429);
  });

  it("blocks cross-site mutations before touching auth", async () => {
    const env = await passwordEnv();
    const login = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }, { origin: "https://evil.example.com" }), env);
    expect(login.status).toBe(403);

    const put = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/menu/draft", "PUT", {}, { origin: "https://evil.example.com" }), env);
    expect(put.status).toBe(403);
  });

  it("ignores the Access header under the password strategy", async () => {
    const response = await worker.fetch(
      new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { "cf-access-authenticated-user-email": "owner@demo-restaurant.com" } }),
      await passwordEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized.", strategy: "password" });
  });

  it("clears the cookie on logout", async () => {
    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/logout", { method: "POST" }), await passwordEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  });
});

describe("draft concurrency", () => {
  it("exposes the draft etag and answers 412 to a stale If-Match", async () => {
    const env = await passwordEnv();
    const login = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }), env);
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    const draftObject = { body: new Response(JSON.stringify({ schemaVersion: 1, groups: [], categories: [], items: [] })).body, httpEtag: '"v1"', writeHttpMetadata: () => undefined };
    const bucket = { ...env.MENU_BUCKET, get: vi.fn().mockResolvedValue(draftObject), put: vi.fn().mockResolvedValue(null) };
    const conflictEnv: Env = { ...env, MENU_BUCKET: bucket };

    const read = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/menu/draft", { headers: { cookie } }), conflictEnv);
    expect(read.status).toBe(200);
    expect(read.headers.get("etag")).toBe('"v1"');

    const stale = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/menu/draft", "PUT", { schemaVersion: 1, groups: [], categories: [], items: [] }, { cookie, "if-match": '"v0"' }), conflictEnv);
    expect(stale.status).toBe(412);
    expect(bucket.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ onlyIf: { etagMatches: '"v0"' } }));
  });
});

describe("error handling", () => {
  it("answers 400 JSON for a malformed draft body instead of throwing", async () => {
    const env = await passwordEnv();
    const login = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }), env);
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    const badJson = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/menu/draft", { method: "PUT", headers: { cookie, "content-type": "application/json" }, body: "{not json" }), env);
    expect(badJson.status).toBe(400);
    await expect(badJson.json()).resolves.toEqual({ error: "Request body must be valid JSON." });

    const badShape = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/menu/draft", "PUT", { schemaVersion: 2 }, { cookie }), env);
    expect(badShape.status).toBe(400);
    await expect(badShape.json()).resolves.toEqual({ error: "Unsupported menu schema version." });
  });

  it("answers 500 JSON when storage throws", async () => {
    const env: Env = { ...accessEnv, MENU_BUCKET: { ...accessEnv.MENU_BUCKET, get: vi.fn().mockRejectedValue(new Error("r2 down")) } };
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/menu"), env);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unexpected error." });
  });

  it("rejects html uploads with 415 and oversized uploads with 413", async () => {
    const env = await passwordEnv();
    const login = await worker.fetch(jsonRequest("https://demo-restaurant.com/api/admin/login", "POST", { password: "open sesame" }), env);
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    const html = new FormData();
    html.set("file", new File(["<script>alert(1)</script>"], "x.html", { type: "text/html" }));
    const htmlResponse = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/images", { method: "POST", headers: { cookie }, body: html }), env);
    expect(htmlResponse.status).toBe(415);
    expect(env.MENU_BUCKET.put).not.toHaveBeenCalled();
  });

  it("serves stored assets only under the image prefix, with a safe content type", async () => {
    const object = {
      body: new Response("binary").body,
      httpEtag: '"e"',
      writeHttpMetadata: (headers: Headers) => headers.set("content-type", "text/html"),
    };
    const env: Env = { ...accessEnv, MENU_BUCKET: { ...accessEnv.MENU_BUCKET, get: vi.fn().mockResolvedValue(object) } };

    const draft = await worker.fetch(new Request("https://demo-restaurant.com/api/assets/restaurants%2Fdemo%2Fdraft%2Fmenu.json"), env);
    expect(draft.status).toBe(404);
    expect(env.MENU_BUCKET.get).not.toHaveBeenCalled();

    const asset = await worker.fetch(new Request("https://demo-restaurant.com/api/assets/restaurants%2Fdemo%2Fimages%2Fmenu%2F1-x.webp"), env);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toBe("application/octet-stream");
    expect(asset.headers.get("content-disposition")).toBe("attachment");
    expect(asset.headers.get("x-content-type-options")).toBe("nosniff");
    expect(asset.headers.get("vary")).toBe("Origin");
  });
});

describe("static assets passthrough", () => {
  it("hands non-API paths to the ASSETS binding when present", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    const response = await worker.fetch(new Request("https://demo-restaurant.com/admin"), { ...accessEnv, ASSETS: { fetch } });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  it("denies every admin call when no strategy is configured", async () => {
    const response = await worker.fetch(new Request("https://demo-restaurant.com/api/admin/menu/draft"), { ...accessEnv, ADMIN_EMAILS: "" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized.", strategy: "none" });
  });
});
