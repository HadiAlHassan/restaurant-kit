import { WhatsAppIcon } from "./WhatsAppIcon";
import styles from "./Hero.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

export function Hero() {
  const siteConfig = useSiteConfig();

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
          <a className="button button-whatsapp" href={`https://wa.me/${siteConfig.whatsappNumber}`} target="_blank" rel="noreferrer">
            Order on WhatsApp
            <WhatsAppIcon className="button-icon" />
          </a>
        </div>
      </div>
    </section>
  );
}
