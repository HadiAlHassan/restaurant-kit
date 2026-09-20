import { cartSelectionKey } from "./cartOrder";
import type { CartSelection, CartState } from "./cartTypes";

export type CartAction =
  | { type: "add"; selection: CartSelection; quantity?: number; note?: string }
  /** `note` omitted keeps the line's note; `null` or a blank string clears it. */
  | { type: "replace"; key: string; selection: CartSelection; quantity?: number; note?: string | null }
  | { type: "decrease"; key: string }
  | { type: "remove"; key: string }
  | { type: "set-note"; key: string; note: string }
  | { type: "set-order-note"; note: string }
  | { type: "open" }
  | { type: "close" }
  | { type: "clear" };

export const initialCartState: CartState = { items: [], isOpen: false, orderNote: "" };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const key = cartSelectionKey(action.selection);
      const quantity = Math.max(1, Math.round(action.quantity ?? 1));
      const note = action.note?.trim() ? action.note : undefined;
      const existingItem = state.items.find((item) => item.key === key);

      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) => (item.key === key ? { ...item, quantity: item.quantity + quantity, note: note ?? item.note } : item)),
        };
      }

      return {
        ...state,
        items: [...state.items, { ...action.selection, key, quantity, ...(note ? { note } : {}) }],
      };
    }
    case "replace": {
      const index = state.items.findIndex((item) => item.key === action.key);
      if (index === -1) return state;

      const key = cartSelectionKey(action.selection);
      const quantity = Math.max(1, Math.round(action.quantity ?? 1));
      const note = action.note?.trim() ? action.note : undefined;
      const keepsExistingNote = action.note === undefined;
      const hasMergeTarget = state.items.some((item, itemIndex) => item.key === key && itemIndex !== index);

      if (hasMergeTarget) {
        return {
          ...state,
          items: state.items
            .filter((_, itemIndex) => itemIndex !== index)
            .map((item) => (item.key === key ? { ...item, quantity: item.quantity + quantity, note: keepsExistingNote ? item.note : note } : item)),
        };
      }

      const items = [...state.items];
      items[index] = { ...action.selection, key, quantity, ...(note ? { note } : {}) };
      return { ...state, items };
    }
    case "decrease": {
      return {
        ...state,
        items: state.items.flatMap((item) => {
          if (item.key !== action.key) return [item];
          if (item.quantity <= 1) return [];
          return [{ ...item, quantity: item.quantity - 1 }];
        }),
      };
    }
    case "remove":
      return {
        ...state,
        items: state.items.filter((item) => item.key !== action.key),
      };
    case "set-note":
      return {
        ...state,
        items: state.items.map((item) => (item.key === action.key ? { ...item, note: action.note } : item)),
      };
    case "set-order-note":
      return { ...state, orderNote: action.note };
    case "open":
      return { ...state, isOpen: true };
    case "close":
      return { ...state, isOpen: false };
    case "clear":
      return { ...state, items: [], isOpen: false, orderNote: "" };
    default:
      return state;
  }
}
