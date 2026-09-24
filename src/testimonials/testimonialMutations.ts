import type { DynamicMenu, Testimonial } from "../menu/menuSchema";

const maxRating = 5;

export function clampRating(rating: number) {
  if (!Number.isFinite(rating)) return maxRating;
  return Math.min(maxRating, Math.max(1, Math.round(rating)));
}

export function sortedTestimonials(menu: DynamicMenu): readonly Testimonial[] {
  return [...(menu.testimonials ?? [])].sort((left, right) => left.order - right.order);
}

export function visibleTestimonials(menu: DynamicMenu): readonly Testimonial[] {
  return sortedTestimonials(menu).filter((testimonial) => testimonial.isVisible && testimonial.text.trim());
}

function withTestimonials(menu: DynamicMenu, testimonials: readonly Testimonial[]): DynamicMenu {
  return { ...menu, testimonials: testimonials.map((testimonial, order) => (testimonial.order === order ? testimonial : { ...testimonial, order })) };
}

export function createTestimonialDraft(): Testimonial {
  return {
    id: `testimonial-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    author: "",
    rating: maxRating,
    text: "",
    order: Number.MAX_SAFE_INTEGER,
    isVisible: true,
  };
}

export function addTestimonial(menu: DynamicMenu, testimonial: Testimonial): DynamicMenu {
  return withTestimonials(menu, [...sortedTestimonials(menu), testimonial]);
}

export function updateTestimonial(menu: DynamicMenu, testimonialId: string, patch: Partial<Testimonial>): DynamicMenu {
  if (!menu.testimonials?.some((testimonial) => testimonial.id === testimonialId)) return menu;
  const next = sortedTestimonials(menu).map((testimonial) =>
    testimonial.id === testimonialId ? { ...testimonial, ...patch, ...(patch.rating === undefined ? {} : { rating: clampRating(patch.rating) }) } : testimonial,
  );
  return withTestimonials(menu, next);
}

export function deleteTestimonial(menu: DynamicMenu, testimonialId: string): DynamicMenu {
  if (!menu.testimonials?.some((testimonial) => testimonial.id === testimonialId)) return menu;
  return withTestimonials(
    menu,
    sortedTestimonials(menu).filter((testimonial) => testimonial.id !== testimonialId),
  );
}

export function moveTestimonial(menu: DynamicMenu, testimonialId: string, direction: -1 | 1): DynamicMenu {
  const ordered = [...sortedTestimonials(menu)];
  const index = ordered.findIndex((testimonial) => testimonial.id === testimonialId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return menu;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return withTestimonials(menu, ordered);
}
