import { createContext, useContext } from "react";
import type { MenuApiClient } from "../menu/menuApi";
import type { DynamicMenu } from "../menu/menuSchema";
import type { RestaurantSiteConfig } from "./siteTypes";

export type RestaurantKitValue = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /** Remote client in production, browser-local adapter on localhost. Built once per provider. */
  readonly menuApi: MenuApiClient;
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
