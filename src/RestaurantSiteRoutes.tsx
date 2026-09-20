import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AdminDraftProvider } from "./admin/AdminDraftProvider";
import { RestaurantKitProvider } from "./config/RestaurantKitProvider";
import type { RestaurantKitApiOptions } from "./config/siteConfigContext";
import type { RestaurantSiteConfig } from "./config/siteTypes";
import type { DynamicMenu } from "./menu/menuSchema";
import { AdminMenuEditor } from "./pages/AdminMenuEditor";
import { AdminPreview } from "./pages/AdminPreview";
import { MenuSite } from "./pages/MenuSite";

type RestaurantSiteProps = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /** Pass your Vite env here: `{ baseUrl: import.meta.env.VITE_MENU_API_BASE_URL, publicMenuUrl: import.meta.env.VITE_MENU_API_URL }`. */
  readonly api?: RestaurantKitApiOptions;
};

function AdminLayout() {
  return (
    <AdminDraftProvider>
      <Outlet />
    </AdminDraftProvider>
  );
}

export function RestaurantSite({ config, seedMenu, api }: RestaurantSiteProps) {
  return (
    <RestaurantKitProvider config={config} seedMenu={seedMenu} api={api}>
      <Toaster closeButton richColors position="top-center" />
      <Routes>
        <Route path="/" element={<MenuSite />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminMenuEditor />} />
          <Route path="/admin/preview" element={<AdminPreview />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RestaurantKitProvider>
  );
}
