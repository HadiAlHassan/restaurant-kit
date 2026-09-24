import { menuIconIds, type DynamicMenu } from "./menuSchema";

export type MenuValidationIssue = {
  /** Dotted path to the offending value, e.g. `items[3].categoryId`. */
  readonly path: string;
  readonly message: string;
};

/**
 * Checks a menu's shape and cross-references. The runtime tolerates orphans (a category whose
 * group is gone is kept at the end, an item whose category is gone is hidden); call this on seed
 * data in a test or build step so those mistakes fail loudly instead.
 *
 * Returns every issue found; an empty array means the menu is valid.
 */
export function validateMenu(value: unknown): MenuValidationIssue[] {
  const issues: MenuValidationIssue[] = [];
  const report = (path: string, message: string) => issues.push({ path, message });

  if (!isRecord(value)) {
    report("", "Menu must be an object.");
    return issues;
  }
  if (value.schemaVersion !== 1) report("schemaVersion", "Must be 1.");
  if (typeof value.updatedAt !== "string") report("updatedAt", "Must be an ISO date string.");

  if (!isRecord(value.restaurant)) {
    report("restaurant", "Must be an object.");
  } else {
    for (const field of ["id", "name", "tagline", "phone", "whatsapp", "address"]) {
      if (typeof value.restaurant[field] !== "string") report(`restaurant.${field}`, "Must be a string.");
    }
  }

  const groups = records(value.groups, "groups", report);
  const categories = records(value.categories, "categories", report);
  const items = records(value.items, "items", report);
  const testimonials = value.testimonials === undefined ? [] : records(value.testimonials, "testimonials", report);

  const groupIds = uniqueIds(groups, "groups", report);
  const categoryIds = uniqueIds(categories, "categories", report);
  uniqueIds(items, "items", report);
  uniqueIds(testimonials, "testimonials", report);

  groups.forEach((group, index) => {
    const path = `groups[${index}]`;
    requireStrings(group, path, ["label"], report);
    requireEntity(group, path, report);
    if (!(menuIconIds as readonly unknown[]).includes(group.icon)) {
      report(`${path}.icon`, `Must be one of: ${menuIconIds.join(", ")}.`);
    }
  });

  categories.forEach((category, index) => {
    const path = `categories[${index}]`;
    requireStrings(category, path, ["title"], report);
    requireEntity(category, path, report);
    if (!groupIds.has(category.groupId)) report(`${path}.groupId`, `No group with id "${String(category.groupId)}".`);
  });

  items.forEach((item, index) => {
    const path = `items[${index}]`;
    requireStrings(item, path, ["title", "description", "image", "price"], report);
    requireEntity(item, path, report);
    if (!categoryIds.has(item.categoryId)) report(`${path}.categoryId`, `No category with id "${String(item.categoryId)}".`);
    if (item.pricingMode !== "single" && item.pricingMode !== "sizes") {
      report(`${path}.pricingMode`, 'Must be "single" or "sizes".');
    }
    const sizes = records(item.sizes, `${path}.sizes`, report);
    if (item.pricingMode === "sizes" && sizes.length === 0) report(`${path}.sizes`, 'Needs at least one size when pricingMode is "sizes".');
    uniqueIds(sizes, `${path}.sizes`, report);
    sizes.forEach((size, sizeIndex) => {
      const sizePath = `${path}.sizes[${sizeIndex}]`;
      requireStrings(size, sizePath, ["id", "label", "price"], report);
      if (typeof size.order !== "number") report(`${sizePath}.order`, "Must be a number.");
    });
    if (item.removableIngredients !== undefined && !(Array.isArray(item.removableIngredients) && item.removableIngredients.every((entry) => typeof entry === "string"))) {
      report(`${path}.removableIngredients`, "Must be an array of strings.");
    }
  });

  testimonials.forEach((testimonial, index) => {
    const path = `testimonials[${index}]`;
    requireStrings(testimonial, path, ["author", "text"], report);
    requireEntity(testimonial, path, report);
    const rating = testimonial.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) report(`${path}.rating`, "Must be a whole number from 1 to 5.");
  });

  return issues;
}

/** Throws with every issue listed when the menu is invalid; narrows `value` otherwise. */
export function assertValidMenu(value: unknown): asserts value is DynamicMenu {
  const issues = validateMenu(value);
  if (issues.length === 0) return;
  const lines = issues.map((issue) => `  - ${issue.path || "(root)"}: ${issue.message}`);
  throw new Error(`Invalid menu (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n${lines.join("\n")}`);
}

type Report = (path: string, message: string) => void;
type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown, path: string, report: Report): Entry[] {
  if (!Array.isArray(value)) {
    report(path, "Must be an array.");
    return [];
  }
  return value.filter((entry, index) => {
    if (isRecord(entry)) return true;
    report(`${path}[${index}]`, "Must be an object.");
    return false;
  });
}

function uniqueIds(entries: readonly Entry[], path: string, report: Report): Set<unknown> {
  const seen = new Set<unknown>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) report(`${path}[${index}].id`, `Duplicate id "${String(entry.id)}".`);
    seen.add(entry.id);
  });
  return seen;
}

function requireEntity(entry: Entry, path: string, report: Report) {
  if (typeof entry.id !== "string" || entry.id === "") report(`${path}.id`, "Must be a non-empty string.");
  if (typeof entry.order !== "number") report(`${path}.order`, "Must be a number.");
  if (typeof entry.isVisible !== "boolean") report(`${path}.isVisible`, "Must be a boolean.");
}

function requireStrings(entry: Entry, path: string, fields: readonly string[], report: Report) {
  for (const field of fields) {
    if (typeof entry[field] !== "string") report(`${path}.${field}`, "Must be a string.");
  }
}
