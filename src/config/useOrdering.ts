import { useContext } from "react";
import { SiteConfigContext } from "./siteConfigContext";

export type ResolvedOrdering = {
  /** False = browse-only menu: no add-to-cart, no cart drawer. */
  readonly cartEnabled: boolean;
  readonly isWhatsApp: boolean;
  /** Where the header / hero / item-sheet order buttons go. Empty when there is nowhere to send people. */
  readonly href: string;
  readonly label: string;
  readonly shortLabel: string;
  /** External mode only: the ordering app's logo. */
  readonly iconSrc?: string;
};

/**
 * Resolves `config.ordering`. Reads the context directly instead of `useSiteConfig()` so the
 * menu components stay renderable without a provider (they fall back to the WhatsApp cart).
 */
export function useOrdering(): ResolvedOrdering {
  const config = useContext(SiteConfigContext)?.config;
  const ordering = config?.ordering;

  if (ordering?.mode === "external") {
    return { cartEnabled: false, isWhatsApp: false, href: ordering.url, label: ordering.label, shortLabel: ordering.shortLabel ?? "Order", iconSrc: ordering.iconSrc };
  }

  const number = config?.whatsappNumber ?? "";
  return { cartEnabled: true, isWhatsApp: true, href: number ? `https://wa.me/${number}` : "", label: "Order on WhatsApp", shortLabel: "Order" };
}
