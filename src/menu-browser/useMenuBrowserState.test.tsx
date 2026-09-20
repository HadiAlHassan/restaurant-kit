// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DynamicMenu } from "../menu/menuSchema";
import { useMenuBrowserState } from "./useMenuBrowserState";

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
    { id: "group-hidden", label: "Hidden", icon: "drink", order: 2, isVisible: false },
  ],
  categories: [
    { id: "category-classics", groupId: "group-burgers", title: "Classics", order: 0, isVisible: true },
    { id: "category-empty", groupId: "group-burgers", title: "Empty", order: 1, isVisible: true },
    { id: "category-hidden", groupId: "group-burgers", title: "Hidden", order: 2, isVisible: false },
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
      pricingMode: "single",
      price: "7",
      sizes: [],
    },
    {
      id: "item-hidden",
      categoryId: "category-classics",
      title: "Secret burger",
      description: "",
      image: "",
      order: 1,
      isVisible: false,
      pricingMode: "single",
      price: "9",
      sizes: [],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
});

describe("useMenuBrowserState", () => {
  it("filters hidden groups, hidden/empty sections, and hidden items", () => {
    const { result } = renderHook(() => useMenuBrowserState(menu));

    expect(result.current.visibleGroups.map((group) => group.id)).toEqual(["all", "group-burgers"]);
    expect(result.current.visibleCategories.map(({ category }) => category.id)).toEqual(["category-classics"]);
    expect(result.current.visibleCategories[0].items.map((item) => item.id)).toEqual(["item-cheese"]);
    expect(result.current.groupLabels.get("group-burgers")).toBe("Burgers");
  });

  it("opens all visible categories initially", () => {
    const { result } = renderHook(() => useMenuBrowserState(menu));

    expect(result.current.openCategories).toEqual(["category-classics"]);
  });

  it("toggles a category closed and open", () => {
    const { result } = renderHook(() => useMenuBrowserState(menu));

    act(() => {
      result.current.toggleCategory("category-classics");
    });
    expect(result.current.openCategories).toEqual([]);

    act(() => {
      result.current.toggleCategory("category-classics");
    });
    expect(result.current.openCategories).toEqual(["category-classics"]);
  });

  it("keeps retained categories and adds newly visible ones when the menu changes", () => {
    const { rerender, result } = renderHook(({ currentMenu }) => useMenuBrowserState(currentMenu), {
      initialProps: { currentMenu: menu },
    });

    const nextMenu: DynamicMenu = {
      ...menu,
      items: [
        ...menu.items,
        {
          id: "item-fries",
          categoryId: "category-empty",
          title: "Fries",
          description: "",
          image: "",
          order: 0,
          isVisible: true,
          pricingMode: "single",
          price: "3",
          sizes: [],
        },
      ],
    };

    rerender({ currentMenu: nextMenu });

    expect(result.current.openCategories).toEqual(["category-classics", "category-empty"]);
  });

  it("does not reopen a manually closed category when the menu updates", () => {
    const { rerender, result } = renderHook(({ currentMenu }) => useMenuBrowserState(currentMenu), {
      initialProps: { currentMenu: menu },
    });

    act(() => {
      result.current.toggleCategory("category-classics");
    });
    expect(result.current.openCategories).toEqual([]);

    const nextMenu: DynamicMenu = {
      ...menu,
      items: [
        ...menu.items,
        {
          id: "item-fries",
          categoryId: "category-empty",
          title: "Fries",
          description: "",
          image: "",
          order: 0,
          isVisible: true,
          pricingMode: "single",
          price: "3",
          sizes: [],
        },
      ],
    };

    rerender({ currentMenu: nextMenu });

    expect(result.current.openCategories).toEqual(["category-empty"]);

    act(() => {
      result.current.toggleCategory("category-classics");
    });
    expect(result.current.openCategories).toEqual(["category-empty", "category-classics"]);
  });

  it("drops open state for categories that are no longer visible", () => {
    const { rerender, result } = renderHook(({ currentMenu }) => useMenuBrowserState(currentMenu), {
      initialProps: { currentMenu: menu },
    });

    const nextMenu: DynamicMenu = {
      ...menu,
      categories: menu.categories.map((category) => (category.id === "category-classics" ? { ...category, isVisible: false } : category)),
    };

    rerender({ currentMenu: nextMenu });

    expect(result.current.openCategories).toEqual([]);
  });
});
