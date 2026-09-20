import { describe, expect, it, vi } from "vitest";
import { createMenuApiClient, MenuApiError } from "./menuApi";
import type { DynamicMenu } from "./menuSchema";

type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const menu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-07-04T00:00:00.000Z",
  restaurant: {
    id: "demo",
    name: "Demo Grill",
    tagline: "Savor The Flavor",
    phone: "+961 78 700 690",
    whatsapp: "96178700690",
    address: "Saida",
  },
  groups: [],
  categories: [],
  items: [],
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

describe("menu API client", () => {
  it("uses same-origin API paths by default", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValueOnce(jsonResponse(menu)).mockResolvedValueOnce(jsonResponse(menu));
    const client = createMenuApiClient({ fetcher });

    await expect(client.getPublishedMenu()).resolves.toEqual(menu);
    await expect(client.getDraftMenu()).resolves.toEqual(menu);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/menu", { credentials: "include" });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/admin/menu/draft", { credentials: "include" });
  });

  it("fetches the published menu from the configured public URL", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse(menu));
    const client = createMenuApiClient({
      publicMenuUrl: "https://api.demo-restaurant.com/api/menu",
      fetcher,
    });

    await expect(client.getPublishedMenu()).resolves.toEqual(menu);
    expect(fetcher).toHaveBeenCalledWith("https://api.demo-restaurant.com/api/menu", { credentials: "include" });
  });

  it("fetches the draft menu from the admin API base URL", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse(menu));
    const client = createMenuApiClient({
      apiBaseUrl: "https://api.demo-restaurant.com",
      fetcher,
    });

    await expect(client.getDraftMenu()).resolves.toEqual(menu);
    expect(fetcher).toHaveBeenCalledWith("https://api.demo-restaurant.com/api/admin/menu/draft", { credentials: "include" });
  });

  it("builds an admin sign-in URL that returns to the editor", () => {
    const client = createMenuApiClient({
      apiBaseUrl: "https://api.demo-restaurant.com",
    });

    expect(client.getAdminSignInUrl("https://demo-restaurant.com/admin")).toBe(
      "https://api.demo-restaurant.com/api/admin/sign-in?returnTo=https%3A%2F%2Fdemo-restaurant.com%2Fadmin",
    );
  });

  it("returns the draft etag and sends it back as If-Match", async () => {
    const fetcher = vi
      .fn<MockFetch>()
      .mockResolvedValueOnce(jsonResponse(menu, { headers: { etag: '"abc"' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, etag: '"def"' }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.getDraft()).resolves.toEqual({ menu, etag: '"abc"' });
    await expect(client.saveDraftMenu(menu, { ifMatch: '"abc"' })).resolves.toEqual({ etag: '"def"' });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/admin/menu/draft", {
      credentials: "include",
      method: "PUT",
      headers: { "content-type": "application/json", "if-match": '"abc"' },
      body: JSON.stringify(menu),
    });
  });

  it("maps a 412 to a reload message", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(new Response("", { status: 412 }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.saveDraftMenu(menu)).rejects.toMatchObject({ status: 412, message: "The draft was changed elsewhere. Reload the editor to get the latest version." });
  });

  it("reads the admin session", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse({ authenticated: false, strategy: "password", user: null }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.getAdminSession()).resolves.toEqual({ authenticated: false, strategy: "password", user: null });
    expect(fetcher).toHaveBeenCalledWith("/api/admin/session", { credentials: "include" });
  });

  it("signs in with a password and returns the session", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse({ ok: true, user: "owner", strategy: "password" }));
    const client = createMenuApiClient({ apiBaseUrl: "https://api.demo-restaurant.com", fetcher });

    await expect(client.signInWithPassword("open sesame")).resolves.toEqual({ authenticated: true, strategy: "password", user: "owner" });
    expect(fetcher).toHaveBeenCalledWith("https://api.demo-restaurant.com/api/admin/login", {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "open sesame" }),
    });
  });

  it("surfaces wrong-password and rate-limit errors", async () => {
    const fetcher = vi
      .fn<MockFetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "Wrong password." }, { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.signInWithPassword("nope")).rejects.toMatchObject({ message: "Wrong password.", status: 401 });
    await expect(client.signInWithPassword("nope")).rejects.toMatchObject({ message: "Too many attempts. Wait a minute and try again.", status: 429 });
  });

  it("signs out with a POST", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.signOut()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/admin/logout", { credentials: "include", method: "POST" });
  });

  it("saves the draft menu with JSON", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createMenuApiClient({
      apiBaseUrl: "https://api.demo-restaurant.com/",
      fetcher,
    });

    await client.saveDraftMenu(menu);

    expect(fetcher).toHaveBeenCalledWith("https://api.demo-restaurant.com/api/admin/menu/draft", {
      credentials: "include",
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(menu),
    });
  });

  it("publishes the draft menu", async () => {
    const result = { ok: true, backupKey: "restaurants/demo/backups/published.json" } as const;
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse(result));
    const client = createMenuApiClient({
      apiBaseUrl: "https://api.demo-restaurant.com",
      fetcher,
    });

    await expect(client.publishDraftMenu()).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith("https://api.demo-restaurant.com/api/admin/menu/publish", {
      credentials: "include",
      method: "POST",
    });
  });

  it("uploads and deletes menu images", async () => {
    const upload = { key: "restaurants/demo/images/menu/fries.webp", url: "/api/assets/restaurants%2Fdemo%2Fimages%2Fmenu%2Ffries.webp" };
    const resolvedUpload = { ...upload, url: "https://api.demo-restaurant.com/api/assets/restaurants%2Fdemo%2Fimages%2Fmenu%2Ffries.webp" };
    const fetcher = vi.fn<MockFetch>().mockResolvedValueOnce(jsonResponse(upload)).mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = createMenuApiClient({
      apiBaseUrl: "https://api.demo-restaurant.com",
      fetcher,
    });

    await expect(client.uploadMenuImage(new File(["image"], "fries.webp", { type: "image/webp" }))).resolves.toEqual(resolvedUpload);
    await client.deleteMenuImage(upload.key);

    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.demo-restaurant.com/api/admin/images");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: "include", method: "POST" });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[1]).toEqual([
      "https://api.demo-restaurant.com/api/admin/images?key=restaurants%2Fdemo%2Fimages%2Fmenu%2Ffries.webp",
      {
        credentials: "include",
        method: "DELETE",
      },
    ]);
  });

  it("throws API error messages from JSON error responses", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(jsonResponse({ error: "Draft menu not found." }, { status: 404 }));
    const client = createMenuApiClient({ fetcher });

    await expect(client.getDraftMenu()).rejects.toMatchObject({
      name: "MenuApiError",
      status: 404,
      message: "Draft menu not found.",
    });
  });

  it("throws a routing-focused error when the API answers with HTML", async () => {
    const fetcher = vi.fn<MockFetch>().mockResolvedValue(
      new Response("<html>Cloudflare Access</html>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
    );
    const client = createMenuApiClient({ fetcher });

    await expect(client.getDraftMenu()).rejects.toBeInstanceOf(MenuApiError);
    await expect(client.getDraftMenu()).rejects.toMatchObject({
      status: 200,
      message: "Expected a JSON response. The /api route is not reaching the menu Worker, or a sign-in page intercepted it.",
    });
  });
});
