import type { ReactNode } from "react";
import { AdminDraftContext } from "./adminDraftContext";
import { useAdminMenuDraft, type UseAdminMenuDraftOptions } from "./useAdminMenuDraft";

type AdminDraftProviderProps = {
  readonly children: ReactNode;
  readonly options?: UseAdminMenuDraftOptions;
};

/**
 * Owns the admin draft above the editor and preview routes, so navigating between them keeps
 * unsaved edits in memory instead of remounting the editor and reloading the remote draft.
 */
export function AdminDraftProvider({ children, options }: AdminDraftProviderProps) {
  const draft = useAdminMenuDraft(options);
  return <AdminDraftContext.Provider value={draft}>{children}</AdminDraftContext.Provider>;
}
