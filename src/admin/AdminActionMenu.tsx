import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../utils";
import styles from "./AdminMenuEditor.module.css";

type AdminActionMenuProps = {
  children: ReactNode;
  label: string;
};

export function AdminActionMenu({ children, label }: AdminActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={styles.kebabButton} type="button" aria-label={label}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menuContent} align="end" sideOffset={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type AdminActionItemProps = {
  children: ReactNode;
  disabled?: boolean;
  isDanger?: boolean;
  onSelect: () => void;
};

export function AdminActionItem({ children, disabled, isDanger, onSelect }: AdminActionItemProps) {
  return (
    <DropdownMenu.Item className={cx(styles.menuItem, isDanger && styles.menuItemDanger)} disabled={disabled} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}

export function AdminActionSeparator() {
  return <DropdownMenu.Separator className={styles.menuSeparator} />;
}

type AdminActionSubMenuProps = {
  children: ReactNode;
  label: ReactNode;
};

export function AdminActionSubMenu({ children, label }: AdminActionSubMenuProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={styles.menuItem}>{label}</DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className={styles.menuContent} sideOffset={6}>
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
