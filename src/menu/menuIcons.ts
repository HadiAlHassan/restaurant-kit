import { Beef, CakeSlice, Drumstick, GlassWater, Sandwich, Soup, Utensils } from "lucide-react";
import type { MenuIcon } from "./menuSchema";

export const menuIcons: Record<MenuIcon, typeof Utensils> = {
  plate: Utensils,
  burger: Beef,
  wrap: Sandwich,
  chicken: Drumstick,
  platter: Soup,
  fries: CakeSlice,
  kids: CakeSlice,
  drink: GlassWater,
};

/** Looks up a group icon, falling back to the plate icon when menu data holds an unknown id. */
export function menuIconFor(id: string) {
  return menuIcons[id as MenuIcon] ?? Utensils;
}

export const menuIconOptions: readonly { readonly id: MenuIcon; readonly label: string }[] = [
  { id: "plate", label: "Plate" },
  { id: "burger", label: "Burger" },
  { id: "wrap", label: "Wrap" },
  { id: "chicken", label: "Chicken" },
  { id: "platter", label: "Platter" },
  { id: "fries", label: "Fries" },
  { id: "kids", label: "Kids" },
  { id: "drink", label: "Drink" },
];
