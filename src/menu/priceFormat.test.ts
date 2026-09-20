import { describe, expect, it } from "vitest";
import { formatPrice, formatPriceTotal, priceInputValue } from "./priceFormat";

describe("formatPrice", () => {
  it("formats plain numbers as USD", () => {
    expect(formatPrice("7.50")).toBe("$7.50");
  });

  it("does not double-prefix dollar prices", () => {
    expect(formatPrice("7.50$")).toBe("$7.50");
    expect(formatPrice("$7.50")).toBe("$7.50");
  });

  it("supports LBP prices", () => {
    expect(formatPrice("250000 LBP")).toBe("250000 LBP");
  });

  it("returns empty labels for blank and invalid prices", () => {
    expect(formatPrice("")).toBe("");
    expect(formatPrice("market")).toBe("");
  });
});

describe("formatPriceTotal", () => {
  it("totals USD prices", () => {
    expect(formatPriceTotal("7.50", 2)).toBe("$15");
  });

  it("totals LBP prices without converting the currency", () => {
    expect(formatPriceTotal("250000 LBP", 2)).toBe("500000 LBP");
  });

  it("keeps thousands separators when the price uses them", () => {
    expect(formatPriceTotal("150,000 LBP", 2)).toBe("300,000 LBP");
    expect(formatPriceTotal("$1,250.50", 3)).toBe("$3,751.50");
  });

  it("keeps two decimals for fractional totals", () => {
    expect(formatPriceTotal("7.50", 1)).toBe("$7.50");
    expect(formatPriceTotal("0.1", 3)).toBe("$0.30");
  });

  it("returns empty labels for blank and invalid totals", () => {
    expect(formatPriceTotal("", 2)).toBe("");
    expect(formatPriceTotal("market", 2)).toBe("");
  });
});

describe("priceInputValue", () => {
  it("splits a price into amount and currency", () => {
    expect(priceInputValue("250000 LBP")).toEqual({ amount: "250000", currency: "LBP" });
    expect(priceInputValue("$7.50")).toEqual({ amount: "7.50", currency: "USD" });
  });

  it("keeps the current currency when the amount is cleared", () => {
    expect(priceInputValue("", "LBP")).toEqual({ amount: "", currency: "LBP" });
    expect(priceInputValue("   ", "LBP")).toEqual({ amount: "", currency: "LBP" });
  });

  it("defaults to USD without a fallback", () => {
    expect(priceInputValue("")).toEqual({ amount: "", currency: "USD" });
  });
});
