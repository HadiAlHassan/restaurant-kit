// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MenuItem } from "../menu/menuSchema";
import { AdminItemDrawer } from "./AdminItemDrawer";

const item: MenuItem = {
  id: "item-fajita",
  categoryId: "category-sandwiches",
  title: "Fajita Sandwich",
  description: "",
  image: "",
  order: 0,
  isVisible: true,
  pricingMode: "single",
  price: "7",
  sizes: [],
  removableIngredients: ["Mushrooms"],
};

function renderDrawer(drawerItem: MenuItem = item) {
  const onUpdate = vi.fn();
  render(
    <AdminItemDrawer
      isUploadingImage={false}
      item={drawerItem}
      onAddSize={vi.fn()}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onRemoveImage={vi.fn()}
      onRemoveSize={vi.fn()}
      onUpdate={onUpdate}
      onUpdateSize={vi.fn()}
      onUploadImage={vi.fn()}
    />,
  );
  return onUpdate;
}

afterEach(cleanup);

describe("AdminItemDrawer removable ingredients", () => {
  it("adds a chip on Enter and ignores case-insensitive duplicates", () => {
    const onUpdate = renderDrawer();
    const field = screen.getByLabelText("Removable ingredients");

    fireEvent.change(field, { target: { value: "Pickles" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ removableIngredients: ["Mushrooms", "Pickles"] });

    onUpdate.mockClear();
    fireEvent.change(field, { target: { value: "  mushrooms " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("adds a chip when a comma is typed", () => {
    const onUpdate = renderDrawer();
    const field = screen.getByLabelText("Removable ingredients");

    fireEvent.change(field, { target: { value: "Garlic sauce," } });

    expect(onUpdate).toHaveBeenCalledWith({ removableIngredients: ["Mushrooms", "Garlic sauce"] });
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("removes a chip and clears the field to undefined when the last one goes", () => {
    const onUpdate = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Remove Mushrooms" }));

    expect(onUpdate).toHaveBeenCalledWith({ removableIngredients: undefined });
  });
});
