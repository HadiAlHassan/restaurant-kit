import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrderedMenu } from "../menu/menuOrdering";
import type { DynamicMenu } from "../menu/menuSchema";

export function useMenuBrowserState(menu: DynamicMenu) {
  const [activeGroup, setActiveGroup] = useState("all");
  const [openCategories, setOpenCategories] = useState<readonly string[]>([]);
  const [isTabsStuck, setIsTabsStuck] = useState(false);
  const manuallyClosedCategories = useRef<Set<string>>(new Set());
  const isProgrammaticScroll = useRef(false);
  const scrollLockTimeout = useRef<number | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const controlStripRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const orderedMenu = useMemo(() => getOrderedMenu(menu, { includeHidden: false, includeEmptySections: false }), [menu]);
  const visibleGroups = useMemo(() => orderedMenu.groups.map(({ group }) => group), [orderedMenu]);
  const groupLabels = useMemo(() => new Map(visibleGroups.map((group) => [group.id, group.label])), [visibleGroups]);
  const visibleCategories = useMemo(() => orderedMenu.sections.map(({ section, items }) => ({ category: section, items })), [orderedMenu.sections]);
  const initialOpenCategories = useMemo(() => visibleCategories.map(({ category }) => category.id), [visibleCategories]);
  const initialOpenCategory = initialOpenCategories[0] ?? "";

  useEffect(() => {
    setOpenCategories((currentCategories) => {
      const visibleCategoryIds = new Set(initialOpenCategories);
      const retainedCategories = currentCategories.filter((categoryId) => visibleCategoryIds.has(categoryId));
      const missingCategories = initialOpenCategories.filter((categoryId) => !retainedCategories.includes(categoryId) && !manuallyClosedCategories.current.has(categoryId));
      return [...retainedCategories, ...missingCategories];
    });
  }, [initialOpenCategories]);

  useEffect(() => {
    const activeButton = tabsRef.current?.querySelector<HTMLButtonElement>(`[data-group="${activeGroup}"]`);
    if (!activeButton || !tabsRef.current) return;

    const targetLeft = activeButton.offsetLeft - tabsRef.current.clientWidth / 2 + activeButton.clientWidth / 2;
    tabsRef.current.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [activeGroup]);

  const openCategory = useCallback((categorySlug: string, options: { readonly force?: boolean } = {}) => {
    if (!categorySlug) return;
    if (options.force) manuallyClosedCategories.current.delete(categorySlug);
    else if (manuallyClosedCategories.current.has(categorySlug)) return;

    setOpenCategories((currentCategories) => (currentCategories.includes(categorySlug) ? currentCategories : [...currentCategories, categorySlug]));
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setOpenCategories((currentCategories) => {
      if (currentCategories.includes(categoryId)) {
        manuallyClosedCategories.current.add(categoryId);
        return currentCategories.filter((currentCategoryId) => currentCategoryId !== categoryId);
      }

      manuallyClosedCategories.current.delete(categoryId);
      return [...currentCategories, categoryId];
    });
  }, []);

  const updateActiveGroupFromScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;

    const blocks = Array.from(catalogRef.current?.querySelectorAll<HTMLElement>("[data-menu-category-block]") ?? []);
    if (!blocks.length) return;

    const controlRect = controlStripRef.current?.getBoundingClientRect();
    const targetLine = (controlRect?.bottom ?? 0) + 56;
    let activeBlock = blocks[0];

    if (blocks[0].getBoundingClientRect().top > targetLine) {
      setActiveGroup("all");
      return;
    }

    for (const block of blocks) {
      if (block.getBoundingClientRect().top <= targetLine) activeBlock = block;
    }

    setActiveGroup(activeBlock.dataset.menuGroup ?? "all");
    openCategory(activeBlock.dataset.menuCategory ?? initialOpenCategory);
  }, [initialOpenCategory, openCategory]);

  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.matchMedia("(max-width: 980px)").matches;
      setIsTabsStuck(Boolean(isMobile && controlStripRef.current && controlStripRef.current.getBoundingClientRect().top <= 0));
      updateActiveGroupFromScroll();
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (scrollLockTimeout.current) window.clearTimeout(scrollLockTimeout.current);
    };
  }, [updateActiveGroupFromScroll]);

  const handleGroupClick = useCallback(
    (groupId: string) => {
      const target = groupId === "all" ? document.querySelector("#menu") : catalogRef.current?.querySelector<HTMLElement>(`[data-menu-group="${groupId}"]`);
      if (!target) return;

      if (scrollLockTimeout.current) window.clearTimeout(scrollLockTimeout.current);

      isProgrammaticScroll.current = true;
      setActiveGroup(groupId);
      openCategory(target instanceof HTMLElement && target.dataset.menuCategory ? target.dataset.menuCategory : initialOpenCategory, { force: true });
      const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop || "0");
      const targetTop = target.getBoundingClientRect().top + window.scrollY - (Number.isFinite(scrollMargin) ? scrollMargin : 0);
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });

      const scrollStartedAt = window.performance.now();
      const unlockWhenSettled = () => {
        const targetTop = target.getBoundingClientRect().top;
        const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop || "0");
        const expectedTop = Number.isFinite(scrollMargin) ? scrollMargin : 0;
        const timedOut = window.performance.now() - scrollStartedAt > 1800;
        const isSettled = Math.abs(targetTop - expectedTop) < 4 || window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 || timedOut;

        if (!isSettled) {
          scrollLockTimeout.current = window.setTimeout(unlockWhenSettled, 80);
          return;
        }

        isProgrammaticScroll.current = false;
        scrollLockTimeout.current = null;
        updateActiveGroupFromScroll();
      };

      scrollLockTimeout.current = window.setTimeout(unlockWhenSettled, 120);
    },
    [initialOpenCategory, openCategory, updateActiveGroupFromScroll],
  );

  return {
    activeGroup,
    catalogRef,
    controlStripRef,
    groupLabels,
    handleGroupClick,
    isTabsStuck,
    openCategories,
    tabsRef,
    toggleCategory,
    visibleCategories,
    visibleGroups,
  };
}
