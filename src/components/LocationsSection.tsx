import { InstagramIcon } from "./InstagramIcon";
import styles from "./LocationsSection.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

export function LocationsSection() {
  const siteConfig = useSiteConfig();

  return (
    <section className={`section ${styles.locations}`} id="locations" aria-labelledby="locations-title">
      <div className="section-inner">
        <p className="micro-label">Location</p>
        <h2 id="locations-title">Come Find Us!</h2>
        <div className={styles.row}>
          <a className={styles.card} href={siteConfig.mapsUrl} target="_blank" rel="noreferrer">
            <h3>{siteConfig.locationLabel}</h3>
            <p>{siteConfig.address}</p>
            <strong>Open Maps</strong>
          </a>
          <article className={styles.card}>
            <span>TEL</span>
            <h3>{siteConfig.whatsappNumber ? "Call or WhatsApp" : "Call us"}</h3>
            <div className={styles.linkStack}>
              <a href={siteConfig.phoneHref}>{siteConfig.phoneDisplay}</a>
              {siteConfig.whatsappNumber ? (
                <a href={`https://wa.me/${siteConfig.whatsappNumber}`} target="_blank" rel="noreferrer">
                  Message on WhatsApp
                </a>
              ) : null}
            </div>
          </article>
          <article className={`${styles.card} ${styles.accent}`}>
            <InstagramIcon className={styles.socialIcon} />
            <h3>{siteConfig.instagramHandle}</h3>
            <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
              Open Instagram
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
