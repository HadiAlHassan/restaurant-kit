/**
 * How customers order.
 * - `whatsapp` (default): cart + "Add to cart" on every item, order sent as a WhatsApp message.
 * - `external`: cart off. The menu is browse-only and every order button links to `url`
 *   (Toters, Talabat, the restaurant's own app…).
 */
export type OrderingConfig =
  | { readonly mode: "whatsapp" }
  | {
      readonly mode: "external";
      readonly url: string;
      /** Full button text, e.g. "Order on Toters". */
      readonly label: string;
      /** Header pill text. Defaults to "Order". */
      readonly shortLabel?: string;
      /** Logo of the ordering app, shown inside the buttons. Falls back to an arrow. */
      readonly iconSrc?: string;
    };

export type RestaurantSiteConfig = {
  readonly restaurantId: string;
  readonly brandName: string;
  readonly tagline: string;
  readonly locationLabel: string;
  readonly address: string;
  readonly phoneDisplay: string;
  readonly phoneHref: string;
  /** International form, no `+`. Empty string hides every WhatsApp link. */
  readonly whatsappNumber: string;
  readonly instagramHandle: string;
  readonly instagramUrl: string;
  readonly mapsUrl: string;
  readonly logoSrc: string;
  readonly rating: string;
  readonly ratingLabel: string;
  readonly reviewCount: string;
  readonly cuisineSummary: string;
  readonly localBadge: string;
  readonly orderGreeting: string;
  readonly highlights: readonly string[];
  readonly heroEyebrow: string;
  readonly heroSubline: string;
  readonly ratingHeadline: string;
  readonly ratingCopy: string;
  readonly footerNote: string;
  /** Optional. Omit for the default WhatsApp cart. */
  readonly ordering?: OrderingConfig;
};
