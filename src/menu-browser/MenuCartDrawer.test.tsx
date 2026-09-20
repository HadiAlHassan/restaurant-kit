// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import { useCart } from "../cart/useCart";
import type { DynamicMenu } from "../menu/menuSchema";
import { MenuDataProvider } from "../menu/useMenuData";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import { MenuCartDrawer } from "./MenuCartDrawer";

const menu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-07-05T00:00:00Z",
  restaurant: { id: "demo", name: "Demo Grill", tagline: "", phone: "", whatsapp: "", address: "" },
  groups: [{ id: "group-food", label: "Food", icon: "plate", order: 0, isVisible: true }],
  categories: [{ id: "category-shawarma", groupId: "group-food", title: "Shawarma", order: 0, isVisible: true }],
  items: [
    {
      id: "item-shawarma",
      categoryId: "category-shawarma",
      title: "Chicken Shawarma",
      description: "Marinated chicken in saj bread",
      image: "",
      order: 0,
      isVisible: true,
      pricingMode: "single",
      price: "5.50",
      sizes: [],
      removableIngredients: ["Pickles", "Fries"],
    },
  ],
};

function SeedCartLine() {
  const { addItem } = useCart();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    addItem({ itemId: "item-shawarma", itemName: "Chicken Shawarma" }, { note: "extra crispy" });
  }, [addItem]);
  return null;
}

function CartProbe() {
  const { items, isOpen } = useCart();
  return (
    <>
      <output data-testid="cart-items">{JSON.stringify(items)}</output>
      <output data-testid="cart-open">{String(isOpen)}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MenuCartDrawer line editing", () => {
  it("opens the item sheet prefilled from the cart line and replaces it on Update", () => {
    vi.spyOn(window.history, "back").mockImplementation(() => fireEvent.popState(window));
    render(
      <KitTestWrapper>
        <MenuDataProvider value={{ menu, status: "local" }}>
          <CartProvider>
            <SeedCartLine />
            <MenuCartDrawer />
            <CartProbe />
          </CartProvider>
        </MenuDataProvider>
      </KitTestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review order/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect((screen.getByLabelText("Special instructions") as HTMLTextAreaElement).value).toBe("extra crispy");

    fireEvent.click(screen.getByLabelText("Fries"));
    fireEvent.click(screen.getByRole("button", { name: /Update cart/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("cart-open").textContent).toBe("true");
    expect(JSON.parse(screen.getByTestId("cart-items").textContent ?? "[]")).toEqual([
      {
        itemId: "item-shawarma",
        itemName: "Chicken Shawarma",
        removedIngredients: ["Fries"],
        key: "item-shawarma:default:no=fries",
        quantity: 1,
        note: "extra crispy",
      },
    ]);
  });
});
