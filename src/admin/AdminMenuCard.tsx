import { useSortable } from "@dnd-kit/react/sortable";
import { EyeOff, Loader2, Pencil } from "lucide-react";
import { sortByOrder } from "../menu/menuOrdering";
import type { MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import { formatPrice, imageSource, type SortableData } from "./adminEditorUtils";
import styles from "./AdminMenuEditor.module.css";

type AdminMenuCardProps = {
  index: number;
  isReordering: boolean;
  isUploadingImage: boolean;
  item: MenuItem;
  onEdit: () => void;
};

export function AdminMenuCard({ index, isReordering, isUploadingImage, item, onEdit }: AdminMenuCardProps) {
  const hasImage = Boolean(item.image);
  const sizes = sortByOrder(item.sizes);
  const hasMultiplePrices = item.pricingMode === "sizes" && sizes.length > 0;
  const { isDragging, ref } = useSortable<SortableData>({
    id: `item:${item.id}`,
    index,
    group: `category:${item.categoryId}`,
    data: { kind: "item", id: item.id, categoryId: item.categoryId },
    disabled: !isReordering,
    transition: { idle: true },
  });

  return (
    <article
      className={cx(styles.card, !hasImage && styles.noImageCard, isReordering && styles.reorderableCard, isDragging && styles.dragging, isDragging && styles.cardDragging)}
      ref={ref}
      tabIndex={isReordering ? -1 : 0}
      role="button"
      aria-label={`Edit ${item.title}`}
      onClick={() => {
        if (!isReordering) onEdit();
      }}
      onKeyDown={(event) => {
        if (isReordering) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      {!item.isVisible ? (
        <span className={cx(styles.cardBadge, styles.hiddenBadge)}>
          <EyeOff aria-hidden="true" />
          Hidden
        </span>
      ) : null}
      {isUploadingImage ? (
        <span className={styles.cardBadge}>
          <Loader2 aria-hidden="true" className={styles.badgeSpinner} />
          Uploading
        </span>
      ) : null}
      {hasImage ? (
        <figure className={styles.media}>
          <img src={imageSource(item.image)} alt="" />
        </figure>
      ) : null}
      <div className={styles.cardBody}>
        <header>
          <h3>{item.title}</h3>
          {!hasMultiplePrices ? <span className={styles.cardPrice}>{formatPrice(item.price) || "M.P."}</span> : null}
        </header>
        {item.description ? <p>{item.description}</p> : null}
        {hasMultiplePrices ? (
          <div className={styles.variationTabs} aria-label={`${item.title} prices`}>
            {sizes.map((size) => (
              <div className={styles.variationTab} key={size.id}>
                <span>{size.label}</span>
                <strong>{formatPrice(size.price)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {!isReordering ? (
        <span className={styles.cardVeil} aria-hidden="true">
          <span className={styles.editChip}>
            <Pencil aria-hidden="true" />
            Edit item
          </span>
        </span>
      ) : null}
    </article>
  );
}
