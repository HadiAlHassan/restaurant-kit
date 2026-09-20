// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuApiError, type MenuApiClient } from "../menu/menuApi";
import type { DynamicMenu } from "../menu/menuSchema";
import { KitTestWrapper } from "../testing/KitTestWrapper";
import { useAdminMenuDraft } from "./useAdminMenuDraft";

const initialMenu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  restaurant: {
    id: "demo",
    name: "Demo Grill",
    tagline: "",
    phone: "",
    whatsapp: "",
    address: "",
  },
  groups: [{ id: "all", label: "All", icon: "plate", order: 0, isVisible: true }],
  categories: [],
  items: [],
};

const draftItem = {
  id: "item-1",
  categoryId: "category-1",
  title: "Burger",
  description: "",
  image: "https://api.example.com/images/old.webp",
  imageKey: "restaurants/demo/images/menu/old.webp",
  order: 0,
  isVisible: true,
  pricingMode: "single",
  price: "7.50",
  sizes: [],
} as const;

const remoteMenu: DynamicMenu = {
  ...initialMenu,
  updatedAt: "2026-02-01T00:00:00.000Z",
  categories: [{ id: "category-1", groupId: "all", title: "Burgers", order: 0, isVisible: true }],
  items: [draftItem],
};

function imageFile(type = "image/webp") {
  return new File(["binary"], "new.webp", { type });
}

const passwordSession = { authenticated: false, strategy: "password", user: null } as const;
const remoteDraft = { menu: remoteMenu, etag: '"v1"' };

function createFakeApi(overrides: Partial<MenuApiClient> = {}): MenuApiClient {
  return {
    getAdminSession: vi.fn().mockResolvedValue({ authenticated: true, strategy: "password", user: "owner" }),
    signInWithPassword: vi.fn().mockResolvedValue({ authenticated: true, strategy: "password", user: "owner" }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getPublishedMenu: vi.fn().mockResolvedValue(remoteMenu),
    getDraftMenu: vi.fn().mockResolvedValue(remoteMenu),
    getDraft: vi.fn().mockResolvedValue(remoteDraft),
    getAdminSignInUrl: vi.fn((returnTo?: string) => `https://api.example.com/api/admin/sign-in?returnTo=${encodeURIComponent(returnTo ?? "")}`),
    saveDraftMenu: vi.fn().mockResolvedValue({ etag: '"v2"' }),
    publishDraftMenu: vi.fn().mockResolvedValue({ ok: true, backupKey: null }),
    uploadMenuImage: vi.fn().mockResolvedValue({ key: "k", url: "u" }),
    deleteMenuImage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderDraft(api: MenuApiClient) {
  return renderHook(() => useAdminMenuDraft({ api, initialMenu }), { wrapper: KitTestWrapper });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(cleanup);

describe("useAdminMenuDraft", () => {
  it("loads the remote draft on mount", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);

    expect(result.current.isLoadingDraft).toBe(true);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    expect(result.current.draftMenu).toEqual(remoteMenu);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.authErrorMessage).toBe("");
    await waitFor(() => expect(result.current.authSession?.authenticated).toBe(true));
  });

  it("discovers the auth strategy after an admin 401", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Unauthorized.", 401)),
      getAdminSession: vi.fn().mockResolvedValue(passwordSession),
    });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.authSession).toEqual(passwordSession));
    expect(result.current.authErrorMessage).toBe("Unauthorized.");
  });

  it("leaves the strategy unknown when the session endpoint is unreachable", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Could not reach the menu API. Check your connection, then retry.", 0)),
      getAdminSession: vi.fn().mockRejectedValue(new MenuApiError("Could not reach the menu API. Check your connection, then retry.", 0)),
    });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));
    expect(result.current.authErrorMessage).toContain("Could not reach");
    expect(result.current.authSession).toBeNull();
  });

  it("signs in with a password and reloads the draft", async () => {
    const getDraft = vi.fn().mockRejectedValueOnce(new MenuApiError("Unauthorized.", 401)).mockResolvedValueOnce(remoteDraft);
    const api = createFakeApi({ getDraft, getAdminSession: vi.fn().mockResolvedValue(passwordSession) });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.authErrorMessage).toBe("Unauthorized."));

    await act(async () => {
      await result.current.signInWithPassword("open sesame");
    });

    expect(api.signInWithPassword).toHaveBeenCalledWith("open sesame");
    await waitFor(() => expect(result.current.draftMenu).toEqual(remoteMenu));
    expect(result.current.authErrorMessage).toBe("");
    expect(result.current.isSigningIn).toBe(false);
    expect(getDraft).toHaveBeenCalledTimes(2);
  });

  it("shows the API message when the password is wrong", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Unauthorized.", 401)),
      getAdminSession: vi.fn().mockResolvedValue(passwordSession),
      signInWithPassword: vi.fn().mockRejectedValue(new MenuApiError("Wrong password.", 401)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.signInWithPassword("nope");
    });

    expect(result.current.authErrorMessage).toBe("Wrong password.");
    expect(result.current.authSession).toEqual(passwordSession);
    expect(api.getDraft).toHaveBeenCalledTimes(1);
  });

  it("signs out and re-gates the editor", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.authSession?.authenticated).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.authSession).toEqual({ authenticated: false, strategy: "password", user: null });
    expect(result.current.authErrorMessage).toContain("Signed out");
  });

  it("keeps the session when sign-out fails", async () => {
    const api = createFakeApi({ signOut: vi.fn().mockRejectedValue(new MenuApiError("Menu API request failed with status 500.", 500)) });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.authSession?.authenticated).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.authSession?.authenticated).toBe(true);
    expect(result.current.authErrorMessage).toBe("");
  });

  it("enters auth-required state on unreachable-API load errors", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Could not reach the menu API. Check your connection, then retry.", 0)),
    });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    expect(result.current.authErrorMessage).toContain("Could not reach the menu API");
    expect(result.current.draftMenu).toEqual(initialMenu);
  });

  it("enters auth-required state on admin 401 responses", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Unauthorized.", 401)),
    });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    expect(result.current.authErrorMessage).toBe("Unauthorized.");
    expect(result.current.draftMenu).toEqual(initialMenu);
  });

  it("keeps the initial menu on non-auth load errors", async () => {
    const api = createFakeApi({
      getDraft: vi.fn().mockRejectedValue(new MenuApiError("Menu API request failed with status 500.", 500)),
    });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    expect(result.current.authErrorMessage).toBe("");
    expect(result.current.draftMenu).toEqual(initialMenu);
  });

  it("marks the draft dirty and stamps updatedAt on mutation", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyMenuMutation((menu) => ({
        ...menu,
        restaurant: { ...menu.restaurant, tagline: "New tagline" },
      }));
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.draftMenu.restaurant.tagline).toBe("New tagline");
    expect(result.current.draftMenu.updatedAt).not.toBe(remoteMenu.updatedAt);
  });

  it("keeps identity mutations from changing or dirtying the menu", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyMenuMutation((menu) => menu);
    });

    expect(result.current.draftMenu).toEqual(remoteMenu);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("does not dirty the draft for a command that matches nothing", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    let rejection: string | null = "unset";
    act(() => {
      rejection = result.current.applyCommand({ type: "update-item", itemId: "missing", patch: { title: "x" } });
    });

    expect(rejection).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.draftMenu).toEqual(remoteMenu);
  });

  it("keeps the draft dirty when an edit lands while a save is in flight", async () => {
    let resolveSave: (value: { etag: string | null }) => void = () => undefined;
    const api = createFakeApi({
      saveDraftMenu: vi.fn().mockImplementation(
        () =>
          new Promise<{ etag: string | null }>((resolve) => {
            resolveSave = resolve;
          }),
      ),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Edit A" } });
    });

    let savePromise: Promise<void> = Promise.resolve();
    act(() => {
      savePromise = result.current.saveDraft();
    });
    await waitFor(() => expect(api.saveDraftMenu).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Edit B" } });
    });

    await act(async () => {
      resolveSave({ etag: null });
      await savePromise;
    });

    expect((api.saveDraftMenu as ReturnType<typeof vi.fn>).mock.calls[0][0].items[0].title).toBe("Edit A");
    expect(result.current.draftMenu.items[0].title).toBe("Edit B");
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("evaluates back-to-back commands against the latest menu", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    const rejections: (string | null)[] = [];
    act(() => {
      rejections.push(result.current.applyCommand({ type: "delete-item", itemId: "item-1" }));
      // The section is empty now; the stale-closure version would still report section-has-items.
      rejections.push(result.current.applyCommand({ type: "delete-section", categoryId: "category-1" }));
    });

    expect(rejections).toEqual([null, null]);
    expect(result.current.draftMenu.items).toHaveLength(0);
    expect(result.current.draftMenu.categories).toHaveLength(0);
  });

  it("serializes overlapping saves and sends the latest draft second", async () => {
    const resolvers: ((value: { etag: string | null }) => void)[] = [];
    const api = createFakeApi({
      saveDraftMenu: vi.fn().mockImplementation(
        () =>
          new Promise<{ etag: string | null }>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "First" } });
    });
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.saveDraft();
    });
    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Second" } });
      second = result.current.saveDraft();
    });

    await waitFor(() => expect(resolvers).toHaveLength(1));
    await act(async () => {
      resolvers[0]({ etag: null });
      await first;
    });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => {
      resolvers[1]({ etag: null });
      await second;
    });

    const calls = (api.saveDraftMenu as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0].items[0].title).toBe("First");
    expect(calls[1][0].items[0].title).toBe("Second");
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("sends the loaded etag as If-Match and adopts the etag the save returns", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "One" } });
    });
    await act(async () => {
      await result.current.saveDraft();
    });
    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Two" } });
    });
    await act(async () => {
      await result.current.saveDraft();
    });

    const calls = (api.saveDraftMenu as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][1]).toEqual({ ifMatch: '"v1"' });
    expect(calls[1][1]).toEqual({ ifMatch: '"v2"' });
  });

  it("keeps the draft dirty and surfaces the conflict when the server answers 412", async () => {
    const api = createFakeApi({
      saveDraftMenu: vi.fn().mockRejectedValue(new MenuApiError("The draft was changed elsewhere. Reload the editor to get the latest version.", 412)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Mine" } });
    });
    await act(async () => {
      await result.current.saveDraft();
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.draftMenu.items[0].title).toBe("Mine");
  });

  it("stays inert when disabled", async () => {
    const api = createFakeApi();
    const { result } = renderHook(() => useAdminMenuDraft({ api, initialMenu, enabled: false }), { wrapper: KitTestWrapper });

    expect(result.current.isLoadingDraft).toBe(false);
    await act(async () => undefined);
    expect(api.getDraft).not.toHaveBeenCalled();
    expect(result.current.draftMenu).toEqual(initialMenu);
  });

  it("warns before unload only while there are unsaved changes", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    act(() => {
      result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Dirty" } });
    });

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("saves the draft and clears the dirty flag", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyMenuMutation((menu) => ({ ...menu, restaurant: { ...menu.restaurant, tagline: "Dirty" } }));
    });

    await act(async () => {
      await result.current.saveDraft();
    });

    expect(api.saveDraftMenu).toHaveBeenCalledTimes(1);
    expect((api.saveDraftMenu as ReturnType<typeof vi.fn>).mock.calls[0][0].restaurant.tagline).toBe("Dirty");
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("keeps the dirty flag when saving fails", async () => {
    const api = createFakeApi({
      saveDraftMenu: vi.fn().mockRejectedValue(new MenuApiError("You are not authorized to edit this menu.", 403)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyMenuMutation((menu) => ({ ...menu, restaurant: { ...menu.restaurant, tagline: "Dirty" } }));
    });

    await act(async () => {
      await result.current.saveDraft();
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.isSavingDraft).toBe(false);
  });

  it("saves before publishing when there are unsaved changes", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.applyMenuMutation((menu) => ({ ...menu, restaurant: { ...menu.restaurant, tagline: "Dirty" } }));
    });

    await act(async () => {
      await result.current.publishDraft();
    });

    expect(api.saveDraftMenu).toHaveBeenCalledTimes(1);
    expect(api.publishDraftMenu).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("publishes without saving when the draft is clean", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.publishDraft();
    });

    expect(api.saveDraftMenu).not.toHaveBeenCalled();
    expect(api.publishDraftMenu).toHaveBeenCalledTimes(1);
  });

  it("resets to the initial menu and marks it unsaved", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.draftMenu).toEqual(initialMenu);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("reloads the remote draft and clears auth errors on retry", async () => {
    const getDraft = vi
      .fn()
      .mockRejectedValueOnce(new MenuApiError("Expected a JSON response. The /api route is not reaching the menu Worker, or a sign-in page intercepted it.", 200))
      .mockResolvedValueOnce(remoteDraft);
    const api = createFakeApi({ getDraft });
    const { result } = renderDraft(api);

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));
    expect(result.current.authErrorMessage).not.toBe("");

    act(() => {
      result.current.loadRemoteDraft();
    });

    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));
    expect(result.current.authErrorMessage).toBe("");
    expect(result.current.draftMenu).toEqual(remoteMenu);
  });

  it("applies commands and marks the draft dirty", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    let rejection: string | null = "unset";
    act(() => {
      rejection = result.current.applyCommand({ type: "update-item", itemId: "item-1", patch: { title: "Renamed" } });
    });

    expect(rejection).toBeNull();
    expect(result.current.draftMenu.items[0].title).toBe("Renamed");
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("keeps the draft clean when a command is rejected", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    let rejection: string | null = null;
    act(() => {
      rejection = result.current.applyCommand({ type: "delete-section", categoryId: "category-1" });
    });

    expect(rejection).toBe("section-has-items");
    expect(result.current.draftMenu).toEqual(remoteMenu);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("uploads an item image and best-effort deletes the old one", async () => {
    const api = createFakeApi({
      uploadMenuImage: vi.fn().mockResolvedValue({ key: "images/menu/new.webp", url: "https://api.example.com/images/new.webp" }),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.uploadItemImage(draftItem, imageFile());
    });

    const item = result.current.draftMenu.items[0];
    expect(item.image).toBe("https://api.example.com/images/new.webp");
    expect(item.imageKey).toBe("images/menu/new.webp");
    expect(api.deleteMenuImage).toHaveBeenCalledWith(draftItem.imageKey);
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.uploadingItemIds.has(draftItem.id)).toBe(false);
  });

  it("rejects non-image files without touching the API", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.uploadItemImage(draftItem, imageFile("application/pdf"));
    });

    expect(api.uploadMenuImage).not.toHaveBeenCalled();
    expect(result.current.draftMenu.items[0]).toEqual(draftItem);
  });

  it("keeps the item unchanged when upload fails", async () => {
    const api = createFakeApi({
      uploadMenuImage: vi.fn().mockRejectedValue(new MenuApiError("Upload failed.", 500)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.uploadItemImage(draftItem, imageFile());
    });

    expect(result.current.draftMenu.items[0]).toEqual(draftItem);
    expect(api.deleteMenuImage).not.toHaveBeenCalled();
    expect(result.current.uploadingItemIds.has(draftItem.id)).toBe(false);
  });

  it("keeps the new image when old-image cleanup fails", async () => {
    const api = createFakeApi({
      uploadMenuImage: vi.fn().mockResolvedValue({ key: "images/menu/new.webp", url: "https://api.example.com/images/new.webp" }),
      deleteMenuImage: vi.fn().mockRejectedValue(new MenuApiError("Cleanup failed.", 500)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.uploadItemImage(draftItem, imageFile());
    });

    expect(result.current.draftMenu.items[0].image).toBe("https://api.example.com/images/new.webp");
  });

  it("removes an uploaded image and deletes the R2 object", async () => {
    const api = createFakeApi();
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.removeItemImage(draftItem);
    });

    const item = result.current.draftMenu.items[0];
    expect(item.image).toBe("");
    expect(item.imageKey).toBeUndefined();
    expect(api.deleteMenuImage).toHaveBeenCalledWith(draftItem.imageKey);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("still clears the item image when R2 cleanup fails", async () => {
    const api = createFakeApi({
      deleteMenuImage: vi.fn().mockRejectedValue(new MenuApiError("Cleanup failed.", 500)),
    });
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.removeItemImage(draftItem);
    });

    expect(result.current.draftMenu.items[0].image).toBe("");
    expect(result.current.uploadingItemIds.has(draftItem.id)).toBe(false);
  });

  it("clears static image paths without calling the API", async () => {
    const api = createFakeApi();
    const staticItem = { ...draftItem, imageKey: undefined, image: "assets/menu/burger.webp" };
    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    await act(async () => {
      await result.current.removeItemImage(staticItem);
    });

    expect(result.current.draftMenu.items[0].image).toBe("");
    expect(api.deleteMenuImage).not.toHaveBeenCalled();
  });

  it("redirects to the Access sign-in url", async () => {
    const api = createFakeApi();
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign, href: "http://localhost/admin" } as Location);

    const { result } = renderDraft(api);
    await waitFor(() => expect(result.current.isLoadingDraft).toBe(false));

    act(() => {
      result.current.signIn();
    });

    expect(api.getAdminSignInUrl).toHaveBeenCalledWith("http://localhost/admin");
    expect(assign).toHaveBeenCalledWith("https://api.example.com/api/admin/sign-in?returnTo=http%3A%2F%2Flocalhost%2Fadmin");
  });
});
