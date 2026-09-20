import { useMemo, useReducer, type ReactNode } from "react";
import { CartContext } from "./cartContext";
import { cartSelectionKey } from "./cartOrder";
import { cartReducer, initialCartState } from "./cartReducer";
import type { CartContextValue, CartSelection } from "./cartTypes";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  const value = useMemo<CartContextValue>(() => {
    const getQuantity = (selection: CartSelection) => {
      const key = cartSelectionKey(selection);
      return state.items.find((item) => item.key === key)?.quantity ?? 0;
    };

    return {
      ...state,
      itemCount: state.items.reduce((count, item) => count + item.quantity, 0),
      addItem: (selection, options) => dispatch({ type: "add", selection, quantity: options?.quantity, note: options?.note }),
      replaceItem: (key, selection, options) => dispatch({ type: "replace", key, selection, quantity: options?.quantity, note: options?.note }),
      decreaseItem: (key) => dispatch({ type: "decrease", key }),
      removeItem: (key) => dispatch({ type: "remove", key }),
      getQuantity,
      setItemNote: (key, note) => dispatch({ type: "set-note", key, note }),
      setOrderNote: (note) => dispatch({ type: "set-order-note", note }),
      openCart: () => dispatch({ type: "open" }),
      closeCart: () => dispatch({ type: "close" }),
      clearCart: () => dispatch({ type: "clear" }),
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
