import type { ReactNode } from "react";
import { RestaurantKitProvider } from "../config/RestaurantKitProvider";
import type { MenuApiClient } from "../menu/menuApi";
import { demoSeedMenu, demoSiteConfig } from "./fixtures";

type KitTestWrapperProps = {
  readonly children: ReactNode;
  /** Optional API client override, e.g. a fake for hook tests. */
  readonly menuApi?: MenuApiClient;
};

/** Test wrapper: the demo restaurant provider, for render()/renderHook() `wrapper`. */
export function KitTestWrapper({ children, menuApi }: KitTestWrapperProps) {
  return (
    <RestaurantKitProvider config={demoSiteConfig} seedMenu={demoSeedMenu} menuApi={menuApi}>
      {children}
    </RestaurantKitProvider>
  );
}
