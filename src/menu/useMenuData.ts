import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from "react";
import { useRestaurantKit } from "../config/siteConfigContext";
import { shouldUseLocalMenuApi } from "./localMenuApi";
import { readMenuDraft } from "./menuDraftStorage";
import type { DynamicMenu } from "./menuSchema";

const menuApiUrl = (import.meta.env.VITE_MENU_API_URL as string | undefined) ?? "/api/menu";

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
  const { seedMenu, draftStorageKey } = useRestaurantKit();
  const [menu, setMenu] = useState<DynamicMenu>(seedMenu);
  const [status, setStatus] = useState<MenuDataStatus>("local");

  useEffect(() => {
    if (!enabled) return;

    if (shouldUseLocalMenuApi()) {
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
  }, [draftStorageKey, enabled, seedMenu]);

  return { menu, status };
}

export function useMenuData() {
  const providedMenuData = useContext(MenuDataContext);
  const remoteMenuData = useRemoteMenuData(!providedMenuData);

  return providedMenuData ?? remoteMenuData;
}
