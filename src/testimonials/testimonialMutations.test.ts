import { describe, expect, it } from "vitest";
import type { DynamicMenu, Testimonial } from "../menu/menuSchema";
import { demoSeedMenu } from "../testing/fixtures";
import { addTestimonial, clampRating, deleteTestimonial, moveTestimonial, sortedTestimonials, updateTestimonial, visibleTestimonials } from "./testimonialMutations";

const review = (id: string, patch: Partial<Testimonial> = {}): Testimonial => ({ id, author: `Author ${id}`, rating: 5, text: `Text ${id}`, order: 99, isVisible: true, ...patch });
const ids = (menu: DynamicMenu) => sortedTestimonials(menu).map((testimonial) => testimonial.id);

describe("testimonial mutations", () => {
  it("treats a menu without the field as having none", () => {
    expect(sortedTestimonials(demoSeedMenu)).toEqual([]);
    expect(deleteTestimonial(demoSeedMenu, "missing")).toBe(demoSeedMenu);
    expect(updateTestimonial(demoSeedMenu, "missing", { text: "x" })).toBe(demoSeedMenu);
  });

  it("appends with contiguous order and leaves the rest of the menu alone", () => {
    const menu = addTestimonial(addTestimonial(demoSeedMenu, review("a")), review("b"));

    expect(sortedTestimonials(menu).map(({ id, order }) => [id, order])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(menu.items).toBe(demoSeedMenu.items);
  });

  it("moves within bounds and ignores moves past either end", () => {
    const menu = ["a", "b", "c"].reduce((current, id) => addTestimonial(current, review(id)), demoSeedMenu);

    expect(ids(moveTestimonial(menu, "c", -1))).toEqual(["a", "c", "b"]);
    expect(moveTestimonial(menu, "a", -1)).toBe(menu);
    expect(moveTestimonial(menu, "c", 1)).toBe(menu);
  });

  it("renumbers after a delete", () => {
    const menu = ["a", "b", "c"].reduce((current, id) => addTestimonial(current, review(id)), demoSeedMenu);

    expect(sortedTestimonials(deleteTestimonial(menu, "a")).map(({ id, order }) => [id, order])).toEqual([
      ["b", 0],
      ["c", 1],
    ]);
  });

  it("clamps ratings to whole stars between 1 and 5", () => {
    expect([0, 3.6, 9, Number.NaN].map(clampRating)).toEqual([1, 4, 5, 5]);
    const menu = updateTestimonial(addTestimonial(demoSeedMenu, review("a")), "a", { rating: 12 });
    expect(sortedTestimonials(menu)[0].rating).toBe(5);
  });

  it("only shows visible testimonials that have text", () => {
    const menu = [review("a"), review("hidden", { isVisible: false }), review("blank", { text: "  " })].reduce(addTestimonial, demoSeedMenu);

    expect(visibleTestimonials(menu).map((testimonial) => testimonial.id)).toEqual(["a"]);
  });
});
