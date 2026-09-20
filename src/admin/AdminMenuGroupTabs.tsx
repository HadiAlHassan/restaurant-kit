import { menuIcons } from "../menu/menuIcons";
import type { MenuGroup } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./AdminMenuEditor.module.css";

type AdminMenuGroupTabsProps = {
  activeGroupId: string;
  editingGroupId: string;
  groups: readonly MenuGroup[];
  onSelectGroup: (groupId: string) => void;
  onSetEditingGroupId: (groupId: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<MenuGroup>) => void;
};

export function AdminMenuGroupTabs({ activeGroupId, editingGroupId, groups, onSelectGroup, onSetEditingGroupId, onUpdateGroup }: AdminMenuGroupTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Menu groups">
      {groups.map((group) => {
        const Icon = menuIcons[group.icon];
        const isActive = group.id === activeGroupId;
        const isPinned = group.id === "all";
        const isEditing = editingGroupId === group.id;

        if (isEditing) {
          return (
            <div className={cx(styles.tab, styles.editingTab, isActive && styles.activeTab)} key={group.id} role="tab" aria-selected={isActive}>
              <Icon aria-hidden="true" className={styles.tabGlyph} />
              <input
                aria-label={`${group.label} tab label`}
                autoFocus
                value={group.label}
                onChange={(event) => onUpdateGroup(group.id, { label: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") onSetEditingGroupId("");
                }}
              />
            </div>
          );
        }

        return (
          <div className={cx(styles.tab, isActive && styles.activeTab)} key={group.id} role="tab" aria-selected={isActive}>
            <button
              className={styles.tabMain}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              onDoubleClick={() => {
                if (!isPinned) onSetEditingGroupId(group.id);
              }}
              aria-label={`Show ${group.label}`}
              title={isPinned ? undefined : "Double-click to rename"}
            >
              <Icon aria-hidden="true" className={styles.tabGlyph} />
              <span>{group.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
