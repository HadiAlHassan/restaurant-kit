import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./MenuBrowser.module.css";

type MenuLightboxProps = {
  addLabel?: string;
  alt: string;
  imageSrc: string;
  onAdd?: () => void;
  onClose: () => void;
};

export function MenuLightbox({ addLabel, alt, imageSrc, onAdd, onClose }: MenuLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button className={styles.lightboxClose} type="button" ref={closeButtonRef} onClick={onClose} aria-label="Close photo">
        <X aria-hidden="true" />
      </button>
      <img className={styles.lightboxImage} src={imageSrc} alt={alt} />
      {addLabel && onAdd ? (
        <button
          className={styles.lightboxAdd}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}
