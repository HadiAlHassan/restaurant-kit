import { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { WhatsAppIcon } from "./WhatsAppIcon";
import styles from "./Header.module.css";
import { useSiteConfig } from "../config/siteConfigContext";

export function Header() {
  const siteConfig = useSiteConfig();
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
      <a className={styles.pill} href={`https://wa.me/${siteConfig.whatsappNumber}`} target="_blank" rel="noreferrer">
        Order
        <WhatsAppIcon className={styles.pillIcon} />
      </a>
    </header>
  );
}
