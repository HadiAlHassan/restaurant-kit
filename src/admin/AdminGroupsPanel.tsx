import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import * as Popover from "@radix-ui/react-popover";
import { GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import type { MenuGroup } from "../menu/menuSchema";
import { cx } from "../utils";
import { AdminMenuIconPicker } from "./AdminMenuIconPicker";
import type { SortableData } from "./adminEditorUtils";
import styles from "./AdminMenuEditor.module.css";

export type AdminGroupRow = {
  readonly group: MenuGroup;
  readonly itemCount: number;
  readonly hasSections: boolean;
};

type AdminGroupsPanelProps = {
  groups: readonly AdminGroupRow[];
  onAddGroup: () => void;
  onDeleteGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<MenuGroup>) => void;
};

export function AdminGroupsPanel({ groups, onAddGroup, onDeleteGroup, onUpdateGroup }: AdminGroupsPanelProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={styles.secondaryButton} type="button">
          <Settings2 aria-hidden="true" />
          Manage groups
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.managePanel} align="end" sideOffset={8} collisionPadding={12}>
          <p className={styles.managePanelTitle}>Menu groups · drag to reorder</p>
          <div className={styles.manageList}>
            {groups.map((row, index) => (
              <GroupRow key={row.group.id} row={row} sortableIndex={index} onDeleteGroup={onDeleteGroup} onUpdateGroup={onUpdateGroup} />
            ))}
          </div>
          <div className={styles.managePanelFoot}>
            <button className={styles.secondaryButton} type="button" onClick={onAddGroup}>
              <Plus aria-hidden="true" />
              Add group
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type GroupRowProps = {
  row: AdminGroupRow;
  sortableIndex: number;
  onDeleteGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<MenuGroup>) => void;
};

function GroupRow({ row, sortableIndex, onDeleteGroup, onUpdateGroup }: GroupRowProps) {
  const { group, hasSections, itemCount } = row;
  const { isDragging, ref } = useSortable<SortableData>({
    id: `group:${group.id}`,
    index: sortableIndex,
    group: "menu-groups",
    data: { kind: "group", id: group.id },
    modifiers: [RestrictToVerticalAxis],
    transition: { idle: true },
  });

  return (
    <div className={cx(styles.groupRow, isDragging && styles.dragging)} ref={ref}>
      <span className={styles.groupHandle} aria-hidden="true">
        <GripVertical />
      </span>
      <div onPointerDown={(event) => event.stopPropagation()}>
        <AdminMenuIconPicker label={`Choose ${group.label} icon`} value={group.icon} onChange={(icon) => onUpdateGroup(group.id, { icon })} />
      </div>
      <input
        aria-label={`${group.label} group name`}
        value={group.label}
        onChange={(event) => onUpdateGroup(group.id, { label: event.target.value })}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <span className={styles.groupCount}>
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </span>
      <button
        className={styles.groupDelete}
        type="button"
        disabled={hasSections}
        title={hasSections ? "Move or delete this group's sections first" : `Delete ${group.label}`}
        aria-label={`Delete ${group.label}`}
        onClick={() => onDeleteGroup(group.id)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}
