import { Utensils } from "lucide-react";
import { describe, expect, it } from "vitest";
import { menuIconFor, menuIcons } from "./menuIcons";

describe("menuIconFor", () => {
  it("returns the mapped icon for a known id", () => {
    expect(menuIconFor("drink")).toBe(menuIcons.drink);
  });

  it("falls back to the plate icon for an unknown id", () => {
    expect(menuIconFor("not-an-icon")).toBe(Utensils);
  });
});
