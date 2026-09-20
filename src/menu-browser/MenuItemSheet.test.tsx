// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import { useCart } from "../cart/useCart";
import type { MenuItem } from "../menu/menuSchema";
import { MenuItemSheet } from "./MenuItemSheet";

const item: MenuItem = {
  id: "item-shawarma",
  categoryId: "category-shawarma",
  title: "Chicken Shawarma",
  description: "Marinated chicken, garlic sauce, pickles and fries in saj bread",
  image: "assets/menu/shawarma/chicken.jpg",
  order: 0,
  isVisible: true,
  pricingMode: "sizes",
  price: "",
  sizes: [
    { id: "size-s", label: "Small", price: "5.50", order: 0 },
    { id: "size-l", label: "Large", price: "8", order: 1 },
  ],
};

function CartProbe() {
  const { items, isOpen } = useCart();
  return (
    <>
      <output data-testid="cart-items">{JSON.stringify(items)}</output>
      <output data-testid="cart-open">{String(isOpen)}</output>
    </>
  );
}

function SeedCartLine() {
  const { addItem } = useCart();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    addItem({ itemId: "item-shawarma", itemName: "Chicken Shawarma", variationId: "size-s", variationName: "Small" });
  }, [addItem]);
  return null;
}

function renderSheet(onClose = vi.fn(), sheetItem: MenuItem = item) {
  render(
    <CartProvider>
      <MenuItemSheet item={sheetItem} onClose={onClose} />
      <CartProbe />
    </CartProvider>,
  );
  return onClose;
}

afterEach(cleanup);

describe("MenuItemSheet", () => {
  it("adds the selected size with quantity and note, then closes", () => {
    const onClose = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /L\s*\$8/ }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.change(screen.getByLabelText("Special instructions"), { target: { value: "no pickles" } });
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("cart-items").textContent ?? "[]")).toEqual([
      { itemId: "item-shawarma", itemName: "Chicken Shawarma", variationId: "size-l", variationName: "Large", key: "item-shawarma:size-l", quantity: 2, note: "no pickles" },
    ]);
  });

  it("shows a live total that follows size and quantity", () => {
    renderSheet();

    expect(screen.getByRole("button", { name: /Add to cart/ }).textContent).toContain("$5.50");

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByRole("button", { name: /Add to cart/ }).textContent).toContain("$11");
  });

  it("quantity never drops below one", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));

    expect(screen.getByLabelText("Chicken Shawarma quantity").textContent).toContain("1");
  });

  it("adds removed ingredients to the cart line", () => {
    renderSheet(vi.fn(), { ...item, removableIngredients: ["Pickles", "Garlic sauce", "Fries"] });

    fireEvent.click(screen.getByLabelText("Pickles"));
    fireEvent.click(screen.getByLabelText("Fries"));
    fireEvent.click(screen.getByLabelText("Fries"));
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    expect(JSON.parse(screen.getByTestId("cart-items").textContent ?? "[]")).toEqual([
      {
        itemId: "item-shawarma",
        itemName: "Chicken Shawarma",
        variationId: "size-s",
        variationName: "Small",
        removedIngredients: ["Pickles"],
        key: "item-shawarma:size-s:no=pickles",
        quantity: 1,
      },
    ]);
  });

  it("hides the remove-ingredients section when the item declares none", () => {
    renderSheet();

    expect(screen.queryByText("Remove ingredients")).toBeNull();
  });

  it("zooms the hero photo into a lightbox; Escape closes the lightbox before the sheet", () => {
    const onClose = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "View photo of Chicken Shawarma" }));
    expect(screen.getByRole("button", { name: "Close photo" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close photo" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("edit mode prefills the line and replaces it on Update", () => {
    const onClose = vi.fn();
    render(
      <CartProvider>
        <SeedCartLine />
        <MenuItemSheet
          item={{ ...item, removableIngredients: ["Pickles", "Fries"] }}
          editLine={{
            key: "item-shawarma:size-s",
            itemId: "item-shawarma",
            itemName: "Chicken Shawarma",
            variationId: "size-s",
            variationName: "Small",
            quantity: 1,
            note: "extra crispy",
          }}
          onClose={onClose}
        />
        <CartProbe />
      </CartProvider>,
    );

    expect((screen.getByLabelText("Special instructions") as HTMLTextAreaElement).value).toBe("extra crispy");
    expect(screen.queryByText(/In your cart/)).toBeNull();

    fireEvent.click(screen.getByLabelText("Pickles"));
    fireEvent.click(screen.getByRole("button", { name: /Update cart/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("cart-items").textContent ?? "[]")).toEqual([
      {
        itemId: "item-shawarma",
        itemName: "Chicken Shawarma",
        variationId: "size-s",
        variationName: "Small",
        removedIngredients: ["Pickles"],
        key: "item-shawarma:size-s:no=pickles",
        quantity: 1,
        note: "extra crispy",
      },
    ]);
  });

  it("flags when the item is already in the cart and offers a jump to edit it", () => {
    const onClose = vi.fn();
    render(
      <CartProvider>
        <SeedCartLine />
        <MenuItemSheet item={item} onClose={onClose} />
        <CartProbe />
      </CartProvider>,
    );

    expect(screen.getByText(/In your cart: 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit cart" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cart-open").textContent).toBe("true");
  });

  it("shows no in-cart notice for a fresh item", () => {
    renderSheet();

    expect(screen.queryByText(/In your cart/)).toBeNull();
  });

  it("closes on Escape without adding", () => {
    const onClose = renderSheet();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("cart-items").textContent ?? "[]")).toEqual([]);
  });
});
