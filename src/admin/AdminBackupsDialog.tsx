import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MenuBackup } from "../menu/menuApi";
import { getApiErrorMessage } from "./adminEditorUtils";
import styles from "./AdminMenuEditor.module.css";

type AdminBackupsDialogProps = {
  listBackups: () => Promise<readonly MenuBackup[]>;
  onClose: () => void;
  onRestore: (key: string) => void;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(bytes: number) {
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

/** Lists the backups written on each publish; restoring one overwrites the draft, not the live menu. */
export function AdminBackupsDialog({ listBackups, onClose, onRestore }: AdminBackupsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [backups, setBackups] = useState<readonly MenuBackup[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let isMounted = true;
    listBackups()
      .then((nextBackups) => {
        if (isMounted) setBackups(nextBackups);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setBackups([]);
        setErrorMessage(getApiErrorMessage(error));
      });
    return () => {
      isMounted = false;
    };
  }, [listBackups]);

  const confirmRestore = (backup: MenuBackup) => {
    if (!window.confirm(`Replace the draft with the menu as it was before the publish on ${formatWhen(backup.publishedAt)}? Unsaved edits are lost.`)) return;
    onRestore(backup.key);
  };

  return (
    <dialog className={styles.backupsDialog} ref={dialogRef} aria-labelledby="backups-title" onClose={onClose}>
      <div className={styles.backupsHeader}>
        <div>
          <p className="micro-label">Publish history</p>
          <h2 id="backups-title">Roll back to a backup</h2>
          <p>Each publish keeps a copy of the menu it replaced. Restoring loads that copy into the draft; nothing goes live until you publish again.</p>
        </div>
        <button className={styles.iconButton} type="button" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>

      {backups === null ? (
        <p className={styles.backupsEmpty}>Loading backups…</p>
      ) : backups.length === 0 ? (
        <p className={styles.backupsEmpty}>{errorMessage || "No backups yet. One is written every time you publish over an existing menu."}</p>
      ) : (
        <div className={styles.backupsList}>
          {backups.map((backup) => (
            <div className={styles.backupRow} key={backup.key}>
              <div>
                <strong>{formatWhen(backup.publishedAt)}</strong>
                <small>Menu before this publish · {formatSize(backup.size)}</small>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={() => confirmRestore(backup)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </dialog>
  );
}
