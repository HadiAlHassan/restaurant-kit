import styles from "./Footer.module.css";
import { useSiteConfig } from "../config/siteConfigContext";
import type { FooterNotice } from "../config/siteTypes";

export function Footer() {
  const siteConfig = useSiteConfig();
  const year = String(new Date().getFullYear());
  const legal =
    siteConfig.footer?.legal?.replaceAll("{year}", year) ??
    `© ${year} ${siteConfig.brandName}. All rights reserved.`;
  const notices = siteConfig.footer?.notices ?? [];

  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <p className={styles.legal}>{legal}</p>
        <p className={styles.note}>{siteConfig.footerNote}</p>
      </div>
      {notices.length > 0 && (
        <div className={styles.notices}>
          {notices.map((notice, index) => (
            <p key={index} className={styles.notice}>
              <NoticeParts notice={notice} />
            </p>
          ))}
        </div>
      )}
    </footer>
  );
}

function NoticeParts({ notice }: { notice: FooterNotice }) {
  return notice.map((part, index) => {
    if (typeof part === "string") return part;
    const external = /^https?:\/\//.test(part.href);
    return (
      <a
        key={index}
        href={part.href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {part.label}
      </a>
    );
  });
}
