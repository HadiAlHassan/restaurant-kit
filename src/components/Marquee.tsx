import styles from "./Marquee.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

export function Marquee() {
  const { highlights } = useSiteConfig();

  return (
    <section className={styles.marquee} aria-label="Menu highlights">
      <div className={styles.track}>
        {[...highlights, ...highlights].map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </section>
  );
}
