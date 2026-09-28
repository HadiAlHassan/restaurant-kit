import { menuIconFor } from "../menu/menuIcons";
import type { DynamicMenu } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./MenuBrowser.module.css";
import { MenuCategoryBlock } from "./MenuCategoryBlock";
import { useMenuBrowserState } from "./useMenuBrowserState";

type MenuBrowserProps = {
  menu: DynamicMenu;
};

export function MenuBrowser({ menu }: MenuBrowserProps) {
  const { activeGroup, catalogRef, controlStripRef, groupLabels, handleGroupClick, isTabsStuck, openCategories, tabsRef, toggleCategory, visibleCategories, visibleGroups } =
    useMenuBrowserState(menu);

  return (
    <section className={`section ${styles.section}`} id="menu" aria-labelledby="menu-title">
      <div className="section-inner">
        <div className={styles.topline}>
          <div>
            <p className="micro-label">Full menu</p>
            <h2 id="menu-title">Choose your craving.</h2>
          </div>
        </div>

        <div className={styles.browser}>
          <div className={cx(styles.controlStrip, isTabsStuck && styles.stuckControlStrip)} ref={controlStripRef}>
            <div className={styles.tabs} role="tablist" aria-label="Menu cravings" ref={tabsRef}>
              {visibleGroups.map((group) => {
                const Icon = menuIconFor(group.icon);
                const isActive = group.id === activeGroup;

                return (
                  <button
                    className={cx(styles.tab, isActive && styles.activeTab)}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-group={group.id}
                    key={group.id}
                    onClick={() => handleGroupClick(group.id)}
                  >
                    <span className={styles.tabIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    <span className={styles.tabLabel}>{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.catalog} ref={catalogRef}>
            {visibleCategories.length ? (
              visibleCategories.map(({ category, items }) => (
                <MenuCategoryBlock
                  category={category}
                  groupId={category.groupId}
                  groupLabel={groupLabels.get(category.groupId) ?? category.groupId}
                  isOpen={openCategories.includes(category.id)}
                  items={items}
                  key={category.id}
                  onToggle={() => toggleCategory(category.id)}
                />
              ))
            ) : (
              <div className={styles.empty}>
                <h3>No menu items.</h3>
                <p>Check back soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
