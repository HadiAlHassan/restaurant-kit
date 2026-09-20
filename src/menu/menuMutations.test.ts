import { describe, expect, it } from "vitest";
import { getOrderedMenu, sortByOrder } from "./menuOrdering";
import { addMenuCategory, addMenuGroup, addMenuItem, addMenuSize, deleteMenuCategory, deleteMenuGroup, deleteMenuItem, deleteMenuSize, updateMenuCategory, updateMenuGroup, updateMenuItem, updateMenuSize } from "./menuMutations";
import type { DynamicMenu, MenuCategory, MenuGroup, MenuItem, MenuSize } from "./menuSchema";

function group(id: string, order: number): MenuGroup {
  return {
    id,
    label: id,
    icon: "plate",
    order,
    isVisible: true,
  };
}

function category(id: string, groupId: string, order: number): MenuCategory {
  return {
    id,
    groupId,
    title: id,
    order,
    isVisible: true,
  };
}

function item(id: string, categoryId: string, order: number): MenuItem {
  return {
    id,
    categoryId,
    title: id,
    description: "",
    image: "",
    order,
    isVisible: true,
    pricingMode: "single",
    price: "",
    sizes: [],
  };
}

function size(id: string, order: number): MenuSize {
  return {
    id,
    label: id,
    price: "",
    order,
  };
}

function menu(overrides: Partial<DynamicMenu> = {}): DynamicMenu {
  return {
    schemaVersion: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    restaurant: {
      id: "demo",
      name: "Demo Grill",
      tagline: "Savor the flavor",
      phone: "+96178700690",
      whatsapp: "96178700690",
      address: "Saida",
    },
    groups: [group("all", 0), group("starters", 1), group("burgers", 2)],
    categories: [category("appetizers", "starters", 0), category("classic-burgers", "burgers", 1)],
    items: [item("jalapenos", "appetizers", 0), item("classic", "classic-burgers", 0)],
    ...overrides,
  };
}

function ids(items: readonly { readonly id: string }[]) {
  return items.map((nextItem) => nextItem.id);
}

describe("menu mutations", () => {
  it("adds and updates menu groups", () => {
    const withGroup = addMenuGroup(menu(), group("drinks", 99));
    const updated = updateMenuGroup(withGroup, "drinks", { label: "Drinks", icon: "drink" });

    expect(ids(sortByOrder(updated.groups))).toEqual(["all", "starters", "burgers", "drinks"]);
    expect(updated.groups.find((nextGroup) => nextGroup.id === "drinks")).toMatchObject({ label: "Drinks", icon: "drink", order: 3 });
  });

  it("does not delete pinned or non-empty menu groups", () => {
    const sourceMenu = menu();

    expect(deleteMenuGroup(sourceMenu, "all")).toBe(sourceMenu);
    expect(deleteMenuGroup(sourceMenu, "starters")).toBe(sourceMenu);
  });

  it("deletes empty menu groups and normalizes order", () => {
    const sourceMenu = menu({
      groups: [group("all", 0), group("starters", 1), group("empty", 2), group("burgers", 3)],
    });

    const nextMenu = deleteMenuGroup(sourceMenu, "empty");

    expect(ids(sortByOrder(nextMenu.groups))).toEqual(["all", "starters", "burgers"]);
    expect(sortByOrder(nextMenu.groups).map((nextGroup) => nextGroup.order)).toEqual([0, 1, 2]);
  });

  it("adds, updates, and deletes empty categories", () => {
    const withCategory = addMenuCategory(menu(), category("salads", "starters", 99));
    const updated = updateMenuCategory(withCategory, "salads", { title: "Salads" });
    const deleted = deleteMenuCategory(updated, "salads");

    expect(updated.categories.find((nextCategory) => nextCategory.id === "salads")).toMatchObject({ title: "Salads", order: 1 });
    expect(ids(getOrderedMenu(deleted).sections.map(({ section }) => section))).toEqual(["appetizers", "classic-burgers"]);
  });

  it("does not delete categories that contain items", () => {
    const sourceMenu = menu();

    expect(deleteMenuCategory(sourceMenu, "appetizers")).toBe(sourceMenu);
  });

  it("keeps section render order aligned after moving a category between groups", () => {
    const sourceMenu = menu({
      groups: [group("all", 0), group("burgers", 1), group("starters", 2)],
    });
    const nextMenu = updateMenuCategory(sourceMenu, "appetizers", { groupId: "burgers" });

    expect(ids(getOrderedMenu(nextMenu).sections.map(({ section }) => section))).toEqual(["classic-burgers", "appetizers"]);
  });

  it("adds, updates, and deletes menu items within one category", () => {
    const withItem = addMenuItem(menu(), item("fries", "appetizers", 99));
    const updated = updateMenuItem(withItem, "fries", { title: "Fries", price: "3.50" });
    const deleted = deleteMenuItem(updated, "jalapenos");
    const appetizerItems = getOrderedMenu(deleted).sections.find(({ section }) => section.id === "appetizers")?.items ?? [];

    expect(updated.items.find((nextItem) => nextItem.id === "fries")).toMatchObject({ title: "Fries", price: "3.50", order: 1 });
    expect(ids(appetizerItems)).toEqual(["fries"]);
    expect(appetizerItems[0]?.order).toBe(0);
    expect(deleted.items.find((nextItem) => nextItem.id === "classic")?.order).toBe(0);
  });

  it("adds, updates, and deletes menu sizes", () => {
    const withSizedItem = updateMenuItem(menu(), "jalapenos", { pricingMode: "sizes", sizes: [size("small", 0), size("large", 1)] });
    const withSize = addMenuSize(withSizedItem, "jalapenos", size("medium", 99));
    const updated = updateMenuSize(withSize, "jalapenos", "medium", { label: "Medium", price: "5.50" });
    const deleted = deleteMenuSize(updated, "jalapenos", "small");
    const sizes = sortByOrder(deleted.items.find((nextItem) => nextItem.id === "jalapenos")?.sizes ?? []);

    expect(updated.items.find((nextItem) => nextItem.id === "jalapenos")?.sizes.find((nextSize) => nextSize.id === "medium")).toMatchObject({ label: "Medium", price: "5.50", order: 2 });
    expect(ids(sizes)).toEqual(["large", "medium"]);
    expect(sizes.map((nextSize) => nextSize.order)).toEqual([0, 1]);
  });

  it("keeps orphaned categories across unrelated category edits", () => {
    const source = menu({
      groups: [group("all", 0), group("a", 1)],
      categories: [category("a1", "a", 0), category("a2", "a", 1), category("orphan", "missing", 9)],
      items: [item("i1", "a1", 0)],
    });

    expect(ids(updateMenuCategory(source, "a1", { title: "Renamed" }).categories)).toContain("orphan");
    expect(ids(deleteMenuCategory(source, "a2").categories)).toEqual(["a1", "orphan"]);
  });

  it("returns the same menu object when an update targets nothing", () => {
    const source = menu();

    expect(updateMenuGroup(source, "missing", { label: "x" })).toBe(source);
    expect(updateMenuCategory(source, "missing", { title: "x" })).toBe(source);
    expect(updateMenuItem(source, "missing", { title: "x" })).toBe(source);
    expect(deleteMenuCategory(source, "missing")).toBe(source);
  });
});
