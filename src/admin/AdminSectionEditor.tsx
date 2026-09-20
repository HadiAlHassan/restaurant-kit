import { ArrowDown, ArrowRightLeft, ArrowUp, Check, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { MenuCategory, MenuGroup, MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import { AdminActionItem, AdminActionMenu, AdminActionSeparator, AdminActionSubMenu } from "./AdminActionMenu";
import { AdminMenuCard } from "./AdminMenuCard";
import styles from "./AdminMenuEditor.module.css";

type AdminSectionEditorProps = {
  category: MenuCategory;
  groupLabel: string;
  groups: readonly MenuGroup[];
  isFirstSection: boolean;
  isLastSection: boolean;
  isReordering: boolean;
  items: readonly MenuItem[];
  uploadingItemIds: ReadonlySet<string>;
  onAddItem: () => void;
  onDeleteSection: () => void;
  onEditItemDetails: (itemId: string) => void;
  onFocusSection: () => void;
  onMoveSection: (direction: -1 | 1) => void;
  onToggleReorderItems: () => void;
  onUpdateCategory: (patch: Partial<MenuCategory>) => void;
};

export function AdminSectionEditor({
  category,
  groupLabel,
  groups,
  isFirstSection,
  isLastSection,
  isReordering,
  items,
  uploadingItemIds,
  onAddItem,
  onDeleteSection,
  onEditItemDetails,
  onFocusSection,
  onMoveSection,
  onToggleReorderItems,
  onUpdateCategory,
}: AdminSectionEditorProps) {
  return (
    <section className={styles.categoryBlock}>
      <div className={styles.categoryHeading}>
        <div>
          <p>{groupLabel}</p>
          <input
            aria-label={`${category.title} section title`}
            value={category.title}
            onChange={(event) => onUpdateCategory({ title: event.target.value })}
            onFocus={onFocusSection}
          />
          {!category.isVisible ? (
            <span className={styles.sectionHiddenTag}>
              <EyeOff aria-hidden="true" />
              Hidden from public menu
            </span>
          ) : null}
        </div>
        <div className={styles.categoryTools}>
          {isReordering ? (
            <button className={styles.activeModeButton} type="button" onClick={onToggleReorderItems}>
              <Check aria-hidden="true" />
              Done reordering
            </button>
          ) : (
            <button type="button" onClick={onAddItem}>
              <Plus aria-hidden="true" />
              Add item
            </button>
          )}
          <AdminActionMenu label={`${category.title} section actions`}>
            <AdminActionItem disabled={isFirstSection} onSelect={() => onMoveSection(-1)}>
              <ArrowUp aria-hidden="true" />
              Move section up
            </AdminActionItem>
            <AdminActionItem disabled={isLastSection} onSelect={() => onMoveSection(1)}>
              <ArrowDown aria-hidden="true" />
              Move section down
            </AdminActionItem>
            <AdminActionItem disabled={items.length < 2} onSelect={onToggleReorderItems}>
              <GripVertical aria-hidden="true" />
              Reorder items
            </AdminActionItem>
            <AdminActionSeparator />
            <AdminActionItem onSelect={() => onUpdateCategory({ isVisible: !category.isVisible })}>
              {category.isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {category.isVisible ? "Hide from public menu" : "Show on public menu"}
            </AdminActionItem>
            <AdminActionSubMenu
              label={
                <>
                  <ArrowRightLeft aria-hidden="true" />
                  Move to group
                </>
              }
            >
              {groups
                .filter((group) => group.id !== "all")
                .map((group) => (
                  <AdminActionItem key={group.id} disabled={group.id === category.groupId} onSelect={() => onUpdateCategory({ groupId: group.id })}>
                    {group.label}
                    {group.id === category.groupId ? <Check aria-hidden="true" /> : null}
                  </AdminActionItem>
                ))}
            </AdminActionSubMenu>
            <AdminActionSeparator />
            <AdminActionItem isDanger onSelect={onDeleteSection}>
              <Trash2 aria-hidden="true" />
              Delete section
            </AdminActionItem>
          </AdminActionMenu>
        </div>
      </div>

      <div className={cx(styles.grid, isReordering && styles.reorderingGrid)}>
        {items.map((item, index) => (
          <AdminMenuCard
            index={index}
            isReordering={isReordering}
            item={item}
            key={item.id}
            isUploadingImage={uploadingItemIds.has(item.id)}
            onEdit={() => onEditItemDetails(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
