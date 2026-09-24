import { describe, expect, it } from "vitest";
import { getOrderedMenu, moveGroup, moveGroupBefore, moveItemBefore, moveSection, moveSectionBefore, normalizeOrder, renumberSections, sortByOrder } from "./menuOrdering";
import type { DynamicMenu, MenuCategory, MenuGroup, MenuItem } from "./menuSchema";

function group(id: string, order: number): MenuGroup {
  return {
    id,
    label: id,
    icon: "plate",
    order,
    isVisible: true,
  };
}

function section(id: string, groupId: string, order: number): MenuCategory {
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

function menu(overrides: Partial<DynamicMenu> = {}): DynamicMenu {
  return {
    schemaVersion: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    restaurant: {
      id: "demo",
      name: "Demo Grill",
      tagline: "Savor the flavor",
      phone: "+96170000000",
      whatsapp: "96170000000",
      address: "Saida",
    },
    groups: [group("all", 0), group("starters", 1), group("burgers", 2), group("drinks", 3)],
    categories: [section("appetizers", "starters", 0), section("classic-burgers", "burgers", 1), section("soft-drinks", "drinks", 2)],
    items: [item("mozzarella", "appetizers", 1), item("jalapenos", "appetizers", 0), item("classic", "classic-burgers", 0), item("water", "soft-drinks", 0)],
    ...overrides,
  };
}

function ids(items: readonly { readonly id: string }[]) {
  return items.map((nextItem) => nextItem.id);
}

describe("menu ordering", () => {
  it("sorts and normalizes by the explicit order field", () => {
    expect(ids(sortByOrder([item("third", "section", 2), item("first", "section", 0), item("second", "section", 1)]))).toEqual(["first", "second", "third"]);
    expect(normalizeOrder([group("drinks", 8), group("burgers", 2)]).map((nextGroup) => nextGroup.order)).toEqual([0, 1]);
  });

  it("renders sections in menu group order, then section order, with ordered items", () => {
    const orderedMenu = getOrderedMenu(
      menu({
        groups: [group("all", 0), group("drinks", 1), group("starters", 2), group("burgers", 3)],
        categories: [section("classic-burgers", "burgers", 0), section("appetizers", "starters", 0), section("soft-drinks", "drinks", 0)],
      }),
    );

    expect(ids(orderedMenu.groups.map(({ group: nextGroup }) => nextGroup))).toEqual(["all", "drinks", "starters", "burgers"]);
    expect(ids(orderedMenu.sections.map(({ section: nextSection }) => nextSection))).toEqual(["soft-drinks", "appetizers", "classic-burgers"]);
    expect(ids(orderedMenu.sections.find(({ section: nextSection }) => nextSection.id === "appetizers")?.items ?? [])).toEqual(["jalapenos", "mozzarella"]);
  });

  it("can omit hidden and empty sections for the customer menu", () => {
    const orderedMenu = getOrderedMenu(
      menu({
        categories: [section("appetizers", "starters", 0), { ...section("hidden-burgers", "burgers", 1), isVisible: false }, section("empty-drinks", "drinks", 2)],
        items: [item("jalapenos", "appetizers", 0), { ...item("hidden-fries", "appetizers", 1), isVisible: false }],
      }),
      { includeHidden: false, includeEmptySections: false },
    );

    expect(ids(orderedMenu.sections.map(({ section: nextSection }) => nextSection))).toEqual(["appetizers"]);
    expect(ids(orderedMenu.sections[0]?.items ?? [])).toEqual(["jalapenos"]);
  });

  it("moves menu groups and carries section order with them", () => {
    const reorderedMenu = moveGroup(menu(), "drinks", -1);

    expect(ids(sortByOrder(reorderedMenu.groups))).toEqual(["all", "starters", "drinks", "burgers"]);
    expect(ids(getOrderedMenu(reorderedMenu).sections.map(({ section: nextSection }) => nextSection))).toEqual(["appetizers", "soft-drinks", "classic-burgers"]);
  });

  it("moves a menu group before another group", () => {
    const reorderedMenu = moveGroupBefore(menu(), "drinks", "starters");

    expect(ids(sortByOrder(reorderedMenu.groups))).toEqual(["all", "drinks", "starters", "burgers"]);
    expect(ids(getOrderedMenu(reorderedMenu).sections.map(({ section: nextSection }) => nextSection))).toEqual(["soft-drinks", "appetizers", "classic-burgers"]);
  });

  it("does not move the pinned all group", () => {
    const sourceMenu = menu();

    expect(moveGroup(sourceMenu, "all", 1)).toBe(sourceMenu);
  });

  it("moves sections only within their menu group", () => {
    const sourceMenu = menu({
      categories: [section("appetizers", "starters", 0), section("salads", "starters", 1), section("classic-burgers", "burgers", 2)],
    });
    const reorderedMenu = moveSection(sourceMenu, "salads", -1);

    expect(ids(getOrderedMenu(reorderedMenu).sections.map(({ section: nextSection }) => nextSection))).toEqual(["salads", "appetizers", "classic-burgers"]);
    expect(moveSectionBefore(sourceMenu, "salads", "classic-burgers")).toBe(sourceMenu);
  });

  it("moves items only inside their current section", () => {
    const sourceMenu = menu({
      items: [item("first", "appetizers", 0), item("second", "appetizers", 1), item("burger", "classic-burgers", 0)],
    });
    const reorderedMenu = moveItemBefore(sourceMenu, "second", "first");

    expect(ids(getOrderedMenu(reorderedMenu).sections.find(({ section: nextSection }) => nextSection.id === "appetizers")?.items ?? [])).toEqual(["second", "first"]);
    expect(moveItemBefore(sourceMenu, "second", "burger")).toBe(sourceMenu);
  });

  it("keeps categories with a dangling groupId when renumbering or moving groups", () => {
    const orphan = section("orphan", "missing-group", 5);
    const source = menu({
      groups: [group("all", 0), group("a", 1), group("b", 2)],
      categories: [section("b1", "b", 0), section("a1", "a", 0), orphan],
      items: [],
    });

    const renumbered = renumberSections(source);
    expect(renumbered.categories.map((category) => category.id)).toEqual(["a1", "b1", "orphan"]);
    expect(renumbered.categories.find((category) => category.id === "orphan")).toBe(orphan);

    const moved = moveGroup(source, "b", -1);
    expect(moved.categories.map((category) => category.id)).toEqual(["b1", "a1", "orphan"]);
    expect(moveSection(source, "a1", 1).categories).toHaveLength(3);
  });
});
