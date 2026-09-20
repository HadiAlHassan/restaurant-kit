import { ChevronDown } from "lucide-react";
import type { MenuCategory, MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./MenuBrowser.module.css";
import { MenuCard } from "./MenuCard";
import { MenuItemSheet } from "./MenuItemSheet";
import { MenuRow } from "./MenuRow";
import { useMediaQuery } from "./useMediaQuery";
import { useParkedSheet } from "./useParkedSheet";

type MenuCategoryBlockProps = {
  category: MenuCategory;
  groupId: string;
  groupLabel: string;
  isOpen: boolean;
  items: readonly MenuItem[];
  onToggle: () => void;
};

export function MenuCategoryBlock({ category, groupId, groupLabel, isOpen, items, onToggle }: MenuCategoryBlockProps) {
  const isCompact = useMediaQuery("(max-width: 560px)");
  const { value: sheetItem, open: openSheet, close: closeSheet } = useParkedSheet<MenuItem>();

  return (
    <section
      className={cx(styles.categoryBlock, isOpen && styles.openCategory)}
      aria-labelledby={`menu-category-${category.id}`}
      data-menu-category-block
      data-menu-category={category.id}
      data-menu-group={groupId}
    >
      <button className={styles.categoryHeading} type="button" aria-expanded={isOpen} onClick={onToggle}>
        <div>
          <p>{groupLabel}</p>
          <h3 id={`menu-category-${category.id}`}>{category.title}</h3>
        </div>
        <span className={styles.toggleMeta}>
          <span className={styles.itemCount}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          <ChevronDown aria-hidden="true" className={styles.chevron} />
        </span>
      </button>
      <div className={styles.categoryContent}>
        <div className={isCompact ? styles.rowList : styles.grid}>
          {items.map((item) =>
            isCompact ? <MenuRow item={item} key={item.id} onOpen={() => openSheet(item)} /> : <MenuCard item={item} key={item.id} onOpen={() => openSheet(item)} />,
          )}
        </div>
      </div>
      {sheetItem ? <MenuItemSheet item={sheetItem} onClose={closeSheet} /> : null}
    </section>
  );
}
