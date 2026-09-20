// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart/CartProvider";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { LocationsSection } from "../components/LocationsSection";
import { MenuCard } from "../menu-browser/MenuCard";
import { MenuItemSheet } from "../menu-browser/MenuItemSheet";
import { MenuRow } from "../menu-browser/MenuRow";
import type { MenuItem } from "../menu/menuSchema";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import type { RestaurantSiteConfig } from "./siteTypes";

const toters = { ordering: { mode: "external", url: "https://toters.example/demo-grill", label: "Order on Toters" } } satisfies Partial<RestaurantSiteConfig>;

const item: MenuItem = {
  id: "item-burger",
  categoryId: "category-burgers",
  title: "Classic Burger",
  description: "Beef patty, cheddar, pickles",
  image: "assets/menu/burgers/classic.jpg",
  order: 0,
  isVisible: true,
  pricingMode: "single",
  price: "9.00",
  sizes: [],
  removableIngredients: ["Pickles"],
};

function renderWith(config: Partial<RestaurantSiteConfig> | undefined, children: ReactNode) {
  return render(
    <KitTestWrapper config={config}>
      <CartProvider>{children}</CartProvider>
    </KitTestWrapper>,
  );
}

// Header reads the viewport width; jsdom has no matchMedia.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});

afterEach(cleanup);

describe("ordering: whatsapp (default)", () => {
  it("links the order buttons to WhatsApp and keeps add-to-cart", () => {
    renderWith(
      undefined,
      <>
        <Header />
        <Hero />
        <MenuCard item={item} onOpen={() => {}} />
      </>,
    );

    expect(screen.getByRole("link", { name: "Order on WhatsApp" }).getAttribute("href")).toBe("https://wa.me/96170000000");
    expect(screen.getByRole("link", { name: "Order" }).getAttribute("href")).toBe("https://wa.me/96170000000");
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customize Classic Burger" })).toBeTruthy();
  });
});

describe("ordering: external", () => {
  it("points the header and hero buttons at the ordering app", () => {
    renderWith(
      toters,
      <>
        <Header />
        <Hero />
      </>,
    );

    expect(screen.getByRole("link", { name: "Order on Toters" }).getAttribute("href")).toBe("https://toters.example/demo-grill");
    expect(screen.getByRole("link", { name: "Order" }).getAttribute("href")).toBe("https://toters.example/demo-grill");
    expect(screen.queryByText("Order on WhatsApp")).toBeNull();
  });

  it("shows the ordering app's logo inside the buttons when iconSrc is set", () => {
    const { container } = renderWith({ ordering: { ...toters.ordering, iconSrc: "/assets/toters.svg" } }, <Hero />);

    expect(container.querySelector('a[href="https://toters.example/demo-grill"] img')?.getAttribute("src")).toBe("/assets/toters.svg");
  });

  it("makes cards and rows browse-only", () => {
    renderWith(
      toters,
      <>
        <MenuCard item={item} onOpen={() => {}} />
        <MenuRow item={item} onOpen={() => {}} />
      </>,
    );

    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Classic Burger to cart" })).toBeNull();
    // Card + row thumbnail both open the detail sheet; nothing says "Customize" any more.
    expect(screen.getAllByRole("button", { name: "View Classic Burger" }).length).toBe(2);
    expect(screen.queryByRole("button", { name: "Customize Classic Burger" })).toBeNull();
  });

  it("turns the item sheet into a detail view that hands off to the ordering app", () => {
    renderWith(toters, <MenuItemSheet item={item} onClose={() => {}} />);

    expect(screen.getByText("Beef patty, cheddar, pickles")).toBeTruthy();
    expect(screen.queryByText("Remove ingredients")).toBeNull();
    expect(screen.queryByLabelText("Special instructions")).toBeNull();
    expect(screen.queryByRole("button", { name: /Add to cart/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Order on Toters" }).getAttribute("href")).toBe("https://toters.example/demo-grill");
  });
});

describe("whatsappNumber: empty", () => {
  it("drops the WhatsApp link from the contact card", () => {
    renderWith({ ...toters, whatsappNumber: "" }, <LocationsSection />);

    expect(screen.getByRole("heading", { name: "Call us" })).toBeTruthy();
    expect(screen.queryByText("Message on WhatsApp")).toBeNull();
  });
});
