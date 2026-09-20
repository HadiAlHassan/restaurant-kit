import type { CartItem, CartSelection } from "./cartTypes";

export type CartOrderConfig = {
  readonly whatsappNumber: string;
  readonly orderGreeting: string;
};

export function cartSelectionKey(selection: CartSelection) {
  const removed = (selection.removedIngredients ?? [])
    .map((ingredient) => ingredient.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");

  return [selection.itemId, selection.variationId ?? "default", ...(removed ? [`no=${removed}`] : [])].join(":");
}

export function formatVariationName(name?: string) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function orderLines(item: CartItem) {
  const variationName = formatVariationName(item.variationName);
  const removed = (item.removedIngredients ?? []).filter((ingredient) => ingredient.trim());
  const note = item.note?.trim();
  const lines = [`${item.quantity}x ${item.itemName}${variationName ? ` - ${variationName}` : ""}`];
  if (removed.length) lines.push(`   No: ${removed.join(", ")}`);
  if (note) lines.push(`   Note: ${note}`);
  return lines;
}

export function buildWhatsAppMessage(items: readonly CartItem[], orderNote: string, config: CartOrderConfig) {
  const trimmedOrderNote = orderNote.trim();

  return [
    config.orderGreeting,
    "",
    ...items.flatMap(orderLines),
    ...(trimmedOrderNote ? ["", `Order note: ${trimmedOrderNote}`] : []),
    "",
    "",
    "Name:",
    "Address:",
  ].join("\n");
}

export function buildWhatsAppOrderUrl(items: readonly CartItem[], orderNote: string, config: CartOrderConfig) {
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(buildWhatsAppMessage(items, orderNote, config))}`;
}
