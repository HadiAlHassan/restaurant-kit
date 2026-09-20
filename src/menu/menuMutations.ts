import { normalizeOrder, renumberSections, sortByOrder } from "./menuOrdering";
import type { DynamicMenu, MenuCategory, MenuGroup, MenuItem, MenuSize } from "./menuSchema";

export function addMenuGroup(menu: DynamicMenu, group: MenuGroup): DynamicMenu {
  return {
    ...menu,
    groups: [...menu.groups, { ...group, order: menu.groups.length }],
  };
}

export function updateMenuGroup(menu: DynamicMenu, groupId: string, patch: Partial<MenuGroup>): DynamicMenu {
  if (!menu.groups.some((group) => group.id === groupId)) return menu;

  return {
    ...menu,
    groups: menu.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
  };
}

export function deleteMenuGroup(menu: DynamicMenu, groupId: string): DynamicMenu {
  if (groupId === "all") return menu;
  if (menu.categories.some((category) => category.groupId === groupId)) return menu;

  return {
    ...menu,
    groups: normalizeOrder(sortByOrder(menu.groups.filter((group) => group.id !== groupId))),
  };
}

export function addMenuCategory(menu: DynamicMenu, category: MenuCategory): DynamicMenu {
  const siblingCount = menu.categories.filter((nextCategory) => nextCategory.groupId === category.groupId).length;

  return {
    ...menu,
    categories: [...menu.categories, { ...category, order: siblingCount }],
  };
}

export function updateMenuCategory(menu: DynamicMenu, categoryId: string, patch: Partial<MenuCategory>): DynamicMenu {
  const currentCategory = menu.categories.find((category) => category.id === categoryId);
  if (!currentCategory) return menu;
  const nextGroupId = patch.groupId ?? currentCategory.groupId;
  const didMoveGroup = nextGroupId !== currentCategory.groupId;
  const targetGroupNextOrder =
    Math.max(
      -1,
      ...menu.categories.filter((category) => category.id !== categoryId && category.groupId === nextGroupId).map((category) => category.order),
    ) + 1;
  return renumberSections({
    ...menu,
    categories: menu.categories.map((category) => (category.id === categoryId ? { ...category, ...patch, order: didMoveGroup ? targetGroupNextOrder : (patch.order ?? category.order) } : category)),
  });
}

export function deleteMenuCategory(menu: DynamicMenu, categoryId: string): DynamicMenu {
  if (menu.items.some((item) => item.categoryId === categoryId)) return menu;
  if (!menu.categories.some((category) => category.id === categoryId)) return menu;

  return renumberSections({
    ...menu,
    categories: menu.categories.filter((category) => category.id !== categoryId),
  });
}

export function addMenuItem(menu: DynamicMenu, item: MenuItem): DynamicMenu {
  const siblingCount = menu.items.filter((nextItem) => nextItem.categoryId === item.categoryId).length;

  return {
    ...menu,
    items: [...menu.items, { ...item, order: siblingCount }],
  };
}

export function updateMenuItem(menu: DynamicMenu, itemId: string, patch: Partial<MenuItem>): DynamicMenu {
  if (!menu.items.some((item) => item.id === itemId)) return menu;

  return {
    ...menu,
    items: menu.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  };
}

export function deleteMenuItem(menu: DynamicMenu, itemId: string): DynamicMenu {
  const item = menu.items.find((nextItem) => nextItem.id === itemId);
  if (!item) return menu;

  const remainingItems = menu.items.filter((nextItem) => nextItem.id !== itemId);
  const siblingItems = normalizeOrder(sortByOrder(remainingItems.filter((nextItem) => nextItem.categoryId === item.categoryId)));
  const siblingMap = new Map(siblingItems.map((nextItem) => [nextItem.id, nextItem]));

  return {
    ...menu,
    items: remainingItems.map((nextItem) => siblingMap.get(nextItem.id) ?? nextItem),
  };
}

export function addMenuSize(menu: DynamicMenu, itemId: string, size: MenuSize): DynamicMenu {
  const item = menu.items.find((nextItem) => nextItem.id === itemId);
  if (!item) return menu;

  return updateMenuItem(menu, itemId, {
    pricingMode: "sizes",
    sizes: [...item.sizes, { ...size, order: item.sizes.length }],
  });
}

export function updateMenuSize(menu: DynamicMenu, itemId: string, sizeId: string, patch: Partial<MenuSize>): DynamicMenu {
  const item = menu.items.find((nextItem) => nextItem.id === itemId);
  if (!item || !item.sizes.some((size) => size.id === sizeId)) return menu;

  return updateMenuItem(menu, itemId, {
    sizes: item.sizes.map((size) => (size.id === sizeId ? { ...size, ...patch } : size)),
  });
}

export function deleteMenuSize(menu: DynamicMenu, itemId: string, sizeId: string): DynamicMenu {
  const item = menu.items.find((nextItem) => nextItem.id === itemId);
  if (!item || !item.sizes.some((size) => size.id === sizeId)) return menu;

  return updateMenuItem(menu, itemId, {
    sizes: normalizeOrder(sortByOrder(item.sizes.filter((size) => size.id !== sizeId))),
  });
}
