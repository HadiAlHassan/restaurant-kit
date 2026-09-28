import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { menuIconFor, menuIconOptions, menuIcons } from "../menu/menuIcons";
import type { MenuIcon } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./AdminMenuEditor.module.css";

type AdminMenuIconPickerProps = {
  readonly label: string;
  readonly value: MenuIcon;
  readonly onChange: (icon: MenuIcon) => void;
};

export function AdminMenuIconPicker({ label, value, onChange }: AdminMenuIconPickerProps) {
  const CurrentIcon = menuIconFor(value);
  const currentLabel = menuIconOptions.find((option) => option.id === value)?.label ?? value;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={styles.iconPickerTrigger} type="button" aria-label={label}>
          <CurrentIcon aria-hidden="true" />
          <span>{currentLabel}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.iconPickerPanel} align="start" sideOffset={8} collisionPadding={12}>
          <p className={styles.iconPickerTitle}>Choose icon</p>
          <div className={styles.iconPickerGrid}>
            {menuIconOptions.map((option) => {
              const Icon = menuIcons[option.id];
              const isSelected = option.id === value;

              return (
                <button
                  className={cx(styles.iconPickerOption, isSelected && styles.selectedIconPickerOption)}
                  type="button"
                  aria-pressed={isSelected}
                  key={option.id}
                  onClick={() => onChange(option.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
