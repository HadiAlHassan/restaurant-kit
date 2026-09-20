import { ArrowUpRight } from "lucide-react";
import { useOrdering } from "../config/useOrdering";
import { WhatsAppIcon } from "./WhatsAppIcon";

/** Icon for an order button: WhatsApp glyph, the ordering app's logo, or a plain outbound arrow. */
export function OrderIcon({ className }: { readonly className?: string }) {
  const ordering = useOrdering();

  if (ordering.isWhatsApp) return <WhatsAppIcon className={className} />;
  if (ordering.iconSrc) return <img className={className} src={ordering.iconSrc} alt="" aria-hidden="true" />;
  return <ArrowUpRight className={className} aria-hidden="true" />;
}
