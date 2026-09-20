export type HttpEnv = {
  /** Comma-separated Cloudflare Access emails. Only used by the "access" auth strategy. */
  readonly ADMIN_EMAILS?: string;
  readonly ALLOWED_ORIGINS: string;
};

/** Error carrying an HTTP status so the top-level handler can answer 4xx instead of 500. */
export class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

export function getAllowedOrigins(env: HttpEnv) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((allowedOrigin) => allowedOrigin.trim())
    .filter(Boolean);
}

function getDefaultAdminUrl(env: HttpEnv) {
  const allowedOrigins = getAllowedOrigins(env);
  const productionOrigin = allowedOrigins.find((origin) => origin.startsWith("https://") && !origin.includes("staging"));
  const fallbackOrigin = productionOrigin ?? allowedOrigins.find((origin) => origin.startsWith("https://")) ?? allowedOrigins[0];
  return fallbackOrigin ? `${fallbackOrigin}/admin` : "/admin";
}

export function getCorsHeaders(request: Request, env: HttpEnv): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(env);

  // Always vary on Origin: asset responses are cached for a year, and a cache keyed without
  // Origin could otherwise serve one origin's allow-origin header to another.
  if (!origin || !allowedOrigins.includes(origin)) return { vary: "Origin" };

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, PUT, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, if-match",
    "access-control-expose-headers": "etag",
    vary: "Origin",
  };
}

export function getSafeReturnTo(request: Request, env: HttpEnv) {
  const returnTo = new URL(request.url).searchParams.get("returnTo");
  if (!returnTo) return getDefaultAdminUrl(env);

  try {
    const returnUrl = new URL(returnTo);
    if (getAllowedOrigins(env).includes(returnUrl.origin)) return returnUrl.toString();
  } catch {
    return getDefaultAdminUrl(env);
  }

  return getDefaultAdminUrl(env);
}

export function redirectResponse(location: string, corsHeaders: Record<string, string>) {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      ...corsHeaders,
    },
  });
}

export function jsonResponse(body: unknown, init?: ResponseInit, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

/** Cloudflare Access header check. Kept for the "access" strategy; see auth.ts for the full picture. */
export function isAdminRequest(request: Request, env: HttpEnv) {
  const allowedEmails = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedEmails.length) return false;

  const accessEmail = request.headers.get("cf-access-authenticated-user-email")?.toLowerCase();
  return Boolean(accessEmail && allowedEmails.includes(accessEmail));
}
