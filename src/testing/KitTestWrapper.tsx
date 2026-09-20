import type { ReactNode } from "react";
import { RestaurantKitProvider } from "../config/RestaurantKitProvider";
import type { RestaurantKitApiOptions } from "../config/siteConfigContext";
import type { RestaurantSiteConfig } from "../config/siteTypes";
import type { MenuApiClient } from "../menu/menuApi";
import { demoSeedMenu, demoSiteConfig } from "./fixtures";

type KitTestWrapperProps = {
  readonly children: ReactNode;
  /** Optional API client override, e.g. a fake for hook tests. */
  readonly menuApi?: MenuApiClient;
  readonly api?: RestaurantKitApiOptions;
  /** Overrides merged onto the demo config, e.g. `{ ordering: … }`. */
  readonly config?: Partial<RestaurantSiteConfig>;
};

/** Test wrapper: the demo restaurant provider, for render()/renderHook() `wrapper`. */
export function KitTestWrapper({ children, menuApi, api, config }: KitTestWrapperProps) {
  return (
    <RestaurantKitProvider config={config ? { ...demoSiteConfig, ...config } : demoSiteConfig} seedMenu={demoSeedMenu} menuApi={menuApi} api={api}>
      {children}
    </RestaurantKitProvider>
  );
}
