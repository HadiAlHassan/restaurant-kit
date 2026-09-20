export type CartSelection = {
  readonly itemId: string;
  readonly itemName: string;
  readonly variationId?: string;
  readonly variationName?: string;
  readonly removedIngredients?: readonly string[];
};

export type CartItem = CartSelection & {
  readonly key: string;
  readonly quantity: number;
  readonly note?: string;
};

export type CartState = {
  readonly items: readonly CartItem[];
  readonly isOpen: boolean;
  readonly orderNote: string;
};

export type CartContextValue = CartState & {
  readonly itemCount: number;
  readonly addItem: (selection: CartSelection, options?: { quantity?: number; note?: string }) => void;
  /** `note: null` (or "") clears the note when the edit merges into an existing line; omitting it keeps the line's note. */
  readonly replaceItem: (key: string, selection: CartSelection, options?: { quantity?: number; note?: string | null }) => void;
  readonly decreaseItem: (key: string) => void;
  readonly removeItem: (key: string) => void;
  readonly getQuantity: (selection: CartSelection) => number;
  readonly setItemNote: (key: string, note: string) => void;
  readonly setOrderNote: (note: string) => void;
  readonly openCart: () => void;
  readonly closeCart: () => void;
  readonly clearCart: () => void;
};
