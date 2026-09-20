import { describe, expect, it } from "vitest";
import type { MenuItem } from "../menu/menuSchema";
import { imageSrc, sortedSizes, variationLabel } from "./menuItemDisplay";

const baseItem: MenuItem = {
  id: "item-pizza",
  categoryId: "category-pizza",
  title: "Pizza",
  description: "",
  image: "",
  order: 0,
  isVisible: true,
  pricingMode: "sizes",
  price: "",
  sizes: [],
};

describe("sortedSizes", () => {
  it("orders sizes by their order field only, matching the admin drawer", () => {
    const item: MenuItem = {
      ...baseItem,
      sizes: [
        { id: "size-family", label: "Family", price: "20", order: 0 },
        { id: "size-large", label: "Large", price: "15", order: 1 },
        { id: "size-small", label: "Small", price: "8", order: 2 },
      ],
    };

    expect(sortedSizes(item).map((size) => size.id)).toEqual(["size-family", "size-large", "size-small"]);
  });

  it("drops sizes without a label or price and does not mutate the input", () => {
    const sizes = [
      { id: "size-b", label: "Medium", price: "10", order: 1 },
      { id: "size-blank", label: "  ", price: "5", order: 0 },
      { id: "size-free", label: "Large", price: "", order: 2 },
      { id: "size-a", label: "Small", price: "8", order: 0 },
    ];
    const item: MenuItem = { ...baseItem, sizes };

    expect(sortedSizes(item).map((size) => size.id)).toEqual(["size-a", "size-b"]);
    expect(item.sizes).toBe(sizes);
  });
});

describe("variationLabel", () => {
  it("abbreviates small, medium and large for display only", () => {
    expect(variationLabel({ id: "s", label: "Small", price: "5", order: 0 })).toBe("S");
    expect(variationLabel({ id: "m", label: " medium ", price: "6", order: 1 })).toBe("M");
    expect(variationLabel({ id: "l", label: "LARGE", price: "7", order: 2 })).toBe("L");
    expect(variationLabel({ id: "f", label: "Family", price: "9", order: 3 })).toBe("Family");
  });

  it("falls back to the price when the label is blank", () => {
    expect(variationLabel({ id: "x", label: " ", price: "7.50", order: 0 })).toBe("$7.50");
  });
});

describe("imageSrc", () => {
  it("returns empty string for empty input", () => {
    expect(imageSrc("")).toBe("");
  });

  it("keeps rooted and absolute urls", () => {
    expect(imageSrc("/assets/menu/a.webp")).toBe("/assets/menu/a.webp");
    expect(imageSrc("https://example.com/a.webp")).toBe("https://example.com/a.webp");
  });

  it("keeps data and blob urls intact", () => {
    expect(imageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(imageSrc("blob:https://example.com/123")).toBe("blob:https://example.com/123");
  });

  it("roots relative paths", () => {
    expect(imageSrc("assets/menu/a.webp")).toBe("/assets/menu/a.webp");
  });
});
