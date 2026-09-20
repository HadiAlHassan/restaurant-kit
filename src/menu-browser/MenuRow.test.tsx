// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import type { MenuItem } from "../menu/menuSchema";
import { MenuRow } from "./MenuRow";

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
    { id: "size-l", label: "Large", price: "8", order: 1 },
    { id: "size-s", label: "Small", price: "5.50", order: 0 },
  ],
};

function renderRow(onOpen = vi.fn(), rowItem: MenuItem = item) {
  render(
    <CartProvider>
      <MenuRow item={rowItem} onOpen={onOpen} />
    </CartProvider>,
  );
  return onOpen;
}

afterEach(cleanup);

describe("MenuRow", () => {
  it("shows title, description, cheapest price, and size hint", () => {
    renderRow();

    expect(screen.getByText("Chicken Shawarma")).toBeTruthy();
    expect(screen.getByText(/garlic sauce/)).toBeTruthy();
    expect(screen.getByText("$5.50")).toBeTruthy();
    expect(screen.getByText(/S \/ L/)).toBeTruthy();
  });

  it("opens the item sheet when the row is tapped", () => {
    const onOpen = renderRow();

    fireEvent.click(screen.getByRole("button", { name: /^Chicken Shawarma/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("instant-adds the default size from the plus button and shows the quantity badge", () => {
    renderRow();
    const addButton = screen.getByRole("button", { name: "Add Chicken Shawarma to cart" });

    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(addButton.textContent).toContain("2");
  });
});
