import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAdminDraftContext } from "../admin/useAdminDraft";
import { useRestaurantKit } from "../config/siteConfigContext";
import { MenuApiError } from "../menu/menuApi";
import type { DynamicMenu } from "../menu/menuSchema";
import { MenuSite } from "./MenuSite";
import styles from "./AdminPreview.module.css";

function getApiErrorMessage(error: unknown) {
  if (error instanceof MenuApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected menu API error.";
}

export function AdminPreview() {
  const providedDraft = useAdminDraftContext();
  const { seedMenu: fallbackMenu, menuApi } = useRestaurantKit();
  const [menu, setMenu] = useState<DynamicMenu>(fallbackMenu);
  const [status, setStatus] = useState<"loading" | "draft" | "fallback">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // With a provider above, the in-memory draft (unsaved edits included) is what gets previewed.
    if (providedDraft) return;

    let isMounted = true;

    menuApi
      .getDraftMenu()
      .then((draftMenu) => {
        if (!isMounted) return;
        setMenu(draftMenu);
        setStatus("draft");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setMenu(fallbackMenu);
        setStatus("fallback");
        setErrorMessage(getApiErrorMessage(error));
      });

    return () => {
      isMounted = false;
    };
  }, [fallbackMenu, menuApi, providedDraft]);

  const previewMenu = providedDraft ? providedDraft.draftMenu : menu;
  const previewStatus = providedDraft ? "draft" : status;
  const label = providedDraft
    ? providedDraft.hasUnsavedChanges
      ? "Draft preview (unsaved edits)"
      : "Draft preview"
    : status === "loading"
      ? "Loading draft preview"
      : status === "draft"
        ? "Draft preview"
        : "Seed preview";

  return (
    <>
      <div className={styles.previewBar} role="status">
        <div>
          <span>{label}</span>
          <strong>Same customer menu</strong>
          {errorMessage ? <small>{errorMessage}</small> : null}
        </div>
        <div className={styles.actions}>
          <Link to="/admin">Back to editor</Link>
          <Link to="/">Public site</Link>
        </div>
      </div>
      <MenuSite menuData={{ menu: previewMenu, status: previewStatus === "draft" ? "draft" : "local" }} />
    </>
  );
}
