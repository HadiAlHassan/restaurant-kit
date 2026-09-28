import { buildClearedSessionCookie, getAdminIdentity, getAdminSessionInfo, isTrustedOrigin, loginWithPassword, resolveAdminAuthStrategy, type AuthEnv } from "./auth";
import { validateMenu } from "../menu/validateMenu";
import { readBodyWithLimit } from "./body";
import { getCorsHeaders, getSafeReturnTo, jsonResponse, redirectResponse, RequestError } from "./http";
import { allowedImageTypes, createMenuStorage, maxImageUploadBytes, normalizeEtag, type MenuStorage, type R2Bucket, type RestoreSource } from "./menuStorage";

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

export type Env = AuthEnv & {
  readonly MENU_BUCKET: R2Bucket;
  readonly RESTAURANT_ID: string;
  /** Present when the site is deployed as one Worker with static assets (`[assets]` in wrangler.toml). */
  readonly ASSETS?: AssetsBinding;
};

const noStoreHeaders = { "cache-control": "no-store" };

function assertMenuShape(value: unknown) {
  if (!value || typeof value !== "object") throw new RequestError("Menu must be an object.", 400);
  const menu = value as { schemaVersion?: unknown; groups?: unknown; categories?: unknown; items?: unknown };
  if (menu.schemaVersion !== 1) throw new RequestError("Unsupported menu schema version.", 400);
  if (!Array.isArray(menu.groups)) throw new RequestError("Menu groups must be an array.", 400);
  if (!Array.isArray(menu.categories)) throw new RequestError("Menu categories must be an array.", 400);
  if (!Array.isArray(menu.items)) throw new RequestError("Menu items must be an array.", 400);
}

// The API never needs anywhere near the platform's ~100 MB body cap. Reading through
// readBodyWithLimit rejects an oversized payload early, whether or not Content-Length is sent.
const maxJsonBodyBytes = 2 * 1024 * 1024;
const maxUploadBodyBytes = maxImageUploadBytes + 64 * 1024; // image + multipart overhead

async function readJsonBody(request: Request) {
  const body = await readBodyWithLimit(request, maxJsonBodyBytes);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new RequestError("Request body must be valid JSON.", 400);
  }
}

async function readFormData(request: Request) {
  const body = await readBodyWithLimit(request, maxUploadBodyBytes);
  try {
    return await new Response(body, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    throw new RequestError("Request body must be multipart form data.", 400);
  }
}

// Visitors get the published menu from the data center's edge cache for up to a minute, so a
// burst of page views costs one R2 read per location instead of one per request. Browsers always
// revalidate (max-age=0) and get a 304 when their ETag still matches.
const publicMenuEdgeTtlSeconds = 60;
const publicMenuCacheControl = `public, max-age=0, must-revalidate, s-maxage=${publicMenuEdgeTtlSeconds}`;

/** The Workers edge cache, or null outside Workers (tests) — workers.dev hosts accept calls but never hit. */
function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches;
  return storage?.default ?? null;
}

function publicMenuCacheKey(request: Request) {
  return new Request(`${new URL(request.url).origin}/api/menu`);
}

function ifNoneMatchHits(header: string | null, etag: string) {
  if (!header) return false;
  const wanted = normalizeEtag(etag);
  return header.split(",").some((candidate) => candidate.trim() === "*" || normalizeEtag(candidate) === wanted);
}

async function handlePublicMenu(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const cache = edgeCache();
  const cacheKey = publicMenuCacheKey(request);
  // Cached copies carry no CORS headers; they are added per request below, so one origin's
  // allow-origin header can never be served to another.
  let cached = await cache?.match(cacheKey);
  if (!cached) {
    const record = await storage.getPublished();
    if (!record) return jsonResponse({ error: "Published menu not found." }, { status: 404 }, corsHeaders);

    cached = new Response(JSON.stringify(record.menu), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": publicMenuCacheControl,
        ...(record.etag ? { etag: record.etag } : {}),
      },
    });
    if (cache) await cache.put(cacheKey, cached.clone());
  }

  const etag = cached.headers.get("etag");
  if (etag && ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": publicMenuCacheControl, ...corsHeaders } });
  }
  const headers = new Headers(cached.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(cached.body, { headers });
}

async function handleAsset(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.replace(/^\/api\/assets\//, ""));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const object = await storage.getAsset(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  // Never trust stored metadata for the content type: an object that is not a known image
  // type is served as an opaque download so it cannot execute on the site's origin.
  const storedType = headers.get("content-type") ?? "";
  if (allowedImageTypes.has(storedType)) {
    headers.set("content-disposition", "inline");
  } else {
    headers.set("content-type", "application/octet-stream");
    headers.set("content-disposition", "attachment");
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));

  return new Response(object.body, { headers });
}

async function handleDraftMenu(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  if (request.method === "GET") {
    const draft = await storage.getDraft();
    if (draft) {
      // The etag lets the editor send If-Match on save, so two admins cannot overwrite each other.
      return jsonResponse(draft.menu, { headers: { ...noStoreHeaders, ...(draft.etag ? { etag: draft.etag } : {}) } }, corsHeaders);
    }

    const published = await storage.getPublished();
    if (!published) return jsonResponse({ error: "No draft or published menu found." }, { status: 404 }, corsHeaders);
    return jsonResponse(published.menu, { headers: noStoreHeaders }, corsHeaders);
  }

  if (request.method === "PUT") {
    const menu = await readJsonBody(request);
    assertMenuShape(menu);
    const ifMatch = request.headers.get("if-match");
    const result = await storage.saveDraft(menu as object, { ifMatch: ifMatch && ifMatch !== "*" ? ifMatch : null });
    if (result.status === "conflict") {
      return jsonResponse({ error: "The draft was changed elsewhere. Reload the editor to get the latest version, then redo your edits." }, { status: 412, headers: noStoreHeaders }, corsHeaders);
    }
    return jsonResponse({ ok: true, etag: result.etag }, { headers: { ...noStoreHeaders, ...(result.etag ? { etag: result.etag } : {}) } }, corsHeaders);
  }

  return jsonResponse({ error: "Method not allowed." }, { status: 405 }, corsHeaders);
}

async function handleBackups(storage: MenuStorage, corsHeaders: Record<string, string>) {
  const backups = await storage.listBackups();
  return jsonResponse({ backups }, { headers: noStoreHeaders }, corsHeaders);
}

async function handleRestore(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const body = (await readJsonBody(request)) as { source?: unknown; key?: unknown };
  let source: RestoreSource;
  if (body.source === "published") source = { kind: "published" };
  else if (body.source === "backup" && typeof body.key === "string" && body.key) source = { kind: "backup", key: body.key };
  else throw new RequestError('Expected { source: "published" } or { source: "backup", key }.', 400);

  const result = await storage.restoreDraft(source);
  if (result.status === "invalid-key") throw new RequestError("Backup key is outside this restaurant's backups.", 400);
  if (result.status === "not-found") return jsonResponse({ error: source.kind === "published" ? "Nothing has been published yet." : "Backup not found." }, { status: 404 }, corsHeaders);

  return jsonResponse({ ok: true, etag: result.etag }, { headers: { ...noStoreHeaders, ...(result.etag ? { etag: result.etag } : {}) } }, corsHeaders);
}

/** Full check before a menu goes live; drafts only get the shallow shape check so mid-edit states still save. */
function assertPublishable(menu: unknown) {
  const issues = validateMenu(menu);
  if (!issues.length) return;
  const listed = issues.slice(0, 5).map((issue) => `${issue.path || "(root)"}: ${issue.message}`).join("; ");
  const more = issues.length > 5 ? ` (and ${issues.length - 5} more)` : "";
  throw new RequestError(`The menu can't be published yet: ${listed}${more}`, 400);
}

async function handlePublish(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const result = await storage.publishDraft({ validate: assertPublishable });
  if (result.status === "no-draft") return jsonResponse({ error: "Draft menu not found." }, { status: 404 }, corsHeaders);
  // Only purges this data center; others pick up the new menu within publicMenuEdgeTtlSeconds.
  await edgeCache()?.delete(publicMenuCacheKey(request));

  return jsonResponse({ ok: true, backupKey: result.backupKey }, undefined, corsHeaders);
}

async function handleImageUpload(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const formData = await readFormData(request);
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonResponse({ error: "Missing file field." }, { status: 400 }, corsHeaders);

  const { key } = await storage.uploadImage(file);
  return jsonResponse({ key, url: `${new URL(request.url).origin}/api/assets/${encodeURIComponent(key)}` }, undefined, corsHeaders);
}

async function handleImageDelete(request: Request, storage: MenuStorage, corsHeaders: Record<string, string>) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return jsonResponse({ error: "Missing key." }, { status: 400 }, corsHeaders);

  const deleted = await storage.deleteImage(key);
  if (!deleted) return jsonResponse({ error: "Image key is outside menu image prefix." }, { status: 400 }, corsHeaders);

  return jsonResponse({ ok: true }, undefined, corsHeaders);
}

async function handleSession(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const session = await getAdminSessionInfo(request, env);
  return jsonResponse(session, { headers: noStoreHeaders }, corsHeaders);
}

async function handleLogin(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const result = await loginWithPassword(request, env);

  switch (result.status) {
    case "ok":
      return jsonResponse(
        { ok: true, user: result.user, strategy: "password" },
        { headers: { ...noStoreHeaders, "set-cookie": result.setCookie } },
        corsHeaders,
      );
    case "wrong-password":
      return jsonResponse({ error: "Wrong password." }, { status: 401, headers: noStoreHeaders }, corsHeaders);
    case "rate-limited":
      return jsonResponse({ error: "Too many sign-in attempts. Wait a minute and try again." }, { status: 429, headers: noStoreHeaders }, corsHeaders);
    case "bad-request":
      return jsonResponse({ error: result.message }, { status: 400 }, corsHeaders);
    case "misconfigured":
      return jsonResponse({ error: result.message }, { status: 500 }, corsHeaders);
  }
}

function handleLogout(request: Request, corsHeaders: Record<string, string>) {
  return jsonResponse({ ok: true }, { headers: { ...noStoreHeaders, "set-cookie": buildClearedSessionCookie(request) } }, corsHeaders);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Single-Worker deployments: anything outside /api/ is a static asset (SPA fallback handled by Cloudflare).
    if (!url.pathname.startsWith("/api/") && env.ASSETS) return env.ASSETS.fetch(request);

    const corsHeaders = getCorsHeaders(request, env);
    const storage = createMenuStorage(env.MENU_BUCKET, env.RESTAURANT_ID);

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
      if (request.method === "GET" && url.pathname === "/api/menu") return await handlePublicMenu(request, storage, corsHeaders);
      if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) return await handleAsset(request, storage, corsHeaders);
      if (request.method === "GET" && url.pathname === "/api/admin/sign-in") return redirectResponse(getSafeReturnTo(request, env), corsHeaders);
      if (request.method === "GET" && url.pathname === "/api/admin/session") return await handleSession(request, env, corsHeaders);

      // Every state-changing admin call (login included) must come from this site or an allowed origin.
      if (url.pathname.startsWith("/api/admin/") && request.method !== "GET" && !isTrustedOrigin(request, env)) {
        return jsonResponse({ error: "Cross-origin request blocked." }, { status: 403 }, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/api/admin/login") return await handleLogin(request, env, corsHeaders);
      if (request.method === "POST" && url.pathname === "/api/admin/logout") return await handleLogout(request, corsHeaders);

      if (url.pathname.startsWith("/api/admin/") && !(await getAdminIdentity(request, env))) {
        return jsonResponse({ error: "Unauthorized.", strategy: resolveAdminAuthStrategy(env) }, { status: 401, headers: noStoreHeaders }, corsHeaders);
      }

      if (url.pathname === "/api/admin/menu/draft") return await handleDraftMenu(request, storage, corsHeaders);
      if (request.method === "POST" && url.pathname === "/api/admin/menu/publish") return await handlePublish(request, storage, corsHeaders);
      if (request.method === "GET" && url.pathname === "/api/admin/menu/backups") return await handleBackups(storage, corsHeaders);
      if (request.method === "POST" && url.pathname === "/api/admin/menu/restore") return await handleRestore(request, storage, corsHeaders);
      if (request.method === "POST" && url.pathname === "/api/admin/images") return await handleImageUpload(request, storage, corsHeaders);
      if (request.method === "DELETE" && url.pathname === "/api/admin/images") return await handleImageDelete(request, storage, corsHeaders);

      return jsonResponse({ error: "Not found." }, { status: 404 }, corsHeaders);
    } catch (error) {
      // `return await` above is what makes handler rejections land here instead of surfacing
      // as a Cloudflare 1101 page. Client errors keep their status; everything else is a 500.
      if (error instanceof RequestError) return jsonResponse({ error: error.message }, { status: error.status }, corsHeaders);
      console.error("menu api error", error);
      return jsonResponse({ error: "Unexpected error." }, { status: 500 }, corsHeaders);
    }
  },
};

export { hashPassword, verifyPassword, resolveAdminAuthStrategy, type AdminAuthStrategy, type AuthEnv } from "./auth";
