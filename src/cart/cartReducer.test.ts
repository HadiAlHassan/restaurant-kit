import { describe, expect, it } from "vitest";
import { cartReducer, initialCartState } from "./cartReducer";
import type { CartSelection, CartState } from "./cartTypes";

const burgerSelection: CartSelection = { itemId: "item-burger", itemName: "Smash burger", variationId: "size-large", variationName: "large" };

function stateWith(quantity: number): CartState {
  return {
    isOpen: false,
    orderNote: "",
    items: [{ ...burgerSelection, key: "item-burger:size-large", quantity }],
  };
}

describe("cartReducer", () => {
  it("adds a new selection with quantity 1", () => {
    const state = cartReducer(initialCartState, { type: "add", selection: burgerSelection });

    expect(state.items).toEqual([{ ...burgerSelection, key: "item-burger:size-large", quantity: 1 }]);
  });

  it("increments quantity for the same selection", () => {
    const state = cartReducer(stateWith(1), { type: "add", selection: burgerSelection });

    expect(state.items[0].quantity).toBe(2);
  });

  it("adds with an explicit quantity and note", () => {
    const state = cartReducer(initialCartState, { type: "add", selection: burgerSelection, quantity: 3, note: "no pickles" });

    expect(state.items).toEqual([{ ...burgerSelection, key: "item-burger:size-large", quantity: 3, note: "no pickles" }]);
  });

  it("merges quantity into an existing line and overwrites its note only when one is provided", () => {
    const noted = cartReducer(stateWith(1), { type: "add", selection: burgerSelection, quantity: 2, note: "extra sauce" });
    expect(noted.items[0]).toMatchObject({ quantity: 3, note: "extra sauce" });

    const merged = cartReducer(noted, { type: "add", selection: burgerSelection });
    expect(merged.items[0]).toMatchObject({ quantity: 4, note: "extra sauce" });
  });

  it("replaces a line in place, rekeying it when the selection changes", () => {
    const replaced = cartReducer(stateWith(2), {
      type: "replace",
      key: "item-burger:size-large",
      selection: { ...burgerSelection, removedIngredients: ["Pickles"] },
      quantity: 3,
      note: "well done",
    });

    expect(replaced.items).toEqual([
      { ...burgerSelection, removedIngredients: ["Pickles"], key: "item-burger:size-large:no=pickles", quantity: 3, note: "well done" },
    ]);

    const cleared = cartReducer(replaced, { type: "replace", key: "item-burger:size-large:no=pickles", selection: burgerSelection, quantity: 1 });
    expect(cleared.items).toEqual([{ ...burgerSelection, key: "item-burger:size-large", quantity: 1 }]);
  });

  it("merges a replaced line into an existing identical line", () => {
    const twoLines = cartReducer(stateWith(2), { type: "add", selection: { ...burgerSelection, removedIngredients: ["Pickles"] } });

    const merged = cartReducer(twoLines, {
      type: "replace",
      key: "item-burger:size-large:no=pickles",
      selection: burgerSelection,
      quantity: 1,
    });

    expect(merged.items).toEqual([{ ...burgerSelection, key: "item-burger:size-large", quantity: 3 }]);
  });

  it("clears the note when a replace merges into an existing noted line", () => {
    const noted = cartReducer(stateWith(2), { type: "add", selection: burgerSelection, note: "extra sauce" });
    const twoLines = cartReducer(noted, { type: "add", selection: { ...burgerSelection, removedIngredients: ["Pickles"] } });

    const clearedByBlank = cartReducer(twoLines, { type: "replace", key: "item-burger:size-large:no=pickles", selection: burgerSelection, quantity: 1, note: "" });
    expect(clearedByBlank.items).toEqual([{ ...burgerSelection, key: "item-burger:size-large", quantity: 4, note: undefined }]);

    const clearedByNull = cartReducer(twoLines, { type: "replace", key: "item-burger:size-large:no=pickles", selection: burgerSelection, quantity: 1, note: null });
    expect(clearedByNull.items[0].note).toBeUndefined();

    const kept = cartReducer(twoLines, { type: "replace", key: "item-burger:size-large:no=pickles", selection: burgerSelection, quantity: 1 });
    expect(kept.items[0].note).toBe("extra sauce");
  });

  it("ignores a replace for a missing key", () => {
    const state = cartReducer(stateWith(1), { type: "replace", key: "item-ghost:default", selection: burgerSelection });

    expect(state).toEqual(stateWith(1));
  });

  it("tracks different variations as separate lines", () => {
    const state = cartReducer(stateWith(1), { type: "add", selection: { ...burgerSelection, variationId: "size-small", variationName: "small" } });

    expect(state.items).toHaveLength(2);
  });

  it("decreases quantity and drops the line at zero", () => {
    const decreased = cartReducer(stateWith(2), { type: "decrease", key: "item-burger:size-large" });
    expect(decreased.items[0].quantity).toBe(1);

    const emptied = cartReducer(decreased, { type: "decrease", key: "item-burger:size-large" });
    expect(emptied.items).toEqual([]);
  });

  it("removes a line entirely", () => {
    const state = cartReducer(stateWith(3), { type: "remove", key: "item-burger:size-large" });

    expect(state.items).toEqual([]);
  });

  it("sets and updates a line item note", () => {
    const noted = cartReducer(stateWith(1), { type: "set-note", key: "item-burger:size-large", note: "no pickles" });
    expect(noted.items[0].note).toBe("no pickles");

    const cleared = cartReducer(noted, { type: "set-note", key: "item-burger:size-large", note: "" });
    expect(cleared.items[0].note).toBe("");
  });

  it("sets the order note", () => {
    const state = cartReducer(stateWith(1), { type: "set-order-note", note: "ring the bell" });
    expect(state.orderNote).toBe("ring the bell");
  });

  it("opens, closes, and clears", () => {
    const opened = cartReducer({ ...stateWith(1), orderNote: "ring the bell" }, { type: "open" });
    expect(opened.isOpen).toBe(true);

    const closed = cartReducer(opened, { type: "close" });
    expect(closed.isOpen).toBe(false);
    expect(closed.items).toHaveLength(1);

    const cleared = cartReducer(opened, { type: "clear" });
    expect(cleared).toEqual({ items: [], isOpen: false, orderNote: "" });
  });
});
