import { CartDrawer } from "../cart/CartDrawer";
import type { CartItem } from "../cart/cartTypes";
import { useCart } from "../cart/useCart";
import { useMenuData } from "../menu/useMenuData";
import { MenuItemSheet } from "./MenuItemSheet";
import { useParkedSheet } from "./useParkedSheet";

/**
 * CartDrawer wired to the menu: each cart line gets an Edit action that
 * opens the item sheet prefilled with the line and replaces it on save.
 */
export function MenuCartDrawer() {
  const { menu } = useMenuData();
  const { openCart, closeCart } = useCart();
  const { value: editLine, open: openEditor, close: closeEditor } = useParkedSheet<CartItem>(openCart);
  const editItem = editLine ? menu.items.find((item) => item.id === editLine.itemId) : undefined;

  const handleEditItem = (line: CartItem) => {
    if (!menu.items.some((item) => item.id === line.itemId)) return;
    closeCart();
    openEditor(line);
  };

  return (
    <>
      <CartDrawer onEditItem={handleEditItem} />
      {editLine && editItem ? <MenuItemSheet item={editItem} editLine={editLine} onClose={closeEditor} /> : null}
    </>
  );
}
