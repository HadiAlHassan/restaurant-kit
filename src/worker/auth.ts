import { getAllowedOrigins, type HttpEnv } from "./http";

/**
 * Admin authentication for the menu API.
 *
 * Two strategies:
 *  - "password": a single owner password (PBKDF2 hash in ADMIN_PASSWORD_HASH) exchanged for
 *    an HMAC-signed, HttpOnly session cookie. No Cloudflare Access / Zero Trust required.
 *  - "access":   legacy Cloudflare Access; trusts the cf-access-authenticated-user-email header
 *    against ADMIN_EMAILS. Only safe when Access fronts every route to this Worker.
 *
 * The strategy is picked from env: ADMIN_AUTH wins when set, otherwise ADMIN_PASSWORD_HASH
 * implies "password", otherwise a non-empty ADMIN_EMAILS implies "access", otherwise "none"
 * (every admin request is denied).
 */

export type AdminAuthStrategy = "password" | "access" | "none";

export type RateLimiter = {
  limit(options: { readonly key: string }): Promise<{ readonly success: boolean }>;
};

export type AuthEnv = HttpEnv & {
  readonly ADMIN_AUTH?: string;
  readonly ADMIN_PASSWORD_HASH?: string;
  readonly ADMIN_SESSION_SECRET?: string;
  readonly ADMIN_SESSION_TTL_HOURS?: string;
  readonly LOGIN_RATE_LIMITER?: RateLimiter;
};

export type AdminIdentity = {
  readonly user: string;
  readonly strategy: AdminAuthStrategy;
};

export type AdminSessionInfo = {
  readonly authenticated: boolean;
  readonly strategy: AdminAuthStrategy;
  readonly user: string | null;
};

export const SESSION_COOKIE_NAME = "rk_admin_session";
export const PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
/** Workers Free plan caps PBKDF2 at 100k iterations; keep the default there so login fits the CPU budget. */
export const DEFAULT_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const DEFAULT_SESSION_TTL_HOURS = 24 * 14;
const PASSWORD_SUBJECT = "owner";
const TOKEN_VERSION = "v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Strategy resolution
// ---------------------------------------------------------------------------

export function resolveAdminAuthStrategy(env: AuthEnv): AdminAuthStrategy {
  const explicit = env.ADMIN_AUTH?.trim().toLowerCase();
  if (explicit === "password" || explicit === "access" || explicit === "none") return explicit;
  if (env.ADMIN_PASSWORD_HASH?.trim()) return "password";
  if (getAllowedAdminEmails(env).length) return "access";
  return "none";
}

export function getAllowedAdminEmails(env: HttpEnv) {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getSessionTtlSeconds(env: AuthEnv) {
  const hours = Number(env.ADMIN_SESSION_TTL_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_TTL_HOURS;
  return Math.round(safeHours * 3600);
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  // Compare over the longer length so a length mismatch does not short-circuit early.
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256, WebCrypto)
// ---------------------------------------------------------------------------

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, keyMaterial, 256);
  return new Uint8Array(bits);
}

/** Produces `pbkdf2-sha256$<iterations>$<salt>$<hash>` for ADMIN_PASSWORD_HASH. */
export async function hashPassword(password: string, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password) throw new Error("Password must not be empty.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt, iterations);
  return [PASSWORD_HASH_ALGORITHM, String(iterations), base64UrlEncode(salt), base64UrlEncode(hash)].join("$");
}

export function parsePasswordHash(encoded: string) {
  const [algorithm, iterationsText, saltText, hashText, ...rest] = encoded.trim().split("$");
  if (algorithm !== PASSWORD_HASH_ALGORITHM || rest.length || !saltText || !hashText) return null;

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) return null;

  try {
    return { iterations, salt: base64UrlDecode(saltText), hash: base64UrlDecode(hashText) };
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed || !password) return false;

  const candidate = await deriveKey(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(candidate, parsed.hash);
}

// ---------------------------------------------------------------------------
// Session tokens (HMAC-SHA256)
// ---------------------------------------------------------------------------

type SessionPayload = {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
};

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signPayload(secret: string, payload: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(secret: string, subject: string, ttlSeconds: number, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = { sub: subject, iat: issuedAt, exp: issuedAt + ttlSeconds };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(secret, `${TOKEN_VERSION}.${encodedPayload}`);
  return `${TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

export async function verifySessionToken(secret: string, token: string, now = Date.now()): Promise<SessionPayload | null> {
  const [version, encodedPayload, signature, ...rest] = token.split(".");
  if (version !== TOKEN_VERSION || !encodedPayload || !signature || rest.length) return null;

  const expectedSignature = await signPayload(secret, `${version}.${encodedPayload}`);
  if (!timingSafeEqual(encoder.encode(signature), encoder.encode(expectedSignature))) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload))) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}

function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function buildSessionCookie(request: Request, token: string, maxAgeSeconds: number) {
  const attributes = [`${SESSION_COOKIE_NAME}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (isSecureRequest(request)) attributes.push("Secure");
  return attributes.join("; ");
}

export function buildClearedSessionCookie(request: Request) {
  const attributes = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureRequest(request)) attributes.push("Secure");
  return attributes.join("; ");
}

// ---------------------------------------------------------------------------
// Request-level checks
// ---------------------------------------------------------------------------

/**
 * Browsers always attach an Origin header to POST/PUT/DELETE, so a present Origin that is
 * neither the request's own origin nor an allowed one is a cross-site request. Non-browser
 * clients (no Origin) carry no ambient cookie, so they are not a CSRF vector.
 */
export function isTrustedOrigin(request: Request, env: HttpEnv) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  return getAllowedOrigins(env).includes(origin);
}

export function getAccessIdentity(request: Request, env: HttpEnv): AdminIdentity | null {
  const allowedEmails = getAllowedAdminEmails(env);
  if (!allowedEmails.length) return null;

  const accessEmail = request.headers.get("cf-access-authenticated-user-email")?.toLowerCase();
  if (!accessEmail || !allowedEmails.includes(accessEmail)) return null;
  return { user: accessEmail, strategy: "access" };
}

/**
 * Session signing key = session secret + current password hash. Rotating either one
 * invalidates every outstanding session, so a password change is also a global sign-out.
 */
export function getSessionSigningKey(env: AuthEnv) {
  if (!env.ADMIN_SESSION_SECRET) return null;
  return `${env.ADMIN_SESSION_SECRET}\u0000${env.ADMIN_PASSWORD_HASH ?? ""}`;
}

export async function getPasswordSessionIdentity(request: Request, env: AuthEnv): Promise<AdminIdentity | null> {
  const signingKey = getSessionSigningKey(env);
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!signingKey || !token) return null;

  const payload = await verifySessionToken(signingKey, token);
  return payload ? { user: payload.sub, strategy: "password" } : null;
}

export async function getAdminIdentity(request: Request, env: AuthEnv): Promise<AdminIdentity | null> {
  switch (resolveAdminAuthStrategy(env)) {
    case "password":
      return getPasswordSessionIdentity(request, env);
    case "access":
      return getAccessIdentity(request, env);
    default:
      return null;
  }
}

export async function getAdminSessionInfo(request: Request, env: AuthEnv): Promise<AdminSessionInfo> {
  const strategy = resolveAdminAuthStrategy(env);
  const identity = await getAdminIdentity(request, env);
  return { authenticated: Boolean(identity), strategy, user: identity?.user ?? null };
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export type LoginResult =
  | { readonly status: "ok"; readonly user: string; readonly setCookie: string }
  | { readonly status: "wrong-password" }
  | { readonly status: "rate-limited" }
  | { readonly status: "bad-request"; readonly message: string }
  | { readonly status: "misconfigured"; readonly message: string };

function getClientKey(request: Request) {
  // Cloudflare always sets cf-connecting-ip. Never fall back to x-forwarded-for: a client can
  // mint a fresh value per request and sidestep the limiter.
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function loginWithPassword(request: Request, env: AuthEnv): Promise<LoginResult> {
  if (resolveAdminAuthStrategy(env) !== "password") {
    return { status: "misconfigured", message: "Password sign-in is not enabled for this API." };
  }
  if (!env.ADMIN_PASSWORD_HASH || !parsePasswordHash(env.ADMIN_PASSWORD_HASH)) {
    return { status: "misconfigured", message: "ADMIN_PASSWORD_HASH is missing or malformed." };
  }
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 16) {
    return { status: "misconfigured", message: "ADMIN_SESSION_SECRET is missing or too short (min 16 chars)." };
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return { status: "bad-request", message: "Expected a JSON body with a password field." };
  }
  if (!password) return { status: "bad-request", message: "Password is required." };

  if (env.LOGIN_RATE_LIMITER) {
    const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: `login:${getClientKey(request)}` });
    if (!success) return { status: "rate-limited" };
  }

  if (!(await verifyPassword(password, env.ADMIN_PASSWORD_HASH))) return { status: "wrong-password" };

  const ttlSeconds = getSessionTtlSeconds(env);
  const token = await createSessionToken(getSessionSigningKey(env) ?? env.ADMIN_SESSION_SECRET, PASSWORD_SUBJECT, ttlSeconds);
  return { status: "ok", user: PASSWORD_SUBJECT, setCookie: buildSessionCookie(request, token, ttlSeconds) };
}
