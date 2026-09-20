import { RequestError } from "./http";

export type R2Object = {
  readonly body: ReadableStream | null;
  readonly httpEtag: string;
  readonly writeHttpMetadata: (headers: Headers) => void;
};

export type R2PutOptions = {
  readonly httpMetadata?: Record<string, string>;
  /** R2 conditional write: the put is skipped (returns null) unless the stored etag matches. */
  readonly onlyIf?: { readonly etagMatches?: string };
};

export type R2PutResult = {
  readonly httpEtag: string;
};

export type R2ListedObject = {
  readonly key: string;
  readonly size: number;
  readonly uploaded: Date;
};

export type R2Bucket = {
  readonly get: (key: string) => Promise<R2Object | null>;
  readonly put: (key: string, value: string | ArrayBuffer | ReadableStream, options?: R2PutOptions) => Promise<R2PutResult | null | undefined | unknown>;
  readonly delete: (key: string) => Promise<void>;
  readonly list?: (options: { readonly prefix: string; readonly limit?: number }) => Promise<{ readonly objects: readonly R2ListedObject[] }>;
};

export type MenuBackup = {
  readonly key: string;
  /** ISO timestamp of the publish that this backup preceded. */
  readonly publishedAt: string;
  readonly size: number;
};

export type RestoreSource = { readonly kind: "published" } | { readonly kind: "backup"; readonly key: string };

export type RestoreDraftResult = { readonly status: "restored"; readonly etag: string | null } | { readonly status: "not-found" } | { readonly status: "invalid-key" };

const maxListedBackups = 30;

/** Browser-reported MIME types accepted for menu images; anything else is rejected with 415. */
export const allowedImageTypes: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
export const maxImageUploadBytes = 5 * 1024 * 1024;

export type PublishResult =
  | { readonly status: "no-draft" }
  | { readonly status: "published"; readonly backupKey: string | null };

export type DraftRecord = {
  readonly menu: unknown;
  /** Quoted HTTP etag of the stored draft object, for If-Match round trips. */
  readonly etag: string | null;
};

export type SaveDraftResult = { readonly status: "saved"; readonly etag: string | null } | { readonly status: "conflict" };

export type MenuStorage = {
  readonly getPublished: () => Promise<unknown | null>;
  readonly getDraft: () => Promise<DraftRecord | null>;
  readonly getAsset: (key: string) => Promise<R2Object | null>;
  /** With `ifMatch`, the write only lands when the stored draft still carries that etag. */
  readonly saveDraft: (menu: object, options?: { readonly ifMatch?: string | null }) => Promise<SaveDraftResult>;
  readonly publishDraft: () => Promise<PublishResult>;
  readonly uploadImage: (file: File) => Promise<{ key: string }>;
  readonly deleteImage: (key: string) => Promise<boolean>;
  /** Backups written by publishDraft, newest first. */
  readonly listBackups: () => Promise<readonly MenuBackup[]>;
  /** Overwrites the draft with the published menu or one of its backups. */
  readonly restoreDraft: (source: RestoreSource) => Promise<RestoreDraftResult>;
};

function menuKeys(restaurantId: string) {
  const base = `restaurants/${restaurantId}`;

  return {
    published: `${base}/published/menu.json`,
    draft: `${base}/draft/menu.json`,
    backup: `${base}/backups/published-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    backupPrefix: `${base}/backups/`,
    imagePrefix: `${base}/images/menu`,
  };
}

/** `published-2026-07-02T12-30-00-000Z.json` → `2026-07-02T12:30:00.000Z`; null when the key is not ours. */
export function backupTimestampFromKey(key: string) {
  const match = key.match(/published-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/);
  if (!match) return null;
  const [, date, hours, minutes, seconds, millis] = match;
  return `${date}T${hours}:${minutes}:${seconds}.${millis}Z`;
}

/** HTTP etags arrive quoted (and possibly weak); R2's `etagMatches` wants the bare value. */
export function normalizeEtag(etag: string) {
  return etag.trim().replace(/^W\//i, "").replace(/^"(.*)"$/, "$1");
}

function normalizeFilename(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "") || "menu-image"
  );
}

async function readJsonRecord(bucket: R2Bucket, key: string): Promise<DraftRecord | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return { menu: await new Response(object.body).json(), etag: object.httpEtag ?? null };
}

async function readJsonObject(bucket: R2Bucket, key: string) {
  return (await readJsonRecord(bucket, key))?.menu ?? null;
}

function isPutResult(value: unknown): value is R2PutResult {
  return Boolean(value && typeof value === "object" && "httpEtag" in value);
}

async function writeJsonObject(bucket: R2Bucket, key: string, value: unknown, onlyIf?: R2PutOptions["onlyIf"]) {
  const result = await bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    ...(onlyIf ? { onlyIf } : {}),
  });
  // R2 answers null when an onlyIf precondition fails; undefined (test doubles) means "stored, etag unknown".
  if (result === null) return null;
  return { etag: isPutResult(result) ? result.httpEtag : null };
}

export function createMenuStorage(bucket: R2Bucket, restaurantId: string): MenuStorage {
  return {
    getPublished: () => readJsonObject(bucket, menuKeys(restaurantId).published),
    getDraft: () => readJsonRecord(bucket, menuKeys(restaurantId).draft),
    // Only objects under this restaurant's image prefix are servable; the draft menu, backups,
    // and other tenants' keys must stay unreachable through /api/assets/*.
    getAsset: async (key) => {
      if (!key.startsWith(`${menuKeys(restaurantId).imagePrefix}/`)) return null;
      return bucket.get(key);
    },
    saveDraft: async (menu, options = {}) => {
      const onlyIf = options.ifMatch ? { etagMatches: normalizeEtag(options.ifMatch) } : undefined;
      const written = await writeJsonObject(bucket, menuKeys(restaurantId).draft, { ...menu, updatedAt: new Date().toISOString() }, onlyIf);
      if (!written) return { status: "conflict" };
      return { status: "saved", etag: written.etag };
    },
    publishDraft: async () => {
      const keys = menuKeys(restaurantId);
      const draft = await readJsonObject(bucket, keys.draft);
      if (!draft) return { status: "no-draft" };

      const published = await readJsonObject(bucket, keys.published);
      if (published) await writeJsonObject(bucket, keys.backup, published);

      await writeJsonObject(bucket, keys.published, { ...(draft as object), updatedAt: new Date().toISOString() });
      return { status: "published", backupKey: published ? keys.backup : null };
    },
    uploadImage: async (file) => {
      if (!allowedImageTypes.has(file.type)) throw new RequestError("Unsupported image type. Use JPEG, PNG, WebP, AVIF, or GIF.", 415);
      if (file.size > maxImageUploadBytes) throw new RequestError(`Image is too large. Maximum size is ${maxImageUploadBytes / (1024 * 1024)} MB.`, 413);

      const key = `${menuKeys(restaurantId).imagePrefix}/${Date.now()}-${normalizeFilename(file.name)}`;
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: file.type,
        },
      });

      return { key };
    },
    deleteImage: async (key) => {
      if (!key.startsWith(`${menuKeys(restaurantId).imagePrefix}/`)) return false;

      await bucket.delete(key);
      return true;
    },
    listBackups: async () => {
      if (!bucket.list) return [];
      const { backupPrefix } = menuKeys(restaurantId);
      const { objects } = await bucket.list({ prefix: backupPrefix, limit: 1000 });

      return objects
        .map((object) => ({ key: object.key, publishedAt: backupTimestampFromKey(object.key) ?? object.uploaded.toISOString(), size: object.size }))
        .sort((first, second) => second.publishedAt.localeCompare(first.publishedAt))
        .slice(0, maxListedBackups);
    },
    restoreDraft: async (source) => {
      const keys = menuKeys(restaurantId);
      let sourceKey = keys.published;
      if (source.kind === "backup") {
        if (!source.key.startsWith(keys.backupPrefix) || source.key.includes("..")) return { status: "invalid-key" };
        sourceKey = source.key;
      }

      const menu = await readJsonObject(bucket, sourceKey);
      if (!menu) return { status: "not-found" };

      const written = await writeJsonObject(bucket, keys.draft, { ...(menu as object), updatedAt: new Date().toISOString() });
      return { status: "restored", etag: written?.etag ?? null };
    },
  };
}
