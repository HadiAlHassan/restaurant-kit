import { addMenuCategory, addMenuGroup, addMenuItem, addMenuSize, deleteMenuCategory, deleteMenuGroup, deleteMenuItem, deleteMenuSize, updateMenuCategory, updateMenuGroup, updateMenuItem, updateMenuSize } from "../menu/menuMutations";
import { moveGroup, moveItemBefore, moveSection, setGroupOrder } from "../menu/menuOrdering";
import type { DynamicMenu, MenuCategory, MenuGroup, MenuItem, MenuSize } from "../menu/menuSchema";
import { uniqueId } from "./adminEditorUtils";

export type AdminMenuCommand =
  | { readonly type: "add-group"; readonly group: MenuGroup }
  | { readonly type: "update-group"; readonly groupId: string; readonly patch: Partial<MenuGroup> }
  | { readonly type: "delete-group"; readonly groupId: string }
  | { readonly type: "move-group"; readonly groupId: string; readonly direction: -1 | 1 }
  | { readonly type: "reorder-groups"; readonly orderedGroupIds: readonly string[] }
  | { readonly type: "add-section"; readonly category: MenuCategory }
  | { readonly type: "update-section"; readonly categoryId: string; readonly patch: Partial<MenuCategory> }
  | { readonly type: "delete-section"; readonly categoryId: string }
  | { readonly type: "move-section"; readonly categoryId: string; readonly direction: -1 | 1 }
  | { readonly type: "add-item"; readonly item: MenuItem }
  | { readonly type: "update-item"; readonly itemId: string; readonly patch: Partial<MenuItem> }
  | { readonly type: "delete-item"; readonly itemId: string }
  | { readonly type: "move-item-before"; readonly sourceItemId: string; readonly targetItemId: string }
  | { readonly type: "add-size"; readonly itemId: string; readonly size: MenuSize }
  | { readonly type: "update-size"; readonly itemId: string; readonly sizeId: string; readonly patch: Partial<MenuSize> }
  | { readonly type: "delete-size"; readonly itemId: string; readonly sizeId: string };

export type AdminMenuCommandRejection = "pinned-group" | "group-has-sections" | "section-has-items";

export type AdminMenuCommandResult =
  | { readonly status: "applied"; readonly menu: DynamicMenu }
  | { readonly status: "rejected"; readonly reason: AdminMenuCommandRejection };

export function createMenuGroupDraft(menu: DynamicMenu): MenuGroup {
  return {
    id: uniqueId("group", "new-menu-group"),
    label: "New group",
    icon: "plate",
    order: menu.groups.length,
    isVisible: true,
  };
}

export function createMenuCategoryDraft(menu: DynamicMenu, groupId: string): MenuCategory {
  return {
    id: uniqueId("category", "new-category"),
    groupId,
    title: "New section",
    order: menu.categories.length,
    isVisible: true,
  };
}

export function createMenuSizeDraft(item: MenuItem): MenuSize {
  return {
    id: uniqueId("size", "size"),
    label: "Size",
    price: "",
    order: item.sizes.length,
  };
}

export function getAdminMenuCommandRejection(menu: DynamicMenu, command: AdminMenuCommand): AdminMenuCommandRejection | null {
  if (command.type === "delete-group") {
    if (command.groupId === "all") return "pinned-group";
    if (menu.categories.some((category) => category.groupId === command.groupId)) return "group-has-sections";
  }

  if (command.type === "delete-section" && menu.items.some((item) => item.categoryId === command.categoryId)) {
    return "section-has-items";
  }

  return null;
}

export function applyAdminMenuCommand(menu: DynamicMenu, command: AdminMenuCommand): AdminMenuCommandResult {
  const rejection = getAdminMenuCommandRejection(menu, command);
  if (rejection) return { status: "rejected", reason: rejection };

  return { status: "applied", menu: nextMenu(menu, command) };
}

function nextMenu(menu: DynamicMenu, command: AdminMenuCommand): DynamicMenu {
  switch (command.type) {
    case "add-group":
      return addMenuGroup(menu, command.group);
    case "update-group":
      return updateMenuGroup(menu, command.groupId, command.patch);
    case "delete-group":
      return deleteMenuGroup(menu, command.groupId);
    case "move-group":
      return moveGroup(menu, command.groupId, command.direction);
    case "reorder-groups":
      return setGroupOrder(menu, command.orderedGroupIds);
    case "add-section":
      return addMenuCategory(menu, command.category);
    case "update-section":
      return updateMenuCategory(menu, command.categoryId, command.patch);
    case "delete-section":
      return deleteMenuCategory(menu, command.categoryId);
    case "move-section":
      return moveSection(menu, command.categoryId, command.direction);
    case "add-item":
      return addMenuItem(menu, command.item);
    case "update-item":
      return updateMenuItem(menu, command.itemId, command.patch);
    case "delete-item":
      return deleteMenuItem(menu, command.itemId);
    case "move-item-before":
      return moveItemBefore(menu, command.sourceItemId, command.targetItemId);
    case "add-size":
      return addMenuSize(menu, command.itemId, command.size);
    case "update-size":
      return updateMenuSize(menu, command.itemId, command.sizeId, command.patch);
    case "delete-size":
      return deleteMenuSize(menu, command.itemId, command.sizeId);
  }
}
