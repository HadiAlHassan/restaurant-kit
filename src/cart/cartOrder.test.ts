import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppOrderUrl, cartSelectionKey, formatVariationName } from "./cartOrder";
import type { CartItem } from "./cartTypes";

const orderConfig = { whatsappNumber: "96170000000", orderGreeting: "Hi Demo Grill, I'd like to order:" };

const burger: CartItem = { key: "item-burger:size-large", itemId: "item-burger", itemName: "Smash burger", variationId: "size-large", variationName: "large", quantity: 2 };
const fries: CartItem = { key: "item-fries:default", itemId: "item-fries", itemName: "Fries", quantity: 1 };

describe("cartSelectionKey", () => {
  it("combines item and variation ids", () => {
    expect(cartSelectionKey(burger)).toBe("item-burger:size-large");
  });

  it("falls back to default for single-price items", () => {
    expect(cartSelectionKey(fries)).toBe("item-fries:default");
  });

  it("appends removed ingredients sorted and case-insensitive so pick order never splits lines", () => {
    const withRemovals = { ...fries, removedIngredients: ["Pickles", "garlic sauce"] };
    const reordered = { ...fries, removedIngredients: ["Garlic Sauce", "pickles"] };

    expect(cartSelectionKey(withRemovals)).toBe("item-fries:default:no=garlic sauce,pickles");
    expect(cartSelectionKey(reordered)).toBe(cartSelectionKey(withRemovals));
    expect(cartSelectionKey(withRemovals)).not.toBe(cartSelectionKey(fries));
  });
});

describe("formatVariationName", () => {
  it("capitalizes the variation", () => {
    expect(formatVariationName("large")).toBe("Large");
  });

  it("returns empty string when missing", () => {
    expect(formatVariationName(undefined)).toBe("");
  });
});

describe("buildWhatsAppMessage", () => {
  it("lists quantities, names, and variations with name/address prompts", () => {
    expect(buildWhatsAppMessage([burger, fries], "", orderConfig)).toBe(
      ["Hi Demo Grill, I'd like to order:", "", "2x Smash burger - Large", "1x Fries", "", "", "Name:", "Address:"].join("\n"),
    );
  });

  it("adds item notes under their lines and an order note block", () => {
    const notedBurger = { ...burger, note: "  no pickles, extra mayo " };

    expect(buildWhatsAppMessage([notedBurger, fries], " ring the bell, 2nd floor ", orderConfig)).toBe(
      [
        "Hi Demo Grill, I'd like to order:",
        "",
        "2x Smash burger - Large",
        "   Note: no pickles, extra mayo",
        "1x Fries",
        "",
        "Order note: ring the bell, 2nd floor",
        "",
        "",
        "Name:",
        "Address:",
      ].join("\n"),
    );
  });

  it("lists removed ingredients on a No: line above the note", () => {
    const customized = { ...burger, removedIngredients: ["Pickles", "Mushrooms"], note: "extra mayo" };

    expect(buildWhatsAppMessage([customized], "", orderConfig)).toBe(
      [
        "Hi Demo Grill, I'd like to order:",
        "",
        "2x Smash burger - Large",
        "   No: Pickles, Mushrooms",
        "   Note: extra mayo",
        "",
        "",
        "Name:",
        "Address:",
      ].join("\n"),
    );
  });

  it("skips blank notes", () => {
    expect(buildWhatsAppMessage([{ ...burger, note: "   " }], "  ", orderConfig)).toBe(
      ["Hi Demo Grill, I'd like to order:", "", "2x Smash burger - Large", "", "", "Name:", "Address:"].join("\n"),
    );
  });

  it("can use injected restaurant order copy", () => {
    expect(buildWhatsAppMessage([fries], "", { whatsappNumber: "123", orderGreeting: "Hi Client, order:" })).toBe(
      ["Hi Client, order:", "", "1x Fries", "", "", "Name:", "Address:"].join("\n"),
    );
  });
});

describe("buildWhatsAppOrderUrl", () => {
  it("targets the restaurant number with the encoded message", () => {
    const url = new URL(buildWhatsAppOrderUrl([fries], "", orderConfig));

    expect(url.origin + url.pathname).toBe("https://wa.me/96170000000");
    expect(url.searchParams.get("text")).toBe(buildWhatsAppMessage([fries], "", orderConfig));
  });

  it("can target an injected restaurant number", () => {
    const config = { whatsappNumber: "123456", orderGreeting: "Hi Client, order:" };
    const url = new URL(buildWhatsAppOrderUrl([fries], "", config));

    expect(url.origin + url.pathname).toBe("https://wa.me/123456");
    expect(url.searchParams.get("text")).toBe(buildWhatsAppMessage([fries], "", config));
  });
});
