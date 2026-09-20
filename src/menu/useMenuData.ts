import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from "react";
import { useRestaurantKit } from "../config/siteConfigContext";
import { readMenuDraft } from "./menuDraftStorage";
import type { DynamicMenu } from "./menuSchema";

export type MenuDataStatus = "local" | "loading" | "remote" | "fallback" | "draft";

export type MenuDataValue = {
  readonly menu: DynamicMenu;
  readonly status: MenuDataStatus;
};

const MenuDataContext = createContext<MenuDataValue | null>(null);

export function MenuDataProvider({ children, value }: { readonly children: ReactNode; readonly value: MenuDataValue }) {
  return createElement(MenuDataContext.Provider, { value }, children);
}

function useRemoteMenuData(enabled: boolean) {
  const { seedMenu, draftStorageKey, isLocalApi, publicMenuUrl: menuApiUrl } = useRestaurantKit();
  const [menu, setMenu] = useState<DynamicMenu>(seedMenu);
  const [status, setStatus] = useState<MenuDataStatus>("local");

  useEffect(() => {
    if (!enabled) return;

    if (isLocalApi) {
      const localDraft = readMenuDraft(draftStorageKey);
      if (localDraft) {
        setMenu(localDraft);
        setStatus("draft");
      }
      return;
    }

    if (!menuApiUrl) return;

    let isMounted = true;
    setStatus("loading");

    fetch(menuApiUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Menu request failed: ${response.status}`);
        return response.json() as Promise<DynamicMenu>;
      })
      .then((remoteMenu) => {
        if (!isMounted) return;
        setMenu(remoteMenu);
        setStatus("remote");
      })
      .catch(() => {
        if (!isMounted) return;
        setMenu(seedMenu);
        setStatus("fallback");
      });

    return () => {
      isMounted = false;
    };
  }, [draftStorageKey, enabled, isLocalApi, menuApiUrl, seedMenu]);

  return { menu, status };
}

export function useMenuData() {
  const providedMenuData = useContext(MenuDataContext);
  const remoteMenuData = useRemoteMenuData(!providedMenuData);

  return providedMenuData ?? remoteMenuData;
}
