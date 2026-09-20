import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRestaurantKit } from "../config/siteConfigContext";
import type { AdminSession, MenuApiClient } from "../menu/menuApi";
import { updateMenuItem } from "../menu/menuMutations";
import type { DynamicMenu, MenuItem } from "../menu/menuSchema";
import { getApiErrorMessage, isLikelyAuthError } from "./adminEditorUtils";
import { applyAdminMenuCommand, type AdminMenuCommand, type AdminMenuCommandRejection } from "./adminMenuCommands";

export type UseAdminMenuDraftOptions = {
  readonly api?: MenuApiClient;
  readonly initialMenu?: DynamicMenu;
  /** When false the hook is inert: no remote load, no beforeunload guard. Used when a provider above already owns the draft. */
  readonly enabled?: boolean;
};

export type AdminMenuDraft = {
  readonly draftMenu: DynamicMenu;
  readonly hasUnsavedChanges: boolean;
  readonly isLoadingDraft: boolean;
  readonly isSavingDraft: boolean;
  readonly isPublishingDraft: boolean;
  readonly isBusy: boolean;
  readonly authErrorMessage: string;
  /** null until the API has answered /api/admin/session (or when it is unreachable). */
  readonly authSession: AdminSession | null;
  readonly isSigningIn: boolean;
  readonly loadRemoteDraft: () => void;
  /** Cloudflare Access strategy: full-page redirect through the Access login. */
  readonly signIn: () => void;
  /** Password strategy: exchanges the password for a session cookie, then reloads the draft. */
  readonly signInWithPassword: (password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly saveDraft: () => Promise<void>;
  readonly publishDraft: () => Promise<void>;
  readonly resetDraft: () => void;
  readonly applyMenuMutation: (mutateMenu: (menu: DynamicMenu) => DynamicMenu) => void;
  readonly applyCommand: (command: AdminMenuCommand) => AdminMenuCommandRejection | null;
  readonly uploadingItemIds: ReadonlySet<string>;
  readonly uploadItemImage: (item: MenuItem, file: File) => Promise<void>;
  readonly removeItemImage: (item: MenuItem) => Promise<void>;
};

/**
 * Draft state is versioned: every applied edit bumps `revision`, every acknowledged save
 * records the revision that was sent. "Unsaved" is derived from the two, never stored, so an
 * edit made while a save is in flight keeps the draft dirty instead of being marked synced.
 */
type DraftState = {
  readonly menu: DynamicMenu;
  readonly revision: number;
  readonly savedRevision: number;
};

type DraftAction = { readonly type: "load"; readonly menu: DynamicMenu } | { readonly type: "set"; readonly menu: DynamicMenu } | { readonly type: "saved"; readonly revision: number };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load": {
      const revision = state.revision + 1;
      return { menu: action.menu, revision, savedRevision: revision };
    }
    case "set":
      return { ...state, menu: action.menu, revision: state.revision + 1 };
    case "saved":
      return { ...state, savedRevision: Math.max(state.savedRevision, action.revision) };
  }
}

function hasUnsaved(state: DraftState) {
  return state.revision !== state.savedRevision;
}

function stamp(menu: DynamicMenu): DynamicMenu {
  return { ...menu, updatedAt: new Date().toISOString() };
}

export function useAdminMenuDraft(options: UseAdminMenuDraftOptions = {}): AdminMenuDraft {
  const kit = useRestaurantKit();
  const { api, initialMenu = kit.seedMenu, enabled = true } = options;
  const menuApi = api ?? kit.menuApi;
  const isLocalApi = api ? false : kit.isLocalApi;

  // The ref is the source of truth and is updated synchronously, so two commands issued in
  // the same tick each see the other's result; state mirrors it for rendering.
  const draftRef = useRef<DraftState>({ menu: initialMenu, revision: 0, savedRevision: 0 });
  const [draft, setDraft] = useState<DraftState>(draftRef.current);
  const commit = useCallback((action: DraftAction) => {
    draftRef.current = draftReducer(draftRef.current, action);
    setDraft(draftRef.current);
  }, []);

  // Etag of the draft as last seen from the server; sent as If-Match so a save cannot clobber
  // edits made from another tab or by another admin.
  const draftEtagRef = useRef<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(enabled);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishingDraft, setIsPublishingDraft] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState("");
  const [authSession, setAuthSession] = useState<AdminSession | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const refreshAuthSession = useCallback(() => {
    menuApi
      .getAdminSession()
      .then(setAuthSession)
      .catch(() => setAuthSession(null));
  }, [menuApi]);

  const loadRemoteDraft = useCallback(() => {
    setIsLoadingDraft(true);
    setAuthErrorMessage("");

    menuApi
      .getDraft()
      .then(({ menu: remoteMenu, etag }) => {
        draftEtagRef.current = etag;
        commit({ type: "load", menu: remoteMenu });
        refreshAuthSession();
      })
      .catch((error: unknown) => {
        if (isLikelyAuthError(error)) {
          setAuthErrorMessage(getApiErrorMessage(error));
          refreshAuthSession();
          return;
        }

        toast.error("Could not load remote draft", {
          description: getApiErrorMessage(error),
        });
      })
      .finally(() => {
        setIsLoadingDraft(false);
      });
  }, [commit, menuApi, refreshAuthSession]);

  useEffect(() => {
    if (enabled) loadRemoteDraft();
  }, [enabled, loadRemoteDraft]);

  const hasUnsavedChanges = hasUnsaved(draft);

  useEffect(() => {
    if (!enabled || !hasUnsavedChanges || typeof window === "undefined") return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled, hasUnsavedChanges]);

  const signIn = useCallback(() => {
    window.location.assign(menuApi.getAdminSignInUrl(window.location.href));
  }, [menuApi]);

  const signInWithPassword = useCallback(
    async (password: string) => {
      setIsSigningIn(true);

      try {
        const session = await menuApi.signInWithPassword(password);
        setAuthSession(session);
        setAuthErrorMessage("");
        loadRemoteDraft();
      } catch (error) {
        setAuthErrorMessage(getApiErrorMessage(error));
      } finally {
        setIsSigningIn(false);
      }
    },
    [loadRemoteDraft, menuApi],
  );

  const signOut = useCallback(async () => {
    try {
      await menuApi.signOut();
    } catch (error) {
      toast.error("Could not sign out", {
        description: getApiErrorMessage(error),
      });
      return;
    }

    setAuthSession((session) => (session ? { ...session, authenticated: false, user: null } : session));
    setAuthErrorMessage("Signed out. Sign in again to edit the remote menu.");
    toast.success("Signed out");
  }, [menuApi]);

  const applyMenuMutation = useCallback(
    (mutateMenu: (menu: DynamicMenu) => DynamicMenu) => {
      const currentMenu = draftRef.current.menu;
      const nextMenu = mutateMenu(currentMenu);
      if (nextMenu === currentMenu) return;

      commit({ type: "set", menu: stamp(nextMenu) });
    },
    [commit],
  );

  // Each save snapshots the draft at call time and is serialized onto one chain, so a second
  // click while a PUT is in flight waits for it and requests never land out of order.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const runSave = useCallback(() => {
    const { menu, revision } = draftRef.current;
    const attempt = saveChainRef.current.then(async () => {
      const { etag } = await menuApi.saveDraftMenu(menu, { ifMatch: draftEtagRef.current });
      draftEtagRef.current = etag;
      commit({ type: "saved", revision });
    });
    saveChainRef.current = attempt.catch(() => undefined);
    return attempt;
  }, [commit, menuApi]);

  const saveDraft = useCallback(async () => {
    setIsSavingDraft(true);

    try {
      await runSave();
      toast.success("Draft saved", { description: isLocalApi ? "The local draft menu has been updated." : "The remote draft menu has been updated." });
    } catch (error) {
      toast.error("Could not save draft", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [isLocalApi, runSave]);

  const publishDraft = useCallback(async () => {
    setIsPublishingDraft(true);

    try {
      if (hasUnsaved(draftRef.current)) await runSave();
      await menuApi.publishDraftMenu();
      toast.success("Draft published", { description: "The public menu now uses this draft." });
    } catch (error) {
      toast.error("Could not publish draft", {
        description: getApiErrorMessage(error),
      });
    } finally {
      setIsPublishingDraft(false);
    }
  }, [menuApi, runSave]);

  const resetDraft = useCallback(() => {
    commit({ type: "set", menu: initialMenu });
    toast.success("Draft reset locally", { description: isLocalApi ? "Save draft to update this browser." : "Save draft to update the remote draft menu." });
  }, [commit, initialMenu, isLocalApi]);

  const applyCommand = useCallback(
    (command: AdminMenuCommand): AdminMenuCommandRejection | null => {
      const currentMenu = draftRef.current.menu;
      const result = applyAdminMenuCommand(currentMenu, command);
      if (result.status === "rejected") return result.reason;
      // A command that matched nothing returns the same menu; don't dirty the draft for it.
      if (result.menu !== currentMenu) commit({ type: "set", menu: stamp(result.menu) });
      return null;
    },
    [commit],
  );

  const [uploadingItemIds, setUploadingItemIds] = useState<ReadonlySet<string>>(new Set());

  const setItemUploading = useCallback((itemId: string, isUploading: boolean) => {
    setUploadingItemIds((currentItemIds) => {
      const nextItemIds = new Set(currentItemIds);
      if (isUploading) nextItemIds.add(itemId);
      else nextItemIds.delete(itemId);
      return nextItemIds;
    });
  }, []);

  const updateItem = useCallback(
    (itemId: string, patch: Partial<MenuItem>) => {
      applyMenuMutation((currentMenu) => updateMenuItem(currentMenu, itemId, patch));
    },
    [applyMenuMutation],
  );

  const uploadItemImage = useCallback(
    async (item: MenuItem, file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Choose an image file");
        return;
      }

      const previousImageKey = item.imageKey;
      setItemUploading(item.id, true);

      try {
        const upload = await menuApi.uploadMenuImage(file);
        updateItem(item.id, {
          image: upload.url,
          imageKey: upload.key,
        });
        toast.success("Image uploaded", { description: `${item.title} now uses the new image.` });

        if (previousImageKey) {
          menuApi.deleteMenuImage(previousImageKey).catch(() => {
            toast.warning("Old image was replaced but not deleted", {
              description: "The menu item uses the new image. The old R2 object can be cleaned up later.",
            });
          });
        }
      } catch (error) {
        toast.error("Could not upload image", {
          description: getApiErrorMessage(error),
        });
      } finally {
        setItemUploading(item.id, false);
      }
    },
    [menuApi, setItemUploading, updateItem],
  );

  const removeItemImage = useCallback(
    async (item: MenuItem) => {
      const previousImageKey = item.imageKey;

      updateItem(item.id, { image: "", imageKey: undefined });

      if (!previousImageKey) {
        toast.success("Image removed", { description: "The original static asset was only cleared from this item." });
        return;
      }

      setItemUploading(item.id, true);

      try {
        await menuApi.deleteMenuImage(previousImageKey);
        toast.success("Image removed");
      } catch (error) {
        toast.warning("Image removed from item, but R2 cleanup failed", {
          description: getApiErrorMessage(error),
        });
      } finally {
        setItemUploading(item.id, false);
      }
    },
    [menuApi, setItemUploading, updateItem],
  );

  return {
    draftMenu: draft.menu,
    hasUnsavedChanges,
    isLoadingDraft,
    isSavingDraft,
    isPublishingDraft,
    isBusy: isLoadingDraft || isSavingDraft || isPublishingDraft,
    authErrorMessage,
    authSession,
    isSigningIn,
    loadRemoteDraft,
    signIn,
    signInWithPassword,
    signOut,
    saveDraft,
    publishDraft,
    resetDraft,
    applyMenuMutation,
    applyCommand,
    uploadingItemIds,
    uploadItemImage,
    removeItemImage,
  };
}
