import { describe, expect, it } from "vitest";
import { demoSeedMenu } from "../testing/fixtures";
import { assertValidMenu, validateMenu } from "./validateMenu";

describe("validateMenu", () => {
  it("accepts the demo seed menu", () => {
    expect(validateMenu(demoSeedMenu)).toEqual([]);
    expect(() => assertValidMenu(demoSeedMenu)).not.toThrow();
  });

  it("rejects non-objects and wrong schema versions", () => {
    expect(validateMenu(null)).toEqual([{ path: "", message: "Menu must be an object." }]);
    expect(validateMenu({ ...demoSeedMenu, schemaVersion: 2 })).toContainEqual({ path: "schemaVersion", message: "Must be 1." });
  });

  it("reports orphan references", () => {
    const menu = {
      ...demoSeedMenu,
      categories: [{ ...demoSeedMenu.categories[0], groupId: "missing-group" }, ...demoSeedMenu.categories.slice(1)],
      items: [{ ...demoSeedMenu.items[0], categoryId: "missing-category" }, ...demoSeedMenu.items.slice(1)],
    };
    const paths = validateMenu(menu).map((issue) => issue.path);
    expect(paths).toContain("categories[0].groupId");
    expect(paths).toContain("items[0].categoryId");
  });

  it("reports duplicate ids, unknown icons, and empty size lists", () => {
    const menu = {
      ...demoSeedMenu,
      groups: [...demoSeedMenu.groups, { ...demoSeedMenu.groups[0], icon: "pizza" }],
      items: [{ ...demoSeedMenu.items[0], pricingMode: "sizes", sizes: [] }, ...demoSeedMenu.items.slice(1)],
    };
    const paths = validateMenu(menu).map((issue) => issue.path);
    expect(paths).toContain(`groups[${demoSeedMenu.groups.length}].id`);
    expect(paths).toContain(`groups[${demoSeedMenu.groups.length}].icon`);
    expect(paths).toContain("items[0].sizes");
  });

  it("checks testimonial ratings", () => {
    const menu = {
      ...demoSeedMenu,
      testimonials: [{ id: "t1", author: "A", rating: 6, text: "Great", order: 0, isVisible: true }],
    };
    expect(validateMenu(menu)).toEqual([{ path: "testimonials[0].rating", message: "Must be a whole number from 1 to 5." }]);
  });

  it("lists every issue in the thrown error", () => {
    expect(() => assertValidMenu({ ...demoSeedMenu, groups: "nope" })).toThrow(/groups: Must be an array\./);
  });
});
