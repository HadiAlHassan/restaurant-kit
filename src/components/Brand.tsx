import styles from "./Brand.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

type BrandProps = {
  className?: string;
};

export function Brand({ className }: BrandProps) {
  const siteConfig = useSiteConfig();

  return (
    <a className={`${styles.brand} ${className ?? ""}`} href="#top" aria-label={`${siteConfig.brandName} home`}>
      <img className={styles.logo} src={siteConfig.logoSrc} alt="" aria-hidden="true" />
      <span className={styles.copy}>
        <span className={styles.name}>{siteConfig.brandName}</span>
        <span className={styles.line}>{siteConfig.tagline}</span>
      </span>
    </a>
  );
}
