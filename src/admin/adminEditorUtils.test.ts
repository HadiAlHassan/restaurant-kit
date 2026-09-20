import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuApiError } from "../menu/menuApi";
import { emptyItem, formatPrice, getApiErrorMessage, imageSource, isLikelyAuthError, slugify, sortableDataFromEntity, uniqueId } from "./adminEditorUtils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Chicken Wrap Deluxe")).toBe("chicken-wrap-deluxe");
  });

  it("strips accents", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("replaces ampersands with and", () => {
    expect(slugify("Fish & Chips")).toBe("fish-and-chips");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  ~~Fries!!  ")).toBe("fries");
  });

  it("falls back to untitled", () => {
    expect(slugify("???")).toBe("untitled");
  });
});

describe("uniqueId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("combines prefix, slug, and a random suffix", () => {
    expect(uniqueId("item", "New Item")).toMatch(/^item-new-item-[0-9a-z-]+$/);
  });

  it("never collides within the same millisecond", () => {
    const ids = Array.from({ length: 200 }, () => uniqueId("item", "New Item"));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to a counter when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    const ids = Array.from({ length: 50 }, () => uniqueId("group", "Drinks"));

    expect(ids[0]).toMatch(/^group-drinks-[0-9a-z]+-[0-9a-z]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("imageSource", () => {
  it("returns empty string for empty input", () => {
    expect(imageSource("")).toBe("");
  });

  it("keeps rooted and absolute urls", () => {
    expect(imageSource("/assets/menu/a.webp")).toBe("/assets/menu/a.webp");
    expect(imageSource("http://example.com/a.webp")).toBe("http://example.com/a.webp");
    expect(imageSource("https://example.com/a.webp")).toBe("https://example.com/a.webp");
  });

  it("keeps data and blob urls intact", () => {
    expect(imageSource("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(imageSource("blob:http://localhost:5173/9b2c")).toBe("blob:http://localhost:5173/9b2c");
  });

  it("roots relative paths", () => {
    expect(imageSource("assets/menu/a.webp")).toBe("/assets/menu/a.webp");
  });
});

describe("formatPrice", () => {
  it("prefixes with dollar sign", () => {
    expect(formatPrice("7.50")).toBe("$7.50");
  });

  it("does not double-prefix existing dollar prices", () => {
    expect(formatPrice("7.50$")).toBe("$7.50");
    expect(formatPrice("$7.50")).toBe("$7.50");
  });

  it("allows LBP prices", () => {
    expect(formatPrice("250000 LBP")).toBe("250000 LBP");
  });

  it("returns empty string for empty price", () => {
    expect(formatPrice("")).toBe("");
  });
});

describe("emptyItem", () => {
  it("creates a visible single-price item in the category", () => {
    const item = emptyItem("category-wraps");

    expect(item.categoryId).toBe("category-wraps");
    expect(item.title).toBe("New menu item");
    expect(item.isVisible).toBe(true);
    expect(item.pricingMode).toBe("single");
    expect(item.sizes).toEqual([]);
    expect(item.id).toMatch(/^item-new-item-/);
  });
});

describe("getApiErrorMessage", () => {
  it("uses MenuApiError message", () => {
    expect(getApiErrorMessage(new MenuApiError("Not authorized", 403))).toBe("Not authorized");
  });

  it("uses plain Error message", () => {
    expect(getApiErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back for unknown values", () => {
    expect(getApiErrorMessage("nope")).toBe("Unexpected menu API error.");
  });
});

describe("isLikelyAuthError", () => {
  it("matches auth-flavored messages", () => {
    expect(isLikelyAuthError(new Error("Cloudflare Access may require sign-in first."))).toBe(true);
    expect(isLikelyAuthError(new Error("Expected a JSON response."))).toBe(true);
    expect(isLikelyAuthError(new MenuApiError("Could not reach the menu API. Check your connection, then retry.", 0))).toBe(true);
    expect(isLikelyAuthError(new MenuApiError("You are not authorized to edit this menu.", 403))).toBe(true);
    expect(isLikelyAuthError(new MenuApiError("Unauthorized.", 401))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isLikelyAuthError(new Error("Menu API request failed with status 500."))).toBe(false);
  });
});

describe("sortableDataFromEntity", () => {
  it("prefers attached sortable data", () => {
    expect(sortableDataFromEntity({ id: "group:x", data: { kind: "item", id: "item-1", categoryId: "cat-1" } })).toEqual({ kind: "item", id: "item-1", categoryId: "cat-1" });
  });

  it("decodes group ids", () => {
    expect(sortableDataFromEntity({ id: "group:group-wraps" })).toEqual({ kind: "group", id: "group-wraps" });
  });

  it("decodes item ids without a category", () => {
    expect(sortableDataFromEntity({ id: "item:item-1" })).toEqual({ kind: "item", id: "item-1", categoryId: "" });
  });

  it("returns null for unknown entities", () => {
    expect(sortableDataFromEntity(null)).toBeNull();
    expect(sortableDataFromEntity({ id: "mystery" })).toBeNull();
  });
});
