import { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { OrderIcon } from "./OrderIcon";
import styles from "./Header.module.css";
import { useSiteConfig } from "../config/siteConfigContext";
import { useOrdering } from "../config/useOrdering";

export function Header() {
  const siteConfig = useSiteConfig();
  const ordering = useOrdering();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuHidden, setIsMenuHidden] = useState(false);

  useEffect(() => {
    const update = () => {
      const menuSection = document.querySelector("#menu");
      const isMobile = window.matchMedia("(max-width: 980px)").matches;
      const rect = menuSection?.getBoundingClientRect();

      setIsScrolled(window.scrollY > 24);
      setIsMenuHidden(Boolean(rect && rect.top <= (isMobile ? 12 : 84) && rect.bottom > 180));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ""} ${isMenuHidden ? styles.menuHidden : ""}`}>
      <Brand />
      <nav className={styles.nav} aria-label="Primary navigation">
        <a href="#menu">Menu</a>
        <a href="#restaurant">Restaurant</a>
        <a href="#locations">Location</a>
        <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
          Instagram
        </a>
      </nav>
      {ordering.href ? (
        <a className={`${styles.pill} ${ordering.isWhatsApp ? "" : styles.externalPill}`} href={ordering.href} target="_blank" rel="noreferrer">
          {ordering.shortLabel}
          <OrderIcon className={styles.pillIcon} />
        </a>
      ) : null}
    </header>
  );
}
