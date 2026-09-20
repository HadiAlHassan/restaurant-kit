import { sortByOrder } from "../menu/menuOrdering";
import type { MenuItem, MenuSize } from "../menu/menuSchema";
import { formatPrice } from "../menu/priceFormat";

export { formatPrice } from "../menu/priceFormat";

export function variationLabel(size: MenuSize) {
  const normalizedName = size.label.trim().toLowerCase();
  if (normalizedName === "small") return "S";
  if (normalizedName === "medium") return "M";
  if (normalizedName === "large") return "L";
  return size.label.trim() || formatPrice(size.price);
}

export function sortedSizes(item: MenuItem) {
  return sortByOrder(item.sizes.filter((size) => size.label.trim() && size.price));
}

const absoluteImagePattern = /^(https?:|data:|blob:)/i;

export function imageSrc(image: string) {
  if (!image) return "";
  if (image.startsWith("/") || absoluteImagePattern.test(image)) return image;
  return `/${image}`;
}
