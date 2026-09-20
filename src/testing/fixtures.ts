import type { RestaurantSiteConfig } from "../config/siteTypes";
import type { DynamicMenu } from "../menu/menuSchema";

export const demoSiteConfig: RestaurantSiteConfig = {
  restaurantId: "demo",
  brandName: "Demo Grill",
  tagline: "Savor The Flavor",
  locationLabel: "Demo City",
  address: "1 Demo Street",
  phoneDisplay: "+961 70 000 000",
  phoneHref: "tel:+96170000000",
  whatsappNumber: "96170000000",
  instagramHandle: "@demogrill",
  instagramUrl: "https://www.instagram.com/demogrill/",
  mapsUrl: "https://maps.example.com/demo-grill",
  logoSrc: "/assets/demo-logo.jpg",
  rating: "4.5",
  ratingLabel: "4.5 out of 5 stars",
  reviewCount: "100 reviews",
  cuisineSummary: "Burgers & wraps",
  localBadge: "Local favorite",
  orderGreeting: "Hi Demo Grill, I'd like to order:",
  highlights: ["Burgers", "Wraps", "Sides"],
  heroEyebrow: "Demo City / 1 Demo Street",
  heroSubline: "Delicious taste with every bite.",
  ratingHeadline: "Trusted for flavor.",
  ratingCopy: "Average rating from customers across Google reviews.",
  footerNote: "Demo City · 1 Demo Street",
};

export const demoSeedMenu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  restaurant: {
    id: "demo",
    name: "Demo Grill",
    tagline: "Savor The Flavor",
    phone: "+961 70 000 000",
    whatsapp: "96170000000",
    address: "1 Demo Street",
  },
  groups: [{ id: "all", label: "All", icon: "plate", order: 0, isVisible: true }],
  categories: [],
  items: [],
};
