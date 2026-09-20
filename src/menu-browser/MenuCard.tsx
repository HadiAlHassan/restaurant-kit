import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { cartSelectionKey } from "../cart/cartOrder";
import type { CartSelection } from "../cart/cartTypes";
import { useCart } from "../cart/useCart";
import type { MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./MenuBrowser.module.css";
import { formatPrice, imageSrc, sortedSizes, variationLabel } from "./menuItemDisplay";

type MenuCardProps = {
  item: MenuItem;
  onOpen?: () => void;
};

export function MenuCard({ item, onOpen }: MenuCardProps) {
  const hasImage = Boolean(item.image);
  const sizes = sortedSizes(item);
  const [selectedSizeId, setSelectedSizeId] = useState(sizes[0]?.id ?? "");
  const selectedSize = sizes.find((size) => size.id === selectedSizeId) ?? sizes[0];
  const price = selectedSize?.price ?? item.price;
  const hasMultiplePrices = sizes.length > 1;
  const { addItem, decreaseItem, getQuantity } = useCart();
  const cartSelection: CartSelection = {
    itemId: item.id,
    itemName: item.title,
    variationId: selectedSize?.id,
    variationName: selectedSize?.label,
  };
  const cartKey = cartSelectionKey(cartSelection);
  const quantity = getQuantity(cartSelection);

  const stopCardOpen = (event: MouseEvent) => event.stopPropagation();

  return (
    <article
      className={cx(styles.card, !hasImage && styles.noImageCard, onOpen && styles.clickableCard)}
      {...(onOpen
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": `Customize ${item.title}`,
            onClick: onOpen,
            onKeyDown: (event: KeyboardEvent) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
    >
      {hasImage ? (
        <div className={styles.media}>
          <img src={imageSrc(item.image)} alt={item.title} loading="lazy" />
          {onOpen ? (
            <span className={styles.customizeHint} aria-hidden="true">
              <span className={styles.customizeHintChip}>
                <SlidersHorizontal />
                Customize
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={styles.cardBody}>
        <header>
          <h3>{item.title}</h3>
          {!hasMultiplePrices ? <span className={styles.price}>{formatPrice(price) || "M.P."}</span> : null}
        </header>
        {item.description ? <p>{item.description}</p> : null}
        {hasMultiplePrices ? (
          <div className={styles.variationTabs} aria-label={`${item.title} size`}>
            {sizes.map((size) => {
              const isSelected = size.id === selectedSizeId;

              return (
                <button
                  className={cx(styles.variationTab, isSelected && styles.selectedVariationTab)}
                  type="button"
                  aria-pressed={isSelected}
                  key={size.id}
                  onClick={(event) => {
                    stopCardOpen(event);
                    setSelectedSizeId(size.id);
                  }}
                >
                  <span>{variationLabel(size)}</span>
                  <strong>{formatPrice(size.price)}</strong>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className={cx(styles.cardActions, !hasMultiplePrices && styles.bottomCardActions)}>
          {quantity ? (
            <div className={styles.itemStepper} aria-label={`${item.title} quantity`}>
              <button
                type="button"
                onClick={(event) => {
                  stopCardOpen(event);
                  decreaseItem(cartKey);
                }}
                aria-label={`Remove one ${item.title}`}
              >
                <Minus aria-hidden="true" />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={(event) => {
                  stopCardOpen(event);
                  addItem(cartSelection);
                }}
                aria-label={`Add one ${item.title}`}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              className={styles.addButton}
              type="button"
              onClick={(event) => {
                stopCardOpen(event);
                addItem(cartSelection);
              }}
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
