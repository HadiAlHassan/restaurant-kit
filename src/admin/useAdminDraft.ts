import { useContext } from "react";
import { AdminDraftContext } from "./adminDraftContext";
import { useAdminMenuDraft, type AdminMenuDraft, type UseAdminMenuDraftOptions } from "./useAdminMenuDraft";

/** The draft from the nearest provider, or null when no provider is mounted. */
export function useAdminDraftContext() {
  return useContext(AdminDraftContext);
}

/** Prefers a provider-owned draft; falls back to a local one so the editor works standalone. */
export function useAdminDraft(options: UseAdminMenuDraftOptions = {}): AdminMenuDraft {
  const providedDraft = useAdminDraftContext();
  const localDraft = useAdminMenuDraft({ ...options, enabled: providedDraft ? false : (options.enabled ?? true) });
  return providedDraft ?? localDraft;
}
