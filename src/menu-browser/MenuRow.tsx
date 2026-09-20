import { Plus } from "lucide-react";
import { useCart } from "../cart/useCart";
import { useOrdering } from "../config/useOrdering";
import type { MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./MenuBrowser.module.css";
import { formatPrice, imageSrc, sortedSizes, variationLabel } from "./menuItemDisplay";

type MenuRowProps = {
  item: MenuItem;
  onOpen: () => void;
};

export function MenuRow({ item, onOpen }: MenuRowProps) {
  const hasImage = Boolean(item.image);
  const sizes = sortedSizes(item);
  const defaultSize = sizes[0];
  const price = defaultSize?.price ?? item.price;
  const { addItem, items } = useCart();
  const { cartEnabled } = useOrdering();
  const quantity = items.filter((line) => line.itemId === item.id).reduce((count, line) => count + line.quantity, 0);

  return (
    <article className={styles.row}>
      <button className={styles.rowMain} type="button" onClick={onOpen}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{item.title}</span>
          {item.description ? <span className={styles.rowDesc}>{item.description}</span> : null}
          <span className={styles.rowPrice}>
            {formatPrice(price) || "M.P."}
            {sizes.length > 1 ? <span className={styles.rowSizeHint}> · {sizes.map(variationLabel).join(" / ")}</span> : null}
          </span>
        </span>
      </button>
      {hasImage || cartEnabled ? (
        <div className={styles.rowMediaCell}>
          {hasImage ? (
            <button className={styles.rowThumb} type="button" onClick={onOpen} tabIndex={-1} aria-label={`View ${item.title}`}>
              <img src={imageSrc(item.image)} alt="" loading="lazy" />
            </button>
          ) : null}
          {cartEnabled ? (
            <button
              className={cx(styles.rowAdd, !hasImage && styles.rowAddInline)}
              type="button"
              onClick={() => addItem({ itemId: item.id, itemName: item.title, variationId: defaultSize?.id, variationName: defaultSize?.label })}
              aria-label={`Add ${item.title} to cart`}
            >
              <Plus aria-hidden="true" />
              {quantity ? <span className={styles.rowQty}>{quantity}</span> : null}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
