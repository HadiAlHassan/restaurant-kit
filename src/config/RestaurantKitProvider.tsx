import { useMemo, type ReactNode } from "react";
import { createLocalMenuApiClient, shouldUseLocalMenuApi } from "../menu/localMenuApi";
import { createMenuApiClient, type MenuApiClient } from "../menu/menuApi";
import { menuDraftStorageKey } from "../menu/menuDraftStorage";
import type { DynamicMenu } from "../menu/menuSchema";
import { SiteConfigContext, type RestaurantKitValue } from "./siteConfigContext";
import type { RestaurantSiteConfig } from "./siteTypes";

type RestaurantKitProviderProps = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /** Override the API client (tests, custom transports). Defaults to remote, or local on localhost. */
  readonly menuApi?: MenuApiClient;
  readonly children: ReactNode;
};

/**
 * Single source of restaurant identity. Everything that needs the config, seed menu, API
 * client, or draft key reads it from here — there is no module-scope fallback, so two
 * providers on one page can never bleed into each other.
 */
export function RestaurantKitProvider({ config, seedMenu, menuApi, children }: RestaurantKitProviderProps) {
  const value = useMemo<RestaurantKitValue>(() => {
    const draftStorageKey = menuDraftStorageKey(config.restaurantId);
    return {
      config,
      seedMenu,
      draftStorageKey,
      menuApi: menuApi ?? (shouldUseLocalMenuApi() ? createLocalMenuApiClient(seedMenu, draftStorageKey) : createMenuApiClient()),
    };
  }, [config, menuApi, seedMenu]);

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}
