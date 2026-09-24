export type MenuIcon = "plate" | "burger" | "wrap" | "chicken" | "platter" | "fries" | "kids" | "drink";

export type MenuGroup = {
  readonly id: string;
  readonly label: string;
  readonly icon: MenuIcon;
  readonly order: number;
  readonly isVisible: boolean;
};

export type MenuCategory = {
  readonly id: string;
  readonly groupId: string;
  readonly title: string;
  readonly order: number;
  readonly isVisible: boolean;
};

export type MenuSize = {
  readonly id: string;
  readonly label: string;
  readonly price: string;
  readonly order: number;
};

export type MenuItem = {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly imageKey?: string;
  readonly order: number;
  readonly isVisible: boolean;
  readonly pricingMode: "single" | "sizes";
  readonly price: string;
  readonly sizes: readonly MenuSize[];
  readonly removableIngredients?: readonly string[];
};

/** A customer review the owner copied in (typically from Google Maps), optionally with the customer's photo. */
export type Testimonial = {
  readonly id: string;
  readonly author: string;
  /** Whole stars, 1–5. */
  readonly rating: number;
  readonly text: string;
  /** Static path, URL, or an uploaded image URL (then `imageKey` is its R2 key). */
  readonly image?: string;
  readonly imageKey?: string;
  /** Link to the original review. */
  readonly sourceUrl?: string;
  readonly order: number;
  readonly isVisible: boolean;
};

export type DynamicMenu = {
  readonly schemaVersion: 1;
  readonly updatedAt: string;
  readonly restaurant: {
    readonly id: string;
    readonly name: string;
    readonly tagline: string;
    readonly phone: string;
    readonly whatsapp: string;
    readonly address: string;
  };
  readonly groups: readonly MenuGroup[];
  readonly categories: readonly MenuCategory[];
  readonly items: readonly MenuItem[];
  /** Optional. The public Testimonials section only renders when at least one is visible. */
  readonly testimonials?: readonly Testimonial[];
};
