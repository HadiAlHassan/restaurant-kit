import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AdminAuthStrategy } from "../menu/menuApi";
import styles from "./AdminMenuEditor.module.css";

type AdminAuthPanelProps = {
  /** null while the API has not reported a strategy (unreachable, or still loading). */
  strategy: AdminAuthStrategy | null;
  isLoadingDraft: boolean;
  isSigningIn: boolean;
  message: string;
  onRetry: () => void;
  onSignInWithAccess: () => void;
  onSignInWithPassword: (password: string) => void;
};

const headings: Record<AdminAuthStrategy | "unknown", { eyebrow: string; title: string }> = {
  password: { eyebrow: "Owner sign-in", title: "Sign in to edit the menu" },
  access: { eyebrow: "Cloudflare Access", title: "Sign in to edit the remote menu" },
  none: { eyebrow: "Admin sign-in", title: "Admin sign-in is not configured" },
  local: { eyebrow: "Local draft", title: "Editing the local draft" },
  unknown: { eyebrow: "Menu API", title: "Could not reach the menu API" },
};

export function AdminAuthPanel({ strategy, isLoadingDraft, isSigningIn, message, onRetry, onSignInWithAccess, onSignInWithPassword }: AdminAuthPanelProps) {
  const [password, setPassword] = useState("");
  const heading = headings[strategy ?? "unknown"];

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    onSignInWithPassword(password);
  };

  return (
    <section className={styles.authPanel} aria-label="Admin sign-in required">
      <div>
        <p className="micro-label">{heading.eyebrow}</p>
        <h2>{heading.title}</h2>
        <p>{strategy === "none" ? "The menu Worker has no ADMIN_PASSWORD_HASH (or ADMIN_EMAILS) configured, so every admin request is denied." : message}</p>
      </div>

      {strategy === "password" ? (
        <form className={styles.authForm} onSubmit={submitPassword}>
          <label className={styles.authField}>
            <span>Password</span>
            <input
              autoComplete="current-password"
              autoFocus
              disabled={isSigningIn}
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={isSigningIn || !password}>
            <LogIn aria-hidden="true" />
            {isSigningIn ? "Signing in" : "Sign in"}
          </button>
        </form>
      ) : (
        <div className={styles.authActions}>
          {strategy === "access" ? (
            <button className={styles.primaryButton} type="button" onClick={onSignInWithAccess}>
              <LogIn aria-hidden="true" />
              Sign in with Cloudflare
            </button>
          ) : null}
          <button className={styles.secondaryButton} type="button" onClick={onRetry} disabled={isLoadingDraft}>
            {isLoadingDraft ? "Checking" : strategy === "access" ? "I signed in, retry" : "Retry"}
          </button>
        </div>
      )}
    </section>
  );
}
