import { Expand, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CartItem } from "../cart/cartTypes";
import { useCart } from "../cart/useCart";
import { OrderIcon } from "../components/OrderIcon";
import { useOrdering } from "../config/useOrdering";
import { formatPriceTotal } from "../menu/priceFormat";
import type { MenuItem } from "../menu/menuSchema";
import { cx } from "../utils";
import styles from "./MenuBrowser.module.css";
import { formatPrice, imageSrc, sortedSizes, variationLabel } from "./menuItemDisplay";
import { MenuLightbox } from "./MenuLightbox";

type MenuItemSheetProps = {
  item: MenuItem;
  /** Cart line to edit: prefills the form and replaces the line on save instead of adding. */
  editLine?: CartItem;
  onClose: () => void;
};

export function MenuItemSheet({ item, editLine, onClose }: MenuItemSheetProps) {
  const hasImage = Boolean(item.image);
  const sizes = sortedSizes(item);
  const removableIngredients = item.removableIngredients ?? [];
  const [selectedSizeId, setSelectedSizeId] = useState(editLine?.variationId ?? sizes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(editLine?.quantity ?? 1);
  const [note, setNote] = useState(editLine?.note ?? "");
  const [removedIngredients, setRemovedIngredients] = useState<readonly string[]>(
    (editLine?.removedIngredients ?? []).filter((ingredient) => removableIngredients.includes(ingredient)),
  );
  const selectedSize = sizes.find((size) => size.id === selectedSizeId) ?? sizes[0];
  const price = selectedSize?.price ?? item.price;
  const hasMultiplePrices = sizes.length > 1;
  const { addItem, replaceItem, items, openCart } = useCart();
  const ordering = useOrdering();
  const { cartEnabled } = ordering;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const total = formatPriceTotal(price, quantity);
  const inCartQuantity = items.filter((line) => line.itemId === item.id).reduce((count, line) => count + line.quantity, 0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const isLightboxOpenRef = useRef(false);

  const setLightboxOpen = (open: boolean) => {
    isLightboxOpenRef.current = open;
    setIsLightboxOpen(open);
  };

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      // While the photo lightbox is up, Escape belongs to it.
      if (event.key === "Escape" && !isLightboxOpenRef.current) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const toggleIngredient = (ingredient: string) => {
    setRemovedIngredients((current) => (current.includes(ingredient) ? current.filter((entry) => entry !== ingredient) : [...current, ingredient]));
  };

  const handleAdd = () => {
    const selection = {
      itemId: item.id,
      itemName: item.title,
      variationId: selectedSize?.id,
      variationName: selectedSize?.label,
      ...(removedIngredients.length ? { removedIngredients } : {}),
    };

    if (editLine) replaceItem(editLine.key, selection, { quantity, note });
    else addItem(selection, { quantity, note });
    onClose();
  };

  return (
    <div className={styles.sheetLayer} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className={styles.sheetVeil} onClick={onClose} />
      <div className={styles.sheet}>
        <button className={styles.sheetClose} type="button" ref={closeButtonRef} onClick={onClose} aria-label="Close">
          <X aria-hidden="true" />
        </button>
        <div className={styles.sheetScroll}>
          {hasImage ? (
            <button className={styles.sheetHero} type="button" onClick={() => setLightboxOpen(true)} aria-label={`View photo of ${item.title}`}>
              <img src={imageSrc(item.image)} alt={item.title} />
              <span className={styles.zoomHint} aria-hidden="true">
                <Expand />
              </span>
            </button>
          ) : null}
          <div className={cx(styles.sheetBody, !hasImage && styles.plainSheetBody)}>
            <header className={styles.sheetHeader}>
              <h3>{item.title}</h3>
              {!hasMultiplePrices ? <span className={styles.price}>{formatPrice(price) || "M.P."}</span> : null}
            </header>
            {item.description ? <p className={styles.sheetDesc}>{item.description}</p> : null}
            {cartEnabled && inCartQuantity && !editLine ? (
              <p className={styles.sheetInCart}>
                In your cart: {inCartQuantity} — this adds another.{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openCart();
                  }}
                >
                  Edit cart
                </button>
              </p>
            ) : null}
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
                      onClick={() => setSelectedSizeId(size.id)}
                    >
                      <span>{variationLabel(size)}</span>
                      <strong>{formatPrice(size.price)}</strong>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {cartEnabled && removableIngredients.length ? (
              <fieldset className={styles.sheetRemovables}>
                <legend className={styles.sheetNoteLabel}>Remove ingredients</legend>
                {removableIngredients.map((ingredient) => (
                  <label className={styles.sheetRemovable} key={ingredient}>
                    <span>{ingredient}</span>
                    <input type="checkbox" checked={removedIngredients.includes(ingredient)} onChange={() => toggleIngredient(ingredient)} />
                  </label>
                ))}
              </fieldset>
            ) : null}
            {cartEnabled ? (
              <>
                <label className={styles.sheetNoteLabel} htmlFor={`sheet-note-${item.id}`}>
                  Special instructions
                </label>
                <textarea
                  className={styles.sheetNote}
                  id={`sheet-note-${item.id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. no pickles, sauce on the side…"
                />
              </>
            ) : null}
          </div>
        </div>
        {cartEnabled ? (
          <footer className={styles.sheetFooter}>
            <div className={styles.sheetStepper} aria-label={`${item.title} quantity`}>
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity">
                <Minus aria-hidden="true" />
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="Increase quantity">
                <Plus aria-hidden="true" />
              </button>
            </div>
            <button className={styles.sheetAdd} type="button" onClick={handleAdd}>
              <span>{editLine ? "Update cart" : "Add to cart"}</span>
              {total ? <span className={styles.sheetTotal}>{total}</span> : null}
            </button>
          </footer>
        ) : ordering.href ? (
          // Browse-only menu: the sheet is a detail view and hands off to the ordering app.
          <footer className={styles.sheetFooter}>
            <a className={cx(styles.sheetAdd, styles.sheetOrderLink)} href={ordering.href} target="_blank" rel="noreferrer">
              <span>{ordering.label}</span>
              <OrderIcon className={styles.sheetOrderIcon} />
            </a>
          </footer>
        ) : null}
      </div>
      {isLightboxOpen ? <MenuLightbox alt={item.title} imageSrc={imageSrc(item.image)} onClose={() => setLightboxOpen(false)} /> : null}
    </div>
  );
}
