import type { DynamicMenu } from "./menuSchema";

const defaultApiBaseUrl = (import.meta.env.VITE_MENU_API_BASE_URL as string | undefined) ?? "";
const defaultPublicMenuUrl = (import.meta.env.VITE_MENU_API_URL as string | undefined) ?? joinUrl(defaultApiBaseUrl, "/api/menu");

type Fetcher = typeof fetch;

export type MenuImageUpload = {
  readonly key: string;
  readonly url: string;
};

export type PublishResult = {
  readonly ok: true;
  readonly backupKey: string | null;
};

/** "local" is the browser-only dev client; the Worker reports password | access | none. */
export type AdminAuthStrategy = "password" | "access" | "none" | "local";

export type AdminSession = {
  readonly authenticated: boolean;
  readonly strategy: AdminAuthStrategy;
  readonly user: string | null;
};

export type DraftMenuRecord = {
  readonly menu: DynamicMenu;
  /** Server etag of the draft, or null when unknown (local adapter, published fallback). */
  readonly etag: string | null;
};

export type SaveDraftOptions = {
  /** Send the etag from the last load/save; the server answers 412 if the draft changed meanwhile. */
  readonly ifMatch?: string | null;
};

export type MenuApiClient = {
  readonly getPublishedMenu: () => Promise<DynamicMenu>;
  readonly getDraftMenu: () => Promise<DynamicMenu>;
  readonly getDraft: () => Promise<DraftMenuRecord>;
  readonly getAdminSignInUrl: (returnTo?: string) => string;
  readonly getAdminSession: () => Promise<AdminSession>;
  readonly signInWithPassword: (password: string) => Promise<AdminSession>;
  readonly signOut: () => Promise<void>;
  readonly saveDraftMenu: (menu: DynamicMenu, options?: SaveDraftOptions) => Promise<{ readonly etag: string | null }>;
  readonly publishDraftMenu: () => Promise<PublishResult>;
  readonly uploadMenuImage: (file: File) => Promise<MenuImageUpload>;
  readonly deleteMenuImage: (key: string) => Promise<void>;
};

export type MenuApiClientOptions = {
  readonly apiBaseUrl?: string;
  readonly publicMenuUrl?: string;
  readonly fetcher?: Fetcher;
};

export class MenuApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MenuApiError";
    this.status = status;
  }
}

export function createMenuApiClient(options: MenuApiClientOptions = {}): MenuApiClient {
  const fetcher = options.fetcher ?? fetch;
  const apiBaseUrl = options.apiBaseUrl ?? defaultApiBaseUrl;
  const publicMenuUrl = options.publicMenuUrl ?? defaultPublicMenuUrl;

  return {
    getPublishedMenu: () => requestJson<DynamicMenu>(fetcher, publicMenuUrl),
    getDraftMenu: () => requestJson<DynamicMenu>(fetcher, adminUrl(apiBaseUrl, "/api/admin/menu/draft")),
    getDraft: async () => {
      const { body, response } = await requestJsonWithResponse<DynamicMenu>(fetcher, adminUrl(apiBaseUrl, "/api/admin/menu/draft"));
      return { menu: body, etag: response.headers.get("etag") };
    },
    getAdminSignInUrl: (returnTo) => {
      const signInUrl = adminUrl(apiBaseUrl, "/api/admin/sign-in");
      if (!returnTo) return signInUrl;
      return `${signInUrl}?returnTo=${encodeURIComponent(returnTo)}`;
    },
    getAdminSession: () => requestJson<AdminSession>(fetcher, adminUrl(apiBaseUrl, "/api/admin/session")),
    signInWithPassword: async (password) => {
      const result = await requestJson<{ readonly ok: true; readonly user: string; readonly strategy: "password" }>(fetcher, adminUrl(apiBaseUrl, "/api/admin/login"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      return { authenticated: true, strategy: result.strategy, user: result.user };
    },
    signOut: async () => {
      await requestJson<{ readonly ok: true }>(fetcher, adminUrl(apiBaseUrl, "/api/admin/logout"), {
        method: "POST",
      });
    },
    saveDraftMenu: async (menu, options = {}) => {
      const { body, response } = await requestJsonWithResponse<{ readonly ok: true; readonly etag?: string | null }>(fetcher, adminUrl(apiBaseUrl, "/api/admin/menu/draft"), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(options.ifMatch ? { "if-match": options.ifMatch } : {}),
        },
        body: JSON.stringify(menu),
      });
      return { etag: body.etag ?? response.headers.get("etag") };
    },
    publishDraftMenu: () =>
      requestJson<PublishResult>(fetcher, adminUrl(apiBaseUrl, "/api/admin/menu/publish"), {
        method: "POST",
      }),
    uploadMenuImage: (file) => {
      const formData = new FormData();
      formData.set("file", file);

      return requestJson<MenuImageUpload>(fetcher, adminUrl(apiBaseUrl, "/api/admin/images"), {
        method: "POST",
        body: formData,
      }).then((upload) => ({
        ...upload,
        url: absolutizeUrl(upload.url, apiBaseUrl),
      }));
    },
    deleteMenuImage: async (key) => {
      await requestJson<{ readonly ok: true }>(fetcher, `${adminUrl(apiBaseUrl, "/api/admin/images")}?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
    },
  };
}

function adminUrl(apiBaseUrl: string, path: string) {
  return joinUrl(apiBaseUrl, path);
}

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function absolutizeUrl(url: string, baseUrl: string) {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) return url;
  return joinUrl(baseUrl, url);
}

async function requestJson<T>(fetcher: Fetcher, input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return (await requestJsonWithResponse<T>(fetcher, input, init)).body;
}

async function requestJsonWithResponse<T>(fetcher: Fetcher, input: RequestInfo | URL, init?: RequestInit): Promise<{ readonly body: T; readonly response: Response }> {
  let response: Response;

  try {
    response = await fetcher(input, {
      credentials: "include",
      ...init,
    });
  } catch {
    throw new MenuApiError("Could not reach the menu API. Check your connection, then retry.", 0);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const message = isJson ? getErrorMessage(await response.json()) : getFallbackErrorMessage(response);
    throw new MenuApiError(message, response.status);
  }

  if (!isJson) {
    throw new MenuApiError("Expected a JSON response. The /api route is not reaching the menu Worker, or a sign-in page intercepted it.", response.status);
  }

  return { body: (await response.json()) as T, response };
}

function getErrorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return "Menu API request failed.";
}

function getFallbackErrorMessage(response: Response) {
  if (response.status === 401 || response.status === 403) return "You are not authorized to edit this menu.";
  if (response.status === 412) return "The draft was changed elsewhere. Reload the editor to get the latest version.";
  if (response.status === 429) return "Too many attempts. Wait a minute and try again.";
  return `Menu API request failed with status ${response.status}.`;
}
