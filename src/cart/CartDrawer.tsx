import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useMemo } from "react";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { useSiteConfig } from "../config/siteConfigContext";
import { buildWhatsAppOrderUrl, formatVariationName } from "./cartOrder";
import type { CartItem } from "./cartTypes";
import { useCart } from "./useCart";
import styles from "./CartDrawer.module.css";

type CartDrawerProps = {
  /** When provided, each line gets an Edit action that hands the line back for editing. */
  onEditItem?: (item: CartItem) => void;
};

export function CartDrawer({ onEditItem }: CartDrawerProps = {}) {
  const { items, itemCount, isOpen, orderNote, addItem, decreaseItem, removeItem, setItemNote, setOrderNote, openCart, closeCart, clearCart } = useCart();
  const { whatsappNumber, orderGreeting } = useSiteConfig();
  const orderHref = useMemo(() => buildWhatsAppOrderUrl(items, orderNote, { whatsappNumber, orderGreeting }), [items, orderGreeting, orderNote, whatsappNumber]);

  return (
    <>
      {itemCount ? (
        <button className={styles.cartBar} type="button" onClick={openCart} aria-expanded={isOpen}>
          <span className={styles.cartBarIcon}>
            <ShoppingBag aria-hidden="true" />
          </span>
          <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          <strong>Review order</strong>
        </button>
      ) : null}

      <div className={`${styles.backdrop} ${isOpen ? styles.openBackdrop : ""}`} onClick={closeCart} />
      <aside className={`${styles.drawer} ${isOpen ? styles.openDrawer : ""}`} aria-label="Order cart" aria-hidden={!isOpen} inert={!isOpen}>
        <header className={styles.header}>
          <div>
            <p>Order draft</p>
            <h2>Your cart</h2>
          </div>
          <button className={styles.iconButton} type="button" onClick={closeCart} aria-label="Close cart">
            <X aria-hidden="true" />
          </button>
        </header>

        {items.length ? (
          <>
            <div className={styles.items}>
              {items.map((item) => (
                <article className={styles.item} key={item.key}>
                  <div>
                    <h3>{item.itemName}</h3>
                    {item.variationName ? <p>{formatVariationName(item.variationName)}</p> : null}
                    {item.removedIngredients?.length ? <p>No: {item.removedIngredients.join(", ")}</p> : null}
                  </div>
                  <div className={styles.quantityControls}>
                    <button type="button" onClick={() => decreaseItem(item.key)} aria-label={`Remove one ${item.itemName}`}>
                      <Minus aria-hidden="true" />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => addItem(item)} aria-label={`Add one ${item.itemName}`}>
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <input
                    className={styles.noteInput}
                    aria-label={`Note for ${item.itemName}`}
                    value={item.note ?? ""}
                    onChange={(event) => setItemNote(item.key, event.target.value)}
                    placeholder="Note for the kitchen (optional) — e.g. no pickles"
                  />
                  <div className={styles.itemActions}>
                    {onEditItem ? (
                      <button className={styles.removeButton} type="button" onClick={() => onEditItem(item)}>
                        Edit
                      </button>
                    ) : null}
                    <button className={styles.removeButton} type="button" onClick={() => removeItem(item.key)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <footer className={styles.footer}>
              <label className={styles.orderNoteLabel} htmlFor="cart-order-note">
                Order note
              </label>
              <textarea
                className={styles.orderNote}
                id="cart-order-note"
                value={orderNote}
                onChange={(event) => setOrderNote(event.target.value)}
                placeholder="Anything about the whole order — delivery instructions, extra sauce…"
              />
              <button className={styles.clearButton} type="button" onClick={clearCart}>
                Clear cart
              </button>
              <a className={styles.whatsappButton} href={orderHref} target="_blank" rel="noreferrer">
                Send order on WhatsApp
                <WhatsAppIcon className={styles.whatsappIcon} />
              </a>
            </footer>
          </>
        ) : (
          <div className={styles.empty}>
            <h3>No items yet.</h3>
            <p>Add something from the menu to draft a WhatsApp order.</p>
          </div>
        )}
      </aside>
    </>
  );
}
