import { useMemo, type ReactNode } from "react";
import { createLocalMenuApiClient, shouldUseLocalMenuApi } from "../menu/localMenuApi";
import { createMenuApiClient, type MenuApiClient } from "../menu/menuApi";
import { menuDraftStorageKey } from "../menu/menuDraftStorage";
import type { DynamicMenu } from "../menu/menuSchema";
import { SiteConfigContext, type RestaurantKitApiOptions, type RestaurantKitValue } from "./siteConfigContext";
import type { RestaurantSiteConfig } from "./siteTypes";

type RestaurantKitProviderProps = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /**
   * API endpoints, typically fed from the site's own Vite env:
   * `{ baseUrl: import.meta.env.VITE_MENU_API_BASE_URL, publicMenuUrl: import.meta.env.VITE_MENU_API_URL }`.
   */
  readonly api?: RestaurantKitApiOptions;
  /** Override the API client entirely (tests, custom transports). */
  readonly menuApi?: MenuApiClient;
  readonly children: ReactNode;
};

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Single source of restaurant identity. Everything that needs the config, seed menu, API
 * client, or draft key reads it from here — there is no module-scope fallback, so two
 * providers on one page can never bleed into each other.
 */
export function RestaurantKitProvider({ config, seedMenu, api, menuApi, children }: RestaurantKitProviderProps) {
  const baseUrl = api?.baseUrl?.trim() ?? "";
  const publicMenuUrl = api?.publicMenuUrl?.trim() || joinUrl(baseUrl, "/api/menu");
  const mode = api?.mode ?? "auto";

  const value = useMemo<RestaurantKitValue>(() => {
    const draftStorageKey = menuDraftStorageKey(config.restaurantId);
    const isLocalApi = mode === "local" || (mode === "auto" && shouldUseLocalMenuApi(baseUrl));
    return {
      config,
      seedMenu,
      draftStorageKey,
      publicMenuUrl,
      isLocalApi,
      menuApi: menuApi ?? (isLocalApi ? createLocalMenuApiClient(seedMenu, draftStorageKey) : createMenuApiClient({ apiBaseUrl: baseUrl, publicMenuUrl })),
    };
  }, [baseUrl, config, menuApi, mode, publicMenuUrl, seedMenu]);

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}
