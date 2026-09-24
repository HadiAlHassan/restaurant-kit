import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteConfig } from "../config/siteConfigContext";
import { imageSrc } from "../menu-browser/menuItemDisplay";
import type { Testimonial } from "../menu/menuSchema";
import { useMenuData } from "../menu/useMenuData";
import { clampRating, visibleTestimonials } from "../testimonials/testimonialMutations";
import styles from "./TestimonialsSection.module.css";

const maxStars = 5;

function TestimonialCard({ testimonial }: { readonly testimonial: Testimonial }) {
  const rating = clampRating(testimonial.rating);
  const author = testimonial.author.trim() || "Google reviewer";

  return (
    <li className={`${styles.card} ${testimonial.image ? "" : styles.textOnly}`}>
      {testimonial.image ? (
        <div className={styles.media}>
          <img src={imageSrc(testimonial.image)} alt={`Photo shared by ${author}`} loading="lazy" />
        </div>
      ) : null}
      <figure className={styles.body}>
        <div className={styles.stars} role="img" aria-label={`${rating} out of ${maxStars} stars`}>
          {"★".repeat(rating)}
          <span aria-hidden="true">{"★".repeat(maxStars - rating)}</span>
        </div>
        <blockquote className={styles.quote}>{testimonial.text.trim()}</blockquote>
        <figcaption className={styles.byline}>
          <span className={styles.author}>{author}</span>
          {testimonial.sourceUrl ? (
            <a href={testimonial.sourceUrl} target="_blank" rel="noreferrer">
              Read on Google
              <ArrowUpRight aria-hidden="true" />
            </a>
          ) : null}
        </figcaption>
      </figure>
    </li>
  );
}

/** Owner-curated customer reviews. Renders nothing until the menu has a visible testimonial. */
export function TestimonialsSection() {
  const siteConfig = useSiteConfig();
  const { menu } = useMenuData();
  const testimonials = visibleTestimonials(menu);
  const trackRef = useRef<HTMLUListElement>(null);
  // Which directions still have cards to reveal; both false = everything fits, so no arrows.
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const back = track.scrollLeft > 4;
    const forward = track.scrollLeft + track.clientWidth < track.scrollWidth - 4;
    setCanScroll((current) => (current.back === back && current.forward === forward ? current : { back, forward }));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, testimonials.length]);

  const step = (direction: -1 | 1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  if (!testimonials.length) return null;

  return (
    // Takes over the rating section's slot and anchor (`#restaurant`, linked from the header nav).
    <section className={`section ${styles.testimonials}`} id="restaurant" aria-labelledby="reviews-title">
      <div className={`section-inner ${styles.heading}`}>
        <div>
          {siteConfig.testimonialsEyebrow ? <p className="micro-label">{siteConfig.testimonialsEyebrow}</p> : null}
          <h2 id="reviews-title">{siteConfig.testimonialsHeadline ?? "Our customers' cameras don't lie."}</h2>
        </div>
        <div className={styles.score} aria-label="Customer rating">
          <span className={styles.scoreValue}>{siteConfig.rating}</span>
          <div>
            <div className={styles.scoreStars} role="img" aria-label={siteConfig.ratingLabel}>
              {"★".repeat(clampRating(Number(siteConfig.rating)))}
            </div>
            <p>{siteConfig.reviewCount}</p>
          </div>
        </div>
      </div>
      <div className={`section-inner ${styles.subhead}`}>
        <p>{siteConfig.ratingCopy}</p>
        {canScroll.back || canScroll.forward ? (
          <div className={styles.arrows}>
            <button type="button" onClick={() => step(-1)} disabled={!canScroll.back} aria-label="Previous reviews">
              <ArrowLeft aria-hidden="true" />
            </button>
            <button type="button" onClick={() => step(1)} disabled={!canScroll.forward} aria-label="Next reviews">
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {/* Full-bleed scroller: cards line up with the section gutter, then run off the edge. */}
      <ul className={styles.track} aria-label="Customer reviews" tabIndex={0} ref={trackRef} onScroll={measure}>
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </ul>
    </section>
  );
}
