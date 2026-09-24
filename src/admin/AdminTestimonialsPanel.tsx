import { ArrowDown, ArrowUp, EyeOff, ImagePlus, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMenuApi } from "../config/siteConfigContext";
import type { DynamicMenu, Testimonial } from "../menu/menuSchema";
import { downscaleImage } from "../testimonials/downscaleImage";
import {
  addTestimonial,
  clampRating,
  createTestimonialDraft,
  deleteTestimonial,
  moveTestimonial,
  sortedTestimonials,
  updateTestimonial,
} from "../testimonials/testimonialMutations";
import { getApiErrorMessage, imageSource } from "./adminEditorUtils";
import editorStyles from "./AdminMenuEditor.module.css";
import styles from "./AdminTestimonialsPanel.module.css";

type AdminTestimonialsPanelProps = {
  readonly menu: DynamicMenu;
  readonly applyMenuMutation: (mutateMenu: (menu: DynamicMenu) => DynamicMenu) => void;
};

const ratingChoices = [1, 2, 3, 4, 5];

export function AdminTestimonialsPanel({ menu, applyMenuMutation }: AdminTestimonialsPanelProps) {
  const menuApi = useMenuApi();
  const testimonials = sortedTestimonials(menu);
  const [editingId, setEditingId] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const editing = testimonials.find((testimonial) => testimonial.id === editingId) ?? null;

  const update = (testimonialId: string, patch: Partial<Testimonial>) => applyMenuMutation((current) => updateTestimonial(current, testimonialId, patch));

  const add = () => {
    const testimonial = createTestimonialDraft();
    applyMenuMutation((current) => addTestimonial(current, testimonial));
    setEditingId(testimonial.id);
  };

  const deleteImageQuietly = (imageKey: string | undefined) => {
    if (imageKey) menuApi.deleteMenuImage(imageKey).catch(() => undefined);
  };

  const remove = (testimonial: Testimonial) => {
    if (!window.confirm(`Delete the review from "${testimonial.author || "this customer"}"?`)) return;
    applyMenuMutation((current) => deleteTestimonial(current, testimonial.id));
    deleteImageQuietly(testimonial.imageKey);
    setEditingId("");
    toast.success("Review deleted");
  };

  const uploadImage = async (testimonial: Testimonial, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }

    setUploadingId(testimonial.id);
    try {
      const upload = await menuApi.uploadMenuImage(await downscaleImage(file));
      update(testimonial.id, { image: upload.url, imageKey: upload.key });
      deleteImageQuietly(testimonial.imageKey);
      toast.success("Photo uploaded");
    } catch (error) {
      toast.error("Could not upload photo", { description: getApiErrorMessage(error) });
    } finally {
      setUploadingId("");
    }
  };

  const removeImage = (testimonial: Testimonial) => {
    update(testimonial.id, { image: undefined, imageKey: undefined });
    deleteImageQuietly(testimonial.imageKey);
  };

  return (
    <section className={editorStyles.menuEditor} aria-label="Customer reviews">
      <div className={editorStyles.catalog}>
        <div className={editorStyles.catalogActions}>
          <div>
            <p className="micro-label">Testimonials section</p>
            <h2>Customer reviews</h2>
          </div>
          <div className={editorStyles.catalogButtons}>
            <button className={editorStyles.primaryButton} type="button" onClick={add}>
              <Plus aria-hidden="true" />
              Add review
            </button>
          </div>
        </div>
        <p className={styles.hint}>
          Copy reviews from your Google Maps page — the text, the customer&apos;s name, and the photo they posted. The section appears on the site once at least one review is
          visible, and disappears again when there are none. Changes go live when you publish.
        </p>

        {testimonials.length ? (
          <ol className={styles.list}>
            {testimonials.map((testimonial, index) => (
              <li className={`${styles.row} ${testimonial.isVisible ? "" : styles.hiddenRow}`} key={testimonial.id}>
                <div className={styles.thumb}>{testimonial.image ? <img src={imageSource(testimonial.image)} alt="" /> : <ImagePlus aria-hidden="true" />}</div>
                <div className={styles.rowText}>
                  <strong>
                    {testimonial.author || "Unnamed customer"}
                    <span className={styles.rowStars} aria-label={`${clampRating(testimonial.rating)} stars`}>
                      {"★".repeat(clampRating(testimonial.rating))}
                    </span>
                    {testimonial.isVisible ? null : (
                      <span className={styles.hiddenBadge}>
                        <EyeOff aria-hidden="true" />
                        Hidden
                      </span>
                    )}
                  </strong>
                  <p>{testimonial.text || "No review text yet — customers will not see this one."}</p>
                </div>
                <div className={styles.rowActions}>
                  <button
                    className={editorStyles.iconButton}
                    type="button"
                    onClick={() => applyMenuMutation((current) => moveTestimonial(current, testimonial.id, -1))}
                    disabled={index === 0}
                    aria-label="Move review up"
                  >
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    className={editorStyles.iconButton}
                    type="button"
                    onClick={() => applyMenuMutation((current) => moveTestimonial(current, testimonial.id, 1))}
                    disabled={index === testimonials.length - 1}
                    aria-label="Move review down"
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <button className={editorStyles.secondaryButton} type="button" onClick={() => setEditingId(testimonial.id)}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={editorStyles.emptyState}>
            <h2>No reviews yet.</h2>
            <button className={editorStyles.primaryButton} type="button" onClick={add}>
              Add your first review
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <aside className={editorStyles.editorDrawer} aria-label="Edit customer review">
          <div className={editorStyles.drawerHeader}>
            <div>
              <p className="micro-label">Edit review</p>
              <h2>{editing.author || "New review"}</h2>
            </div>
            <button className={editorStyles.iconButton} type="button" onClick={() => setEditingId("")} aria-label="Close review editor">
              x
            </button>
          </div>

          <div className={editorStyles.drawerFields}>
            <div className={editorStyles.drawerImageBlock}>
              {editing.image ? (
                <figure className={editorStyles.drawerMedia}>
                  <img src={imageSource(editing.image)} alt="" />
                  <figcaption className={editorStyles.drawerImageOverlay} aria-label="Photo actions">
                    <label className={editorStyles.drawerImageTool} htmlFor="review-photo-upload" aria-disabled={uploadingId === editing.id}>
                      <ImagePlus aria-hidden="true" />
                      {uploadingId === editing.id ? "Uploading" : "Replace"}
                    </label>
                    <button
                      className={`${editorStyles.drawerImageTool} ${editorStyles.dangerImageTool}`}
                      type="button"
                      onClick={() => removeImage(editing)}
                      disabled={uploadingId === editing.id}
                    >
                      <Trash2 aria-hidden="true" />
                      Remove
                    </button>
                  </figcaption>
                </figure>
              ) : (
                <label className={editorStyles.drawerMediaEmpty} htmlFor="review-photo-upload" aria-disabled={uploadingId === editing.id}>
                  <ImagePlus aria-hidden="true" />
                  {uploadingId === editing.id ? "Uploading photo" : "Add the customer's photo (optional)"}
                </label>
              )}
              <input
                className={editorStyles.fileInput}
                id="review-photo-upload"
                type="file"
                accept="image/*"
                disabled={uploadingId === editing.id}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadImage(editing, file);
                }}
              />
            </div>

            <div className={editorStyles.fieldGroup}>
              <label htmlFor="review-author">Customer name</label>
              <input id="review-author" value={editing.author} onChange={(event) => update(editing.id, { author: event.target.value })} placeholder="e.g. Rami K." />
              <small>As shown on Google, or shortened if you prefer.</small>
            </div>

            <div className={editorStyles.fieldGroup}>
              <label id="review-rating-label">Rating</label>
              <div className={styles.ratingPicker} role="radiogroup" aria-labelledby="review-rating-label">
                {ratingChoices.map((value) => (
                  <button
                    className={value <= clampRating(editing.rating) ? styles.filledStar : ""}
                    type="button"
                    role="radio"
                    aria-checked={value === clampRating(editing.rating)}
                    aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    key={value}
                    onClick={() => update(editing.id, { rating: value })}
                  >
                    <Star aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className={editorStyles.fieldGroup}>
              <label htmlFor="review-text">Review</label>
              <textarea
                id="review-text"
                className={`${editorStyles.drawerTextarea} ${styles.reviewTextarea}`}
                value={editing.text}
                onChange={(event) => update(editing.id, { text: event.target.value })}
                placeholder="Paste the customer's words exactly as they wrote them."
              />
              <small>Long reviews are trimmed to about eight lines on the card.</small>
            </div>

            <div className={editorStyles.fieldGroup}>
              <label htmlFor="review-source">Link to the review</label>
              <input
                id="review-source"
                inputMode="url"
                value={editing.sourceUrl ?? ""}
                onChange={(event) => update(editing.id, { sourceUrl: event.target.value.trim() || undefined })}
                placeholder="https://maps.app.goo.gl/…"
              />
              <small>Optional. In Google Maps: open the review → Share → copy link. Adds “Read on Google”.</small>
            </div>

            <label className={editorStyles.checkboxLabel}>
              <input type="checkbox" checked={editing.isVisible} onChange={(event) => update(editing.id, { isVisible: event.target.checked })} />
              Visible on the site
            </label>
          </div>

          <div className={editorStyles.drawerActions}>
            <button className={editorStyles.secondaryButton} type="button" onClick={() => remove(editing)}>
              <Trash2 aria-hidden="true" />
              Delete review
            </button>
            <button className={editorStyles.primaryButton} type="button" onClick={() => setEditingId("")}>
              Done
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
