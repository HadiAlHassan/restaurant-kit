import type { DynamicMenu } from "./menuSchema";

export function menuDraftStorageKey(restaurantId: string) {
  return `${restaurantId}:menu-draft:v1`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readMenuDraft(storageKey: string) {
  if (!canUseStorage()) return null;

  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    if (!rawDraft) return null;
    return JSON.parse(rawDraft) as DynamicMenu;
  } catch {
    return null;
  }
}

export function writeMenuDraft(menu: DynamicMenu, storageKey: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(menu));
  } catch {
    // Local preview should never break editing if storage is unavailable.
  }
}

export function clearMenuDraft(storageKey: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Local preview should never break editing if storage is unavailable.
  }
}
