// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import type { MenuCategory, MenuItem } from "../menu/menuSchema";
import { MenuCategoryBlock } from "./MenuCategoryBlock";

const category: MenuCategory = { id: "category-starters", groupId: "group-food", title: "Starters", order: 0, isVisible: true };

const item: MenuItem = {
  id: "item-poppers",
  categoryId: "category-starters",
  title: "Jalapenos Poppers",
  description: "6pcs of spicy golden crispy cheddar bites + dip",
  image: "assets/menu/starters/poppers.jpg",
  order: 0,
  isVisible: true,
  pricingMode: "single",
  price: "7.50",
  sizes: [],
};

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderBlock() {
  render(
    <CartProvider>
      <MenuCategoryBlock category={category} groupId="group-food" groupLabel="Food" isOpen items={[item]} onToggle={() => {}} />
    </CartProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MenuCategoryBlock item count", () => {
  it("uses the singular for a single item", () => {
    stubMatchMedia(false);
    renderBlock();

    expect(screen.getByText("1 item")).toBeTruthy();
  });

  it("uses the plural otherwise", () => {
    stubMatchMedia(false);
    render(
      <CartProvider>
        <MenuCategoryBlock category={category} groupId="group-food" groupLabel="Food" isOpen items={[item, { ...item, id: "item-two" }]} onToggle={() => {}} />
      </CartProvider>,
    );

    expect(screen.getByText("2 items")).toBeTruthy();
  });
});

describe("MenuCategoryBlock responsive layout", () => {
  it("renders full cards on wide viewports", () => {
    stubMatchMedia(false);
    renderBlock();

    expect(screen.getByRole("button", { name: "Add to cart" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Jalapenos Poppers to cart" })).toBeNull();
  });

  it("opens the item dialog from the desktop card text", () => {
    stubMatchMedia(false);
    renderBlock();

    fireEvent.click(screen.getByRole("button", { name: "Customize Jalapenos Poppers" }));

    expect(screen.getByRole("dialog", { name: "Jalapenos Poppers" })).toBeTruthy();
  });

  it("renders compact rows on narrow viewports and opens the item sheet", () => {
    stubMatchMedia(true);
    renderBlock();

    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Jalapenos Poppers/ }));

    expect(screen.getByRole("dialog", { name: "Jalapenos Poppers" })).toBeTruthy();
  });

  it("parks a history entry on open and closes the sheet on browser back", () => {
    stubMatchMedia(true);
    const pushSpy = vi.spyOn(window.history, "pushState");
    renderBlock();

    fireEvent.click(screen.getByRole("button", { name: /^Jalapenos Poppers/ }));
    expect(pushSpy).toHaveBeenCalledWith({ parkedSheet: expect.any(Number) }, "");

    fireEvent.popState(window);

    expect(screen.queryByRole("dialog")).toBeNull();
    pushSpy.mockRestore();
  });

  it("routes UI closes through history.back so the parked entry is consumed", () => {
    stubMatchMedia(true);
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => fireEvent.popState(window));
    renderBlock();

    fireEvent.click(screen.getByRole("button", { name: /^Jalapenos Poppers/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    backSpy.mockRestore();
  });
});
