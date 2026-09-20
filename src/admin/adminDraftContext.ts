import { createContext } from "react";
import type { AdminMenuDraft } from "./useAdminMenuDraft";

export const AdminDraftContext = createContext<AdminMenuDraft | null>(null);
