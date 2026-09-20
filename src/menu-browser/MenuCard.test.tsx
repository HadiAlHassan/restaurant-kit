// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import type { MenuItem } from "../menu/menuSchema";
import { MenuCard } from "./MenuCard";

const item: MenuItem = {
  id: "item-shrimp",
  categoryId: "category-appetizers",
  title: "Bangbang Shrimps",
  description: "10 pcs of fried shrimps",
  image: "assets/menu/appetizers/bangbang-shrimps.jpg",
  order: 0,
  isVisible: true,
  pricingMode: "single",
  price: "7.50",
  sizes: [],
};

function renderCard(cardItem: MenuItem = item) {
  return render(
    <CartProvider>
      <MenuCard item={cardItem} />
    </CartProvider>,
  );
}

afterEach(cleanup);

describe("MenuCard customize affordance", () => {
  it("opens the item dialog when the card is clicked anywhere, photo included", () => {
    const onOpen = vi.fn();
    render(
      <CartProvider>
        <MenuCard item={item} onOpen={onOpen} />
      </CartProvider>,
    );
    const card = screen.getByRole("button", { name: "Customize Bangbang Shrimps" });

    fireEvent.click(screen.getByAltText("Bangbang Shrimps"));
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("keeps add-to-cart an instant shortcut that never opens the dialog", () => {
    const onOpen = vi.fn();
    render(
      <CartProvider>
        <MenuCard item={item} onOpen={onOpen} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Bangbang Shrimps quantity").textContent).toContain("1");

    fireEvent.click(screen.getByRole("button", { name: "Add one Bangbang Shrimps" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders a plain card without onOpen", () => {
    renderCard();

    expect(screen.queryByRole("button", { name: /Customize/ })).toBeNull();
  });
});
