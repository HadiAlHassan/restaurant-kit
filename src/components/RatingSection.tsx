import styles from "./RatingSection.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

const maxStars = 5;

function starGlyphs(rating: string) {
  const numericRating = Number(rating);
  const filled = Number.isFinite(numericRating) ? Math.min(maxStars, Math.max(0, Math.round(numericRating))) : maxStars;
  return "★".repeat(filled) + "☆".repeat(maxStars - filled);
}

export function RatingSection() {
  const siteConfig = useSiteConfig();

  return (
    <section className={`section ${styles.restaurant}`} id="restaurant" aria-labelledby="restaurant-title">
      <div className={`section-inner ${styles.grid}`}>
        <div>
          <p className="micro-label">Customer rated</p>
          <h2 id="restaurant-title">{siteConfig.ratingHeadline}</h2>
        </div>
        <div className={styles.panel} aria-label="Customer rating">
          <div className={styles.score}>
            <span>{siteConfig.rating}</span>
            <div className={styles.stars} aria-label={siteConfig.ratingLabel}>
              {starGlyphs(siteConfig.rating)}
            </div>
          </div>
          <p className={styles.copy}>{siteConfig.ratingCopy}</p>
          <div className={styles.meta}>
            <span>{siteConfig.reviewCount}</span>
            <span>{siteConfig.cuisineSummary}</span>
            <span>{siteConfig.localBadge}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
