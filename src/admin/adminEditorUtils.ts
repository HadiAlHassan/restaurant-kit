import { MenuApiError } from "../menu/menuApi";
import type { MenuItem } from "../menu/menuSchema";
export { formatPrice } from "../menu/priceFormat";
export { imageSrc as imageSource } from "../menu-browser/menuItemDisplay";

export type SortableData =
  | {
      kind: "group";
      id: string;
    }
  | {
      kind: "item";
      id: string;
      categoryId: string;
    };

export type SortableEntity = {
  readonly id?: string | number;
  readonly data?: unknown;
  readonly index?: number;
} | null;

export function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

let fallbackIdCounter = 0;

function uniqueSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  fallbackIdCounter += 1;
  return `${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export function uniqueId(prefix: string, label: string) {
  return `${prefix}-${slugify(label)}-${uniqueSuffix()}`;
}

export function emptyItem(categoryId: string): MenuItem {
  return {
    id: uniqueId("item", "new-item"),
    categoryId,
    title: "New menu item",
    description: "",
    image: "",
    order: 999,
    isVisible: true,
    pricingMode: "single",
    price: "",
    sizes: [],
  };
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof MenuApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected menu API error.";
}

export function isLikelyAuthError(error: unknown) {
  if (error instanceof MenuApiError && (error.status === 401 || error.status === 403)) return true;

  const message = getApiErrorMessage(error).toLowerCase();
  return (
    message.includes("cloudflare access") ||
    message.includes("sign in") ||
    message.includes("sign-in") ||
    message.includes("not authorized") ||
    message.includes("expected a json response") ||
    message.includes("could not reach the menu api")
  );
}

export function sortableDataFromEntity(entity: SortableEntity) {
  const data = entity?.data as SortableData | undefined;
  if (data?.kind) return data;

  const entityId = String(entity?.id ?? "");
  if (entityId.startsWith("group:")) {
    return { kind: "group", id: entityId.replace("group:", "") } satisfies SortableData;
  }

  if (entityId.startsWith("item:")) {
    return { kind: "item", id: entityId.replace("item:", ""), categoryId: "" } satisfies SortableData;
  }

  return null;
}
