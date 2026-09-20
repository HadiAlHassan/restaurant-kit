import { describe, expect, it } from "vitest";
import { createMenuStorage, maxImageUploadBytes, type R2Bucket, type R2Object } from "./menuStorage";

type StoredObject = {
  readonly value: string | ArrayBuffer | ReadableStream;
  readonly contentType?: string;
  readonly etag: string;
};

function createFakeBucket(initial: Record<string, unknown> = {}) {
  const objects = new Map<string, StoredObject>();
  let version = 0;
  const nextEtag = () => `"v${++version}"`;

  for (const [key, value] of Object.entries(initial)) {
    objects.set(key, { value: JSON.stringify(value), contentType: "application/json; charset=utf-8", etag: nextEtag() });
  }

  const bucket: R2Bucket = {
    get: async (key) => {
      const stored = objects.get(key);
      if (!stored) return null;

      const object: R2Object = {
        body: new Response(stored.value as string).body,
        httpEtag: stored.etag,
        writeHttpMetadata: () => undefined,
      };
      return object;
    },
    put: async (key, value, options) => {
      const etagMatches = options?.onlyIf?.etagMatches;
      if (etagMatches && objects.get(key)?.etag !== etagMatches) return null;

      const stored = { value, contentType: options?.httpMetadata?.contentType, etag: nextEtag() };
      objects.set(key, stored);
      return { httpEtag: stored.etag };
    },
    delete: async (key) => {
      objects.delete(key);
    },
  };

  return { bucket, objects };
}

const publishedKey = "restaurants/demo/published/menu.json";
const draftKey = "restaurants/demo/draft/menu.json";
const imagePrefix = "restaurants/demo/images/menu";

const draftMenu = { schemaVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z", groups: [], categories: [], items: [{ id: "item-1" }] };
const publishedMenu = { schemaVersion: 1, updatedAt: "2025-12-01T00:00:00.000Z", groups: [], categories: [], items: [] };

describe("menu json storage", () => {
  it("reads published and draft menus by restaurant key", async () => {
    const { bucket } = createFakeBucket({ [publishedKey]: publishedMenu, [draftKey]: draftMenu });
    const storage = createMenuStorage(bucket, "demo");

    expect(await storage.getPublished()).toEqual(publishedMenu);
    expect(await storage.getDraft()).toEqual({ menu: draftMenu, etag: '"v2"' });
  });

  it("rejects a draft save whose If-Match etag is stale", async () => {
    const { bucket } = createFakeBucket({ [draftKey]: draftMenu });
    const storage = createMenuStorage(bucket, "demo");
    const first = await storage.getDraft();

    const saved = await storage.saveDraft({ ...draftMenu, items: [] }, { ifMatch: first?.etag });
    expect(saved).toEqual({ status: "saved", etag: '"v2"' });

    const stale = await storage.saveDraft({ ...draftMenu, items: [{ id: "late" }] }, { ifMatch: first?.etag });
    expect(stale).toEqual({ status: "conflict" });
    expect(((await storage.getDraft())?.menu as { items: unknown[] }).items).toEqual([]);

    const unconditional = await storage.saveDraft({ ...draftMenu, items: [{ id: "forced" }] });
    expect(unconditional.status).toBe("saved");
  });

  it("returns null for missing menus", async () => {
    const { bucket } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");

    expect(await storage.getPublished()).toBeNull();
    expect(await storage.getDraft()).toBeNull();
  });

  it("saves the draft with a fresh updatedAt stamp", async () => {
    const { bucket, objects } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");

    await storage.saveDraft(draftMenu);

    const stored = JSON.parse(objects.get(draftKey)?.value as string);
    expect(stored.items).toEqual(draftMenu.items);
    expect(stored.updatedAt).not.toBe(draftMenu.updatedAt);
    expect(objects.get(draftKey)?.contentType).toBe("application/json; charset=utf-8");
  });
});

describe("publishDraft", () => {
  it("reports no-draft when there is nothing to publish", async () => {
    const { bucket } = createFakeBucket({ [publishedKey]: publishedMenu });
    const storage = createMenuStorage(bucket, "demo");

    expect(await storage.publishDraft()).toEqual({ status: "no-draft" });
  });

  it("publishes without a backup when nothing was published before", async () => {
    const { bucket, objects } = createFakeBucket({ [draftKey]: draftMenu });
    const storage = createMenuStorage(bucket, "demo");

    const result = await storage.publishDraft();

    expect(result).toEqual({ status: "published", backupKey: null });
    const published = JSON.parse(objects.get(publishedKey)?.value as string);
    expect(published.items).toEqual(draftMenu.items);
  });

  it("backs up the previous published menu before overwriting", async () => {
    const { bucket, objects } = createFakeBucket({ [draftKey]: draftMenu, [publishedKey]: publishedMenu });
    const storage = createMenuStorage(bucket, "demo");

    const result = await storage.publishDraft();

    expect(result.status).toBe("published");
    const backupKey = result.status === "published" ? result.backupKey : null;
    expect(backupKey).toMatch(/^restaurants\/demo\/backups\/published-/);

    const backup = JSON.parse(objects.get(backupKey!)?.value as string);
    expect(backup).toEqual(publishedMenu);

    const published = JSON.parse(objects.get(publishedKey)?.value as string);
    expect(published.items).toEqual(draftMenu.items);
    expect(published.updatedAt).not.toBe(draftMenu.updatedAt);
  });
});

describe("images", () => {
  it("uploads under the menu image prefix with a normalized filename", async () => {
    const { bucket, objects } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");
    const file = new File(["binary"], "Crème Brûlée Photo.WEBP", { type: "image/webp" });

    const { key } = await storage.uploadImage(file);

    expect(key).toMatch(new RegExp(`^${imagePrefix}/\\d+-creme-brulee-photo\\.webp$`));
    expect(objects.get(key)?.contentType).toBe("image/webp");
  });

  it("uses a default name when the filename normalizes to nothing", async () => {
    const { bucket, objects } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");
    const file = new File(["binary"], "???", { type: "image/png" });

    const { key } = await storage.uploadImage(file);

    expect(key).toMatch(new RegExp(`^${imagePrefix}/\\d+-menu-image$`));
    expect(objects.get(key)?.contentType).toBe("image/png");
  });

  it("rejects non-image and untyped uploads with 415", async () => {
    const { bucket, objects } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");

    await expect(storage.uploadImage(new File(["<script>"], "x.html", { type: "text/html" }))).rejects.toMatchObject({ status: 415 });
    await expect(storage.uploadImage(new File(["binary"], "x", { type: "" }))).rejects.toMatchObject({ status: 415 });
    await expect(storage.uploadImage(new File(["binary"], "x.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({ status: 415 });
    expect(objects.size).toBe(0);
  });

  it("rejects oversized uploads with 413", async () => {
    const { bucket, objects } = createFakeBucket();
    const storage = createMenuStorage(bucket, "demo");
    const file = new File([new Uint8Array(maxImageUploadBytes + 1)], "big.png", { type: "image/png" });

    await expect(storage.uploadImage(file)).rejects.toMatchObject({ status: 413 });
    expect(objects.size).toBe(0);
  });

  it("serves only objects under the menu image prefix", async () => {
    const imageKey = `${imagePrefix}/123-burger.webp`;
    const { bucket } = createFakeBucket({ [imageKey]: "binary", [draftKey]: draftMenu, "restaurants/other/images/menu/1.webp": "x" });
    const storage = createMenuStorage(bucket, "demo");

    expect(await storage.getAsset(imageKey)).not.toBeNull();
    expect(await storage.getAsset(draftKey)).toBeNull();
    expect(await storage.getAsset("restaurants/other/images/menu/1.webp")).toBeNull();
    expect(await storage.getAsset("")).toBeNull();
  });

  it("deletes only keys inside the menu image prefix", async () => {
    const imageKey = `${imagePrefix}/123-burger.webp`;
    const { bucket, objects } = createFakeBucket({ [imageKey]: "binary", [publishedKey]: publishedMenu });
    const storage = createMenuStorage(bucket, "demo");

    expect(await storage.deleteImage(imageKey)).toBe(true);
    expect(objects.has(imageKey)).toBe(false);

    expect(await storage.deleteImage(publishedKey)).toBe(false);
    expect(objects.has(publishedKey)).toBe(true);
  });
});
