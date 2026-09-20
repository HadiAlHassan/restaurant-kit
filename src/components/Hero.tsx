import { OrderIcon } from "./OrderIcon";
import styles from "./Hero.module.css";
import { useSiteConfig } from "../config/siteConfigContext";
import { useOrdering } from "../config/useOrdering";

export function Hero() {
  const siteConfig = useSiteConfig();
  const ordering = useOrdering();

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <p className="micro-label">{siteConfig.heroEyebrow}</p>
        <h1 id="hero-title" className={styles.title}>
          <strong>{siteConfig.brandName}</strong>
          <span>{siteConfig.tagline}</span>
        </h1>
        <p className={styles.subline}>{siteConfig.heroSubline}</p>
        <div className={styles.actions}>
          {ordering.href ? (
            <a className={`button ${ordering.isWhatsApp ? "button-whatsapp" : "button-order"}`} href={ordering.href} target="_blank" rel="noreferrer">
              {ordering.label}
              <OrderIcon className="button-icon" />
            </a>
          ) : (
            <a className="button button-fill" href="#menu">
              View menu
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
