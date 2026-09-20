import { createContext, useContext } from "react";
import type { MenuApiClient } from "../menu/menuApi";
import type { DynamicMenu } from "../menu/menuSchema";
import type { RestaurantSiteConfig } from "./siteTypes";

export type RestaurantKitApiOptions = {
  /** Origin of the menu Worker for admin calls. Empty = same origin. */
  readonly baseUrl?: string;
  /** URL of the published menu JSON. Defaults to `<baseUrl>/api/menu`. */
  readonly publicMenuUrl?: string;
  /** "auto" (default): browser-local adapter on localhost unless `baseUrl` is set. */
  readonly mode?: "auto" | "local" | "remote";
};

export type RestaurantKitValue = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /** Remote client, or the browser-local adapter (see `isLocalApi`). Built once per provider. */
  readonly menuApi: MenuApiClient;
  /** True when drafts live in this browser's localStorage instead of the Worker. */
  readonly isLocalApi: boolean;
  /** Where the public site fetches the published menu from. */
  readonly publicMenuUrl: string;
  /** localStorage key for the local-dev draft, namespaced by restaurant id. */
  readonly draftStorageKey: string;
};

export const SiteConfigContext = createContext<RestaurantKitValue | null>(null);

export function useRestaurantKit(): RestaurantKitValue {
  const value = useContext(SiteConfigContext);
  if (!value) throw new Error("restaurant-kit hooks must be used inside <RestaurantKitProvider> (or <RestaurantSite>).");
  return value;
}

export function useSiteConfig() {
  return useRestaurantKit().config;
}

export function useSeedMenu() {
  return useRestaurantKit().seedMenu;
}

export function useMenuApi() {
  return useRestaurantKit().menuApi;
}
