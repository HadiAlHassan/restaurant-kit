import type { ReactNode } from "react";
import { CartProvider } from "../cart/CartProvider";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { LocationsSection } from "../components/LocationsSection";
import { Marquee } from "../components/Marquee";
import { RatingSection } from "../components/RatingSection";
import { MenuCartDrawer } from "../menu-browser/MenuCartDrawer";
import { MenuSection } from "../menu-browser/MenuSection";
import { useOrdering } from "../config/useOrdering";
import { MenuDataProvider, useMenuData, type MenuDataValue } from "../menu/useMenuData";

type MenuSiteProps = {
  readonly menuData?: MenuDataValue;
};

// Fetches the menu once and provides it, so every consumer below
// (menu browser, cart drawer editor) shares the same data.
function FetchedMenuDataProvider({ children }: { readonly children: ReactNode }) {
  const menuData = useMenuData();
  return <MenuDataProvider value={menuData}>{children}</MenuDataProvider>;
}

export function MenuSite({ menuData }: MenuSiteProps) {
  const { cartEnabled } = useOrdering();
  const site = (
    <CartProvider>
      <Header />
      <main id="top">
        <Hero />
        <Marquee />
        <MenuSection />
        <RatingSection />
        <LocationsSection />
      </main>
      {cartEnabled ? <MenuCartDrawer /> : null}
      <Footer />
    </CartProvider>
  );

  if (!menuData) return <FetchedMenuDataProvider>{site}</FetchedMenuDataProvider>;

  return <MenuDataProvider value={menuData}>{site}</MenuDataProvider>;
}
