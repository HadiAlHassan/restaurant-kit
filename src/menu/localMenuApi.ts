import { readMenuDraft, writeMenuDraft } from "./menuDraftStorage";
import type { AdminSession, MenuApiClient, MenuImageUpload, PublishResult } from "./menuApi";
import type { DynamicMenu } from "./menuSchema";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image file."));
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

const localSession: AdminSession = { authenticated: true, strategy: "local", user: "local" };

/** Browser-only adapter for localhost: drafts persist to localStorage under `storageKey`. */
export function createLocalMenuApiClient(initialMenu: DynamicMenu, storageKey: string): MenuApiClient {
  return {
    getAdminSession: async () => localSession,
    signInWithPassword: async () => localSession,
    signOut: async () => undefined,
    getPublishedMenu: async () => readMenuDraft(storageKey) ?? initialMenu,
    getDraftMenu: async () => readMenuDraft(storageKey) ?? initialMenu,
    getDraft: async () => ({ menu: readMenuDraft(storageKey) ?? initialMenu, etag: null }),
    getAdminSignInUrl: () => "/admin",
    saveDraftMenu: async (menu) => {
      writeMenuDraft(menu, storageKey);
      return { etag: null };
    },
    publishDraftMenu: async (): Promise<PublishResult> => ({ ok: true, backupKey: null }),
    uploadMenuImage: async (file): Promise<MenuImageUpload> => {
      const url = await fileToDataUrl(file);
      return {
        key: `local/images/${Date.now()}-${file.name}`,
        url,
      };
    },
    deleteMenuImage: async () => undefined,
  };
}

/**
 * localhost / 127.0.0.1 → browser-local adapter (no Worker needed), unless an API base URL is
 * configured, which opts the dev server into a real Worker (e.g. `wrangler dev` on :8787).
 */
export function shouldUseLocalMenuApi(apiBaseUrl = "") {
  if (typeof window === "undefined") return false;
  if (apiBaseUrl.trim()) return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}
