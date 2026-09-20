// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import { CartDrawer } from "./CartDrawer";
import { CartProvider } from "./CartProvider";
import { useCart } from "./useCart";

function OpenCartButton() {
  const { openCart } = useCart();
  return (
    <button type="button" onClick={openCart}>
      Open cart
    </button>
  );
}

function renderDrawer() {
  render(
    <KitTestWrapper>
      <CartProvider>
        <OpenCartButton />
        <CartDrawer />
      </CartProvider>
    </KitTestWrapper>,
  );
  return screen.getByLabelText("Order cart", { selector: "aside" });
}

afterEach(cleanup);

describe("CartDrawer", () => {
  it("is inert and hidden from assistive tech while closed", () => {
    const drawer = renderDrawer();

    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(drawer.hasAttribute("inert")).toBe(true);
  });

  it("drops inert once opened so its controls become reachable", () => {
    const drawer = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Open cart" }));

    expect(drawer.getAttribute("aria-hidden")).toBe("false");
    expect(drawer.hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("button", { name: "Close cart" })).toBeTruthy();
  });
});
