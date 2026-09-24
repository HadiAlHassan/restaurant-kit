import { Outlet } from "react-router-dom";
import { AdminMenuEditor } from "../pages/AdminMenuEditor";
import { AdminPreview } from "../pages/AdminPreview";
import { AdminDraftProvider } from "./AdminDraftProvider";

/** Everything under `/admin`, in one module so `RestaurantSite` can load it on demand. */
export function AdminLayout() {
  return (
    <AdminDraftProvider>
      <Outlet />
    </AdminDraftProvider>
  );
}

export { AdminMenuEditor, AdminPreview };
