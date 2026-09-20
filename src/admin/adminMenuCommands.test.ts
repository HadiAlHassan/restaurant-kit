import { describe, expect, it } from "vitest";
import type { DynamicMenu } from "../menu/menuSchema";
import { applyAdminMenuCommand, createMenuCategoryDraft, createMenuGroupDraft, createMenuSizeDraft, getAdminMenuCommandRejection, type AdminMenuCommand } from "./adminMenuCommands";

const menu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  restaurant: {
    id: "demo",
    name: "Demo Grill",
    tagline: "",
    phone: "",
    whatsapp: "",
    address: "",
  },
  groups: [
    { id: "all", label: "All", icon: "plate", order: 0, isVisible: true },
    { id: "group-burgers", label: "Burgers", icon: "burger", order: 1, isVisible: true },
    { id: "group-drinks", label: "Drinks", icon: "drink", order: 2, isVisible: true },
    { id: "group-wraps", label: "Wraps", icon: "wrap", order: 3, isVisible: true },
  ],
  categories: [
    { id: "category-classics", groupId: "group-burgers", title: "Classics", order: 0, isVisible: true },
    { id: "category-sodas", groupId: "group-drinks", title: "Sodas", order: 1, isVisible: true },
    { id: "category-sides", groupId: "group-burgers", title: "Sides", order: 2, isVisible: true },
  ],
  items: [
    {
      id: "item-cheese",
      categoryId: "category-classics",
      title: "Cheeseburger",
      description: "",
      image: "",
      order: 0,
      isVisible: true,
      pricingMode: "sizes",
      price: "",
      sizes: [
        { id: "size-single", label: "Single", price: "6", order: 0 },
        { id: "size-double", label: "Double", price: "9", order: 1 },
      ],
    },
    {
      id: "item-smash",
      categoryId: "category-classics",
      title: "Smash burger",
      description: "",
      image: "",
      order: 1,
      isVisible: true,
      pricingMode: "single",
      price: "8",
      sizes: [],
    },
  ],
};

function apply(command: AdminMenuCommand) {
  const result = applyAdminMenuCommand(menu, command);
  if (result.status !== "applied") throw new Error(`expected applied, got ${result.reason}`);
  return result.menu;
}

describe("group commands", () => {
  it("adds a group", () => {
    const group = createMenuGroupDraft(menu);
    const next = apply({ type: "add-group", group });

    expect(next.groups.map((nextGroup) => nextGroup.id)).toContain(group.id);
    expect(group.order).toBe(menu.groups.length);
  });

  it("updates a group", () => {
    const next = apply({ type: "update-group", groupId: "group-burgers", patch: { label: "Smash" } });

    expect(next.groups.find((group) => group.id === "group-burgers")?.label).toBe("Smash");
  });

  it("deletes an empty group", () => {
    const next = apply({ type: "delete-group", groupId: "group-wraps" });

    expect(next.groups.some((group) => group.id === "group-wraps")).toBe(false);
  });

  it("rejects deleting the pinned group", () => {
    expect(applyAdminMenuCommand(menu, { type: "delete-group", groupId: "all" })).toEqual({ status: "rejected", reason: "pinned-group" });
  });

  it("rejects deleting a group that still has sections", () => {
    expect(applyAdminMenuCommand(menu, { type: "delete-group", groupId: "group-burgers" })).toEqual({ status: "rejected", reason: "group-has-sections" });
  });

  it("moves a group by direction", () => {
    const next = apply({ type: "move-group", groupId: "group-burgers", direction: 1 });
    const orderedIds = [...next.groups].sort((a, b) => a.order - b.order).map((group) => group.id);

    expect(orderedIds).toEqual(["all", "group-drinks", "group-burgers", "group-wraps"]);
  });

  it("applies a full group order from the reorder panel", () => {
    const next = apply({ type: "reorder-groups", orderedGroupIds: ["group-wraps", "group-drinks", "group-burgers"] });
    const orderedIds = [...next.groups].sort((a, b) => a.order - b.order).map((group) => group.id);

    expect(orderedIds).toEqual(["all", "group-wraps", "group-drinks", "group-burgers"]);
  });

  it("renumbers sections to follow the new group order", () => {
    const next = apply({ type: "reorder-groups", orderedGroupIds: ["group-drinks", "group-burgers", "group-wraps"] });
    const orderedCategoryIds = [...next.categories].sort((a, b) => a.order - b.order).map((category) => category.id);

    expect(orderedCategoryIds).toEqual(["category-sodas", "category-classics", "category-sides"]);
  });

  it("ignores incomplete or unknown group orders", () => {
    expect(apply({ type: "reorder-groups", orderedGroupIds: ["group-wraps"] })).toEqual(menu);
    expect(apply({ type: "reorder-groups", orderedGroupIds: ["group-wraps", "group-drinks", "group-ghost"] })).toEqual(menu);
  });
});

describe("section commands", () => {
  it("adds a section to the group", () => {
    const category = createMenuCategoryDraft(menu, "group-drinks");
    const next = apply({ type: "add-section", category });

    expect(next.categories.find((nextCategory) => nextCategory.id === category.id)?.groupId).toBe("group-drinks");
  });

  it("updates a section", () => {
    const next = apply({ type: "update-section", categoryId: "category-sodas", patch: { title: "Cold drinks" } });

    expect(next.categories.find((category) => category.id === "category-sodas")?.title).toBe("Cold drinks");
  });

  it("deletes an empty section", () => {
    const next = apply({ type: "delete-section", categoryId: "category-sodas" });

    expect(next.categories.some((category) => category.id === "category-sodas")).toBe(false);
  });

  it("rejects deleting a section that still has items", () => {
    expect(applyAdminMenuCommand(menu, { type: "delete-section", categoryId: "category-classics" })).toEqual({ status: "rejected", reason: "section-has-items" });
  });

  it("moves a section within its group", () => {
    const next = apply({ type: "move-section", categoryId: "category-sides", direction: -1 });
    const classics = next.categories.find((category) => category.id === "category-classics");
    const sides = next.categories.find((category) => category.id === "category-sides");

    expect(sides!.order).toBeLessThan(classics!.order);
  });
});

describe("item commands", () => {
  it("adds, updates, and deletes an item", () => {
    const item = { ...menu.items[1], id: "item-new", title: "New" };

    const added = apply({ type: "add-item", item });
    expect(added.items.some((nextItem) => nextItem.id === "item-new")).toBe(true);

    const updated = apply({ type: "update-item", itemId: "item-smash", patch: { title: "Double smash" } });
    expect(updated.items.find((nextItem) => nextItem.id === "item-smash")?.title).toBe("Double smash");

    const deleted = apply({ type: "delete-item", itemId: "item-smash" });
    expect(deleted.items.some((nextItem) => nextItem.id === "item-smash")).toBe(false);
  });

  it("moves an item before another", () => {
    const next = apply({ type: "move-item-before", sourceItemId: "item-smash", targetItemId: "item-cheese" });
    const orderedIds = [...next.items].sort((a, b) => a.order - b.order).map((item) => item.id);

    expect(orderedIds).toEqual(["item-smash", "item-cheese"]);
  });
});

describe("size commands", () => {
  it("adds a size with the next order", () => {
    const item = menu.items[0];
    const size = createMenuSizeDraft(item);
    const next = apply({ type: "add-size", itemId: item.id, size });

    expect(size.order).toBe(2);
    expect(next.items.find((nextItem) => nextItem.id === item.id)?.sizes).toHaveLength(3);
  });

  it("updates a size", () => {
    const next = apply({ type: "update-size", itemId: "item-cheese", sizeId: "size-double", patch: { price: "10" } });

    expect(next.items.find((item) => item.id === "item-cheese")?.sizes.find((size) => size.id === "size-double")?.price).toBe("10");
  });

  it("deletes a size", () => {
    const next = apply({ type: "delete-size", itemId: "item-cheese", sizeId: "size-double" });

    expect(next.items.find((item) => item.id === "item-cheese")?.sizes).toHaveLength(1);
  });
});

describe("getAdminMenuCommandRejection", () => {
  it("returns null for allowed commands", () => {
    expect(getAdminMenuCommandRejection(menu, { type: "delete-group", groupId: "group-wraps" })).toBeNull();
    expect(getAdminMenuCommandRejection(menu, { type: "update-item", itemId: "item-smash", patch: {} })).toBeNull();
  });
});
