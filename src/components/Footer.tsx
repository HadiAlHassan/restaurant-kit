import styles from "./Footer.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

export function Footer() {
  const siteConfig = useSiteConfig();

  return (
    <footer className={styles.footer}>
      <p className={styles.legal}>© {new Date().getFullYear()} {siteConfig.brandName}. All rights reserved.</p>
      <p className={styles.note}>{siteConfig.footerNote}</p>
    </footer>
  );
}
