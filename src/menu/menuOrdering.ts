import type { DynamicMenu, MenuCategory, MenuGroup, MenuItem } from "./menuSchema";

type OrderedEntity = {
  readonly order: number;
};

export type OrderedMenuSection = {
  readonly section: MenuCategory;
  readonly items: readonly MenuItem[];
};

export type OrderedMenuGroup = {
  readonly group: MenuGroup;
  readonly sections: readonly OrderedMenuSection[];
};

export type OrderedMenu = {
  readonly groups: readonly OrderedMenuGroup[];
  readonly sections: readonly OrderedMenuSection[];
};

type OrderedMenuOptions = {
  readonly includeHidden?: boolean;
  readonly includeEmptySections?: boolean;
};

export function sortByOrder<T extends OrderedEntity>(items: readonly T[]) {
  return [...items].sort((first, second) => first.order - second.order);
}

export function normalizeOrder<T extends OrderedEntity>(items: readonly T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

/**
 * Re-numbers categories in render order (group order, then section order). Categories whose
 * group no longer resolves are kept at the end untouched, so a dangling `groupId` in seed or
 * remote data is never silently deleted by an unrelated edit.
 */
export function renumberSections(menu: DynamicMenu): DynamicMenu {
  const ordered = normalizeOrder(getOrderedMenu(menu).sections.map(({ section }) => section));
  const orderedIds = new Set(ordered.map((section) => section.id));
  const orphans = menu.categories.filter((section) => !orderedIds.has(section.id));

  return { ...menu, categories: [...ordered, ...orphans] };
}

export function getOrderedMenu(menu: DynamicMenu, options: OrderedMenuOptions = {}): OrderedMenu {
  const includeHidden = options.includeHidden ?? true;
  const includeEmptySections = options.includeEmptySections ?? true;
  const groups = sortByOrder(includeHidden ? menu.groups : menu.groups.filter((group) => group.isVisible));
  const categories = includeHidden ? menu.categories : menu.categories.filter((category) => category.isVisible);
  const items = sortByOrder(includeHidden ? menu.items : menu.items.filter((item) => item.isVisible));

  const itemBuckets = new Map<string, MenuItem[]>();
  for (const item of items) {
    const currentItems = itemBuckets.get(item.categoryId) ?? [];
    currentItems.push(item);
    itemBuckets.set(item.categoryId, currentItems);
  }

  const sectionBuckets = new Map<string, OrderedMenuSection[]>();
  for (const section of categories) {
    const sectionItems = itemBuckets.get(section.id) ?? [];
    if (!includeEmptySections && sectionItems.length === 0) continue;

    const currentSections = sectionBuckets.get(section.groupId) ?? [];
    currentSections.push({ section, items: sectionItems });
    sectionBuckets.set(section.groupId, currentSections);
  }

  const orderedGroups = groups.map((group) => ({
    group,
    sections: sortSections(sectionBuckets.get(group.id) ?? []),
  }));

  return {
    groups: orderedGroups,
    sections: orderedGroups.flatMap((group) => group.sections),
  };
}

function sortSections(sections: readonly OrderedMenuSection[]) {
  return [...sections].sort((first, second) => first.section.order - second.section.order);
}

export function moveGroup(menu: DynamicMenu, groupId: string, direction: -1 | 1) {
  if (groupId === "all") return menu;

  const pinnedGroups = menu.groups.filter((group) => group.id === "all");
  const movableGroups = sortByOrder(menu.groups.filter((group) => group.id !== "all"));
  const currentIndex = movableGroups.findIndex((group) => group.id === groupId);
  const targetIndex = currentIndex + direction;
  if (!canMove(movableGroups, currentIndex, targetIndex)) return menu;

  const nextGroups = normalizeMenuGroups([...pinnedGroups, ...moveByIndex(movableGroups, currentIndex, targetIndex)]);
  return renumberSections({ ...menu, groups: nextGroups });
}

export function moveGroupBefore(menu: DynamicMenu, groupId: string, targetGroupId: string) {
  if (groupId === "all" || targetGroupId === "all" || groupId === targetGroupId) return menu;

  const pinnedGroups = menu.groups.filter((group) => group.id === "all");
  const movableGroups = sortByOrder(menu.groups.filter((group) => group.id !== "all"));
  const currentIndex = movableGroups.findIndex((group) => group.id === groupId);
  const targetIndex = movableGroups.findIndex((group) => group.id === targetGroupId);
  if (!canMove(movableGroups, currentIndex, targetIndex)) return menu;

  const nextGroups = normalizeMenuGroups([...pinnedGroups, ...moveByIndex(movableGroups, currentIndex, targetIndex)]);
  return renumberSections({ ...menu, groups: nextGroups });
}

export function setGroupOrder(menu: DynamicMenu, orderedGroupIds: readonly string[]) {
  const pinnedGroups = menu.groups.filter((group) => group.id === "all");
  const movableGroups = sortByOrder(menu.groups.filter((group) => group.id !== "all"));
  const groupsById = new Map(movableGroups.map((group) => [group.id, group]));
  const reorderedGroups = orderedGroupIds.map((groupId) => groupsById.get(groupId)).filter((group): group is MenuGroup => Boolean(group));

  if (reorderedGroups.length !== movableGroups.length) return menu;
  if (reorderedGroups.every((group, index) => group.id === movableGroups[index].id)) return menu;

  const nextGroups = normalizeMenuGroups([...pinnedGroups, ...reorderedGroups]);
  return renumberSections({ ...menu, groups: nextGroups });
}

export function moveSection(menu: DynamicMenu, sectionId: string, direction: -1 | 1) {
  const section = menu.categories.find((category) => category.id === sectionId);
  if (!section) return menu;

  const siblingSections = sortByOrder(menu.categories.filter((category) => category.groupId === section.groupId));
  const currentIndex = siblingSections.findIndex((category) => category.id === sectionId);
  const targetIndex = currentIndex + direction;
  if (!canMove(siblingSections, currentIndex, targetIndex)) return menu;

  return replaceSections(menu, moveByIndex(siblingSections, currentIndex, targetIndex));
}

export function moveSectionBefore(menu: DynamicMenu, sectionId: string, targetSectionId: string) {
  if (sectionId === targetSectionId) return menu;

  const section = menu.categories.find((category) => category.id === sectionId);
  const targetSection = menu.categories.find((category) => category.id === targetSectionId);
  if (!section || !targetSection || section.groupId !== targetSection.groupId) return menu;

  const siblingSections = sortByOrder(menu.categories.filter((category) => category.groupId === section.groupId));
  const currentIndex = siblingSections.findIndex((category) => category.id === sectionId);
  const targetIndex = siblingSections.findIndex((category) => category.id === targetSectionId);
  if (!canMove(siblingSections, currentIndex, targetIndex)) return menu;

  return replaceSections(menu, moveByIndex(siblingSections, currentIndex, targetIndex));
}

export function moveItemBefore(menu: DynamicMenu, itemId: string, targetItemId: string) {
  if (itemId === targetItemId) return menu;

  const item = menu.items.find((nextItem) => nextItem.id === itemId);
  const targetItem = menu.items.find((nextItem) => nextItem.id === targetItemId);
  if (!item || !targetItem || item.categoryId !== targetItem.categoryId) return menu;

  const siblingItems = sortByOrder(menu.items.filter((nextItem) => nextItem.categoryId === item.categoryId));
  const currentIndex = siblingItems.findIndex((nextItem) => nextItem.id === itemId);
  const targetIndex = siblingItems.findIndex((nextItem) => nextItem.id === targetItemId);
  if (!canMove(siblingItems, currentIndex, targetIndex)) return menu;

  const replacementMap = new Map(normalizeOrder(moveByIndex(siblingItems, currentIndex, targetIndex)).map((nextItem) => [nextItem.id, nextItem]));
  return {
    ...menu,
    items: menu.items.map((nextItem) => replacementMap.get(nextItem.id) ?? nextItem),
  };
}

function normalizeMenuGroups(groups: readonly MenuGroup[]) {
  const pinnedGroups = groups.filter((group) => group.id === "all").map((group) => ({ ...group, order: 0 }));
  const movableGroups = groups.filter((group) => group.id !== "all");

  return [...pinnedGroups, ...movableGroups.map((group, index) => ({ ...group, order: index + 1 }))];
}

function replaceSections(menu: DynamicMenu, reorderedSiblings: readonly MenuCategory[]) {
  const replacementMap = new Map(normalizeOrder(reorderedSiblings).map((section) => [section.id, section]));

  return renumberSections({
    ...menu,
    categories: menu.categories.map((section) => replacementMap.get(section.id) ?? section),
  });
}

function moveByIndex<T>(items: readonly T[], currentIndex: number, targetIndex: number) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(currentIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

function canMove(items: readonly unknown[], currentIndex: number, targetIndex: number) {
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex < items.length && targetIndex < items.length && currentIndex !== targetIndex;
}
