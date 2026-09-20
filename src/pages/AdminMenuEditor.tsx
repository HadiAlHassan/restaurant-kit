import { move } from "@dnd-kit/helpers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { LogOut, Plus, RotateCcw, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AdminActionItem, AdminActionMenu } from "../admin/AdminActionMenu";
import { AdminAuthPanel } from "../admin/AdminAuthPanel";
import { AdminGroupsPanel } from "../admin/AdminGroupsPanel";
import { AdminItemDrawer } from "../admin/AdminItemDrawer";
import { AdminMenuGroupTabs } from "../admin/AdminMenuGroupTabs";
import { AdminSectionEditor } from "../admin/AdminSectionEditor";
import { emptyItem, sortableDataFromEntity, type SortableEntity } from "../admin/adminEditorUtils";
import { createMenuCategoryDraft, createMenuGroupDraft, createMenuSizeDraft } from "../admin/adminMenuCommands";
import { useAdminDraft } from "../admin/useAdminDraft";
import { getOrderedMenu, sortByOrder } from "../menu/menuOrdering";
import type { MenuCategory, MenuGroup, MenuItem, MenuSize } from "../menu/menuSchema";
import styles from "../admin/AdminMenuEditor.module.css";

export function AdminMenuEditor() {
  const {
    draftMenu,
    hasUnsavedChanges,
    isLoadingDraft,
    isSavingDraft,
    isPublishingDraft,
    isBusy,
    authErrorMessage,
    authSession,
    isSigningIn,
    loadRemoteDraft,
    signIn: openAccessSignIn,
    signInWithPassword,
    signOut,
    saveDraft,
    publishDraft,
    resetDraft: resetDraftMenu,
    applyCommand,
    uploadingItemIds,
    uploadItemImage,
    removeItemImage,
  } = useAdminDraft();
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [editingItemId, setEditingItemId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [reorderingSectionId, setReorderingSectionId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const orderedMenu = useMemo(() => getOrderedMenu(draftMenu), [draftMenu]);
  const visibleGroups = useMemo(() => orderedMenu.groups.map(({ group }) => group), [orderedMenu]);
  const categories = useMemo(() => orderedMenu.sections.map(({ section }) => section), [orderedMenu.sections]);
  const orderedItemsByCategory = useMemo(() => new Map(orderedMenu.sections.map(({ section, items }) => [section.id, items])), [orderedMenu.sections]);
  const visibleCategories = useMemo(
    () => categories.filter((category) => activeGroupId === "all" || category.groupId === activeGroupId),
    [activeGroupId, categories],
  );
  const groupLabelMap = useMemo(() => new Map(visibleGroups.map((group) => [group.id, group.label])), [visibleGroups]);
  const editingItem = draftMenu.items.find((item) => item.id === editingItemId) ?? null;
  const canSignOut = authSession?.strategy === "password" && authSession.authenticated;
  const manageableGroups = useMemo(() => {
    const itemCountByCategory = new Map<string, number>();
    for (const item of draftMenu.items) {
      itemCountByCategory.set(item.categoryId, (itemCountByCategory.get(item.categoryId) ?? 0) + 1);
    }

    return visibleGroups
      .filter((group) => group.id !== "all")
      .map((group) => {
        const groupCategories = draftMenu.categories.filter((category) => category.groupId === group.id);

        return {
          group,
          hasSections: groupCategories.length > 0,
          itemCount: groupCategories.reduce((count, category) => count + (itemCountByCategory.get(category.id) ?? 0), 0),
        };
      });
  }, [draftMenu.categories, draftMenu.items, visibleGroups]);

  useEffect(() => {
    if (visibleCategories.length && !visibleCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(visibleCategories[0].id);
    }
  }, [selectedCategoryId, visibleCategories]);

  const updateGroup = (groupId: string, patch: Partial<MenuGroup>) => {
    applyCommand({ type: "update-group", groupId, patch });
  };

  const addGroup = () => {
    const group = createMenuGroupDraft(draftMenu);

    applyCommand({ type: "add-group", group });
    setActiveGroupId(group.id);
    toast.success("Menu group added");
  };

  const deleteGroup = (groupId: string) => {
    const group = draftMenu.groups.find((menuGroup) => menuGroup.id === groupId);
    if (groupId === "all" || !group) return;
    if (draftMenu.categories.some((category) => category.groupId === groupId)) {
      toast.error("Move or delete this group's sections first", {
        description: "A menu group cannot be deleted while sections still belong to it.",
      });
      return;
    }
    if (!window.confirm(`Delete the "${group.label}" group?`)) return;

    const rejection = applyCommand({ type: "delete-group", groupId });

    if (rejection === "pinned-group") return;

    if (rejection === "group-has-sections") {
      toast.error("Move or delete this group's sections first", {
        description: "A menu group cannot be deleted while sections still belong to it.",
      });
      return;
    }

    setActiveGroupId("all");
    setEditingGroupId("");
    toast.success(`${group?.label ?? "Menu group"} deleted`);
  };

  const updateCategory = (categoryId: string, patch: Partial<MenuCategory>) => {
    applyCommand({ type: "update-section", categoryId, patch });
  };

  const moveSection = (categoryId: string, direction: -1 | 1) => {
    applyCommand({ type: "move-section", categoryId, direction });
    setActiveGroupId("all");
  };

  const addSection = () => {
    const targetGroupId = activeGroupId === "all" ? visibleGroups.find((group) => group.id !== "all")?.id : activeGroupId;
    if (!targetGroupId) {
      toast.error("Add a menu group first", {
        description: "Sections live inside a menu group. Use Manage groups to create one.",
      });
      return;
    }

    const category = createMenuCategoryDraft(draftMenu, targetGroupId);

    applyCommand({ type: "add-section", category });
    setActiveGroupId(targetGroupId);
    setSelectedCategoryId(category.id);
    toast.success("Section added");
  };

  const deleteCategory = (categoryId: string) => {
    const category = draftMenu.categories.find((menuCategory) => menuCategory.id === categoryId);
    if (!category) return;
    if (draftMenu.items.some((item) => item.categoryId === categoryId)) {
      toast.error("Delete or move this section's items first", {
        description: "A section cannot be deleted while menu items still belong to it.",
      });
      return;
    }
    if (!window.confirm(`Delete the "${category.title}" section?`)) return;

    const rejection = applyCommand({ type: "delete-section", categoryId });
    if (rejection) return;

    setReorderingSectionId((currentSectionId) => (currentSectionId === categoryId ? "" : currentSectionId));
    toast.success("Section deleted");
  };

  const addItem = (categoryId: string) => {
    const item = emptyItem(categoryId);

    applyCommand({ type: "add-item", item });
    setEditingItemId(item.id);
    toast.success("Item added");
  };

  const updateItem = (itemId: string, patch: Partial<MenuItem>) => {
    applyCommand({ type: "update-item", itemId, patch });
  };

  const deleteItem = (itemId: string) => {
    const item = draftMenu.items.find((menuItem) => menuItem.id === itemId);
    if (!item) return;
    if (!window.confirm(`Delete "${item.title}"?`)) return;

    applyCommand({ type: "delete-item", itemId });
    setEditingItemId("");
    toast.success("Item deleted");
  };

  const updateSize = (item: MenuItem, sizeId: string, patch: Partial<MenuSize>) => {
    applyCommand({ type: "update-size", itemId: item.id, sizeId, patch });
  };

  const addSize = (item: MenuItem) => {
    applyCommand({ type: "add-size", itemId: item.id, size: createMenuSizeDraft(item) });
  };

  const removeSize = (item: MenuItem, sizeId: string) => {
    applyCommand({ type: "delete-size", itemId: item.id, sizeId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return;

    const sourceEntity = event.operation.source as SortableEntity;
    const targetEntity = event.operation.target as SortableEntity;
    const sourceData = sortableDataFromEntity(sourceEntity);
    const targetData = sortableDataFromEntity(targetEntity);
    if (!sourceData || !targetData || sourceData.kind !== targetData.kind) return;

    if (sourceData.kind === "group" && targetData.kind === "group" && sourceData.id !== "all" && targetData.id !== "all") {
      const sortableGroupIds = manageableGroups.map(({ group }) => `group:${group.id}`);
      const orderedGroupIds = move(sortableGroupIds, event).map((sortableGroupId) => String(sortableGroupId).replace("group:", ""));

      applyCommand({ type: "reorder-groups", orderedGroupIds });
      setActiveGroupId("all");
      return;
    }

    if (sourceData.kind === "item" && targetData.kind === "item") {
      applyCommand({ type: "move-item-before", sourceItemId: sourceData.id, targetItemId: targetData.id });
    }
  };

  const resetDraft = () => {
    resetDraftMenu();
    setActiveGroupId("all");
    setEditingItemId("");
    setEditingGroupId("");
    setReorderingSectionId("");
  };

  const toggleReorderSection = (categoryId: string) => {
    setReorderingSectionId((currentSectionId) => (currentSectionId === categoryId ? "" : categoryId));
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="micro-label">Owner dashboard</p>
            <h1>Menu editor</h1>
            <span className={styles.syncStatus}>{isLoadingDraft ? "Loading remote draft" : hasUnsavedChanges ? "Unsaved changes" : "Remote draft synced"}</span>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} to="/admin/preview">
              Preview
            </Link>
            <button className={styles.secondaryButton} type="button" onClick={saveDraft} disabled={isBusy}>
              <Save aria-hidden="true" />
              {isSavingDraft ? "Saving" : hasUnsavedChanges ? "Save draft" : "Saved draft"}
            </button>
            <button className={styles.primaryButton} type="button" onClick={publishDraft} disabled={isBusy}>
              <Send aria-hidden="true" />
              {isPublishingDraft ? "Publishing" : "Publish"}
            </button>
            <AdminActionMenu label="More editor actions">
              {canSignOut ? (
                <AdminActionItem onSelect={() => void signOut()}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </AdminActionItem>
              ) : null}
              <AdminActionItem
                isDanger
                onSelect={() => {
                  if (window.confirm("Reset the local draft to the bundled seed menu? Your remote draft is untouched until you save.")) resetDraft();
                }}
              >
                <RotateCcw aria-hidden="true" />
                Reset draft to seed
              </AdminActionItem>
            </AdminActionMenu>
          </div>
        </header>

        {authErrorMessage ? (
          <AdminAuthPanel
            isLoadingDraft={isLoadingDraft}
            isSigningIn={isSigningIn}
            message={authErrorMessage}
            strategy={authSession?.strategy ?? null}
            onRetry={loadRemoteDraft}
            onSignInWithAccess={openAccessSignIn}
            onSignInWithPassword={(password) => void signInWithPassword(password)}
          />
        ) : null}

        <section className={styles.menuEditor} aria-label="Editable menu">
          <div className={styles.controlStrip}>
            <div className={styles.tabToolbar}>
              <span>Select a menu group. Double-click a tab to rename it.</span>
              <div className={styles.toolbarButtons}>
                <AdminGroupsPanel groups={manageableGroups} onAddGroup={addGroup} onDeleteGroup={deleteGroup} onUpdateGroup={updateGroup} />
              </div>
            </div>
            <AdminMenuGroupTabs
              activeGroupId={activeGroupId}
              editingGroupId={editingGroupId}
              groups={visibleGroups}
              onSelectGroup={setActiveGroupId}
              onSetEditingGroupId={setEditingGroupId}
              onUpdateGroup={updateGroup}
            />
          </div>

          <div className={styles.catalog}>
            <div className={styles.catalogActions}>
              <div>
                <p className="micro-label">Live menu layout</p>
                <h2>{activeGroupId === "all" ? "All menu sections" : groupLabelMap.get(activeGroupId)}</h2>
              </div>
              <div className={styles.catalogButtons}>
                <button className={styles.primaryButton} type="button" onClick={addSection}>
                  <Plus aria-hidden="true" />
                  Add section
                </button>
              </div>
            </div>

            {visibleCategories.length ? (
              visibleCategories.map((category) => {
                const siblingCategories = sortByOrder(draftMenu.categories.filter((nextCategory) => nextCategory.groupId === category.groupId));
                const siblingIndex = siblingCategories.findIndex((nextCategory) => nextCategory.id === category.id);

                return (
                  <AdminSectionEditor
                    category={category}
                    groupLabel={groupLabelMap.get(category.groupId) ?? category.groupId}
                    groups={visibleGroups}
                    isFirstSection={siblingIndex <= 0}
                    isLastSection={siblingIndex === siblingCategories.length - 1}
                    isReordering={reorderingSectionId === category.id}
                    items={orderedItemsByCategory.get(category.id) ?? []}
                    key={category.id}
                    uploadingItemIds={uploadingItemIds}
                    onAddItem={() => addItem(category.id)}
                    onDeleteSection={() => deleteCategory(category.id)}
                    onEditItemDetails={setEditingItemId}
                    onFocusSection={() => setSelectedCategoryId(category.id)}
                    onMoveSection={(direction) => moveSection(category.id, direction)}
                    onToggleReorderItems={() => toggleReorderSection(category.id)}
                    onUpdateCategory={(patch) => updateCategory(category.id, patch)}
                  />
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <h2>No sections here yet.</h2>
                <button className={styles.primaryButton} type="button" onClick={addSection}>
                  Add section
                </button>
              </div>
            )}
          </div>
        </section>

        {editingItem ? (
          <AdminItemDrawer
            isUploadingImage={uploadingItemIds.has(editingItem.id)}
            item={editingItem}
            onAddSize={() => addSize(editingItem)}
            onClose={() => setEditingItemId("")}
            onDelete={() => deleteItem(editingItem.id)}
            onRemoveImage={() => void removeItemImage(editingItem)}
            onRemoveSize={(sizeId) => removeSize(editingItem, sizeId)}
            onUpdate={(patch) => updateItem(editingItem.id, patch)}
            onUpdateSize={(sizeId, patch) => updateSize(editingItem, sizeId, patch)}
            onUploadImage={(file) => void uploadItemImage(editingItem, file)}
          />
        ) : null}
      </main>
    </DragDropProvider>
  );
}
