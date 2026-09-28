import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary, SiteErrorFallback } from "./components/ErrorBoundary";
import { RestaurantKitProvider } from "./config/RestaurantKitProvider";
import type { RestaurantKitApiOptions } from "./config/siteConfigContext";
import type { RestaurantSiteConfig } from "./config/siteTypes";
import type { DynamicMenu } from "./menu/menuSchema";
import { MenuSite } from "./pages/MenuSite";

// The editor pulls in drag-and-drop, the image cropper and menus; customers never need them.
const loadAdmin = () => import("./admin/AdminRoutes");
const AdminLayout = lazy(() => loadAdmin().then((module) => ({ default: module.AdminLayout })));
const AdminMenuEditor = lazy(() => loadAdmin().then((module) => ({ default: module.AdminMenuEditor })));
const AdminPreview = lazy(() => loadAdmin().then((module) => ({ default: module.AdminPreview })));

type RestaurantSiteProps = {
  readonly config: RestaurantSiteConfig;
  readonly seedMenu: DynamicMenu;
  /** Pass your Vite env here: `{ baseUrl: import.meta.env.VITE_MENU_API_BASE_URL, publicMenuUrl: import.meta.env.VITE_MENU_API_URL }`. */
  readonly api?: RestaurantKitApiOptions;
};

export function RestaurantSite({ config, seedMenu, api }: RestaurantSiteProps) {
  return (
    <RestaurantKitProvider config={config} seedMenu={seedMenu} api={api}>
      <Toaster closeButton richColors position="top-center" />
      <ErrorBoundary fallback={<SiteErrorFallback />}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<MenuSite />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminMenuEditor />} />
              <Route path="/admin/preview" element={<AdminPreview />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </RestaurantKitProvider>
  );
}
