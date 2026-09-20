import "./styles/global.css";

export { RestaurantSite } from "./RestaurantSiteRoutes";

export { RestaurantKitProvider } from "./config/RestaurantKitProvider";
export { useMenuApi, useRestaurantKit, useSeedMenu, useSiteConfig, type RestaurantKitValue } from "./config/siteConfigContext";
export type { RestaurantSiteConfig } from "./config/siteTypes";

export { MenuSite } from "./pages/MenuSite";
export { AdminMenuEditor } from "./pages/AdminMenuEditor";
export { AdminPreview } from "./pages/AdminPreview";

export { Brand } from "./components/Brand";
export { Footer } from "./components/Footer";
export { Header } from "./components/Header";
export { Hero } from "./components/Hero";
export { LocationsSection } from "./components/LocationsSection";
export { Marquee } from "./components/Marquee";
export { RatingSection } from "./components/RatingSection";
export { WhatsAppIcon } from "./components/WhatsAppIcon";

export { MenuBrowser } from "./menu-browser/MenuBrowser";
export { MenuSection } from "./menu-browser/MenuSection";
export { MenuCartDrawer } from "./menu-browser/MenuCartDrawer";

export { CartProvider } from "./cart/CartProvider";
export { useCart } from "./cart/useCart";
export { buildWhatsAppMessage, buildWhatsAppOrderUrl, cartSelectionKey, formatVariationName, type CartOrderConfig } from "./cart/cartOrder";
export type { CartItem, CartSelection, CartState, CartContextValue } from "./cart/cartTypes";

export { MenuDataProvider, useMenuData, type MenuDataStatus, type MenuDataValue } from "./menu/useMenuData";
export {
  createMenuApiClient,
  MenuApiError,
  type AdminAuthStrategy,
  type AdminSession,
  type MenuApiClient,
  type MenuApiClientOptions,
  type MenuImageUpload,
  type PublishResult,
} from "./menu/menuApi";
export { createLocalMenuApiClient, shouldUseLocalMenuApi } from "./menu/localMenuApi";
export { clearMenuDraft, menuDraftStorageKey, readMenuDraft, writeMenuDraft } from "./menu/menuDraftStorage";
export { menuIcons, menuIconOptions } from "./menu/menuIcons";
export { formatPrice, formatPriceTotal, priceFromInput, priceInputValue, type PriceCurrency } from "./menu/priceFormat";
export type { DynamicMenu, MenuCategory, MenuGroup, MenuIcon, MenuItem, MenuSize } from "./menu/menuSchema";

export { useAdminMenuDraft, type AdminMenuDraft, type UseAdminMenuDraftOptions } from "./admin/useAdminMenuDraft";
export { AdminDraftProvider } from "./admin/AdminDraftProvider";
export { useAdminDraft, useAdminDraftContext } from "./admin/useAdminDraft";
export { applyAdminMenuCommand, getAdminMenuCommandRejection, type AdminMenuCommand, type AdminMenuCommandRejection } from "./admin/adminMenuCommands";
