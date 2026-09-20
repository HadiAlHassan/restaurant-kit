import { Crop as CropIcon, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactCrop, { centerCrop, convertToPixelCrop, makeAspectCrop, type Crop, type PercentCrop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { sortByOrder } from "../menu/menuOrdering";
import { priceFromInput, priceInputValue, type PriceCurrency } from "../menu/priceFormat";
import type { MenuItem, MenuSize } from "../menu/menuSchema";
import { formatPrice, imageSource } from "./adminEditorUtils";
import styles from "./AdminMenuEditor.module.css";

function RemovableIngredientsField({ ingredients, onChange }: { ingredients: readonly string[]; onChange: (next: readonly string[]) => void }) {
  const [draft, setDraft] = useState("");

  const commitDraft = (value: string) => {
    const ingredient = value.trim().replace(/,+$/, "").trim();
    setDraft("");
    if (!ingredient) return;
    if (ingredients.some((existing) => existing.toLowerCase() === ingredient.toLowerCase())) return;
    onChange([...ingredients, ingredient]);
  };

  return (
    <div className={styles.fieldGroup}>
      <label htmlFor="item-removable-ingredients">Removable ingredients</label>
      <div className={styles.chipBox}>
        {ingredients.map((ingredient) => (
          <span className={styles.chip} key={ingredient}>
            {ingredient}
            <button type="button" onClick={() => onChange(ingredients.filter((entry) => entry !== ingredient))} aria-label={`Remove ${ingredient}`}>
              <X aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id="item-removable-ingredients"
          className={styles.chipField}
          value={draft}
          placeholder={ingredients.length ? "Add another…" : "e.g. pickles, garlic sauce"}
          onChange={(event) => {
            if (event.target.value.endsWith(",")) {
              commitDraft(event.target.value);
              return;
            }
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft(draft);
            }
          }}
          onBlur={() => commitDraft(draft)}
        />
      </div>
      <small>Customers can untick these when ordering. Press Enter or comma to add.</small>
    </div>
  );
}

function PriceField({ id, label, value, onChange }: { readonly id: string; readonly label: string; readonly value: string; readonly onChange: (price: string) => void }) {
  // Remember the chosen currency so clearing the amount does not snap an LBP price back to USD.
  const [lastCurrency, setLastCurrency] = useState<PriceCurrency>(() => priceInputValue(value).currency);
  const price = priceInputValue(value, lastCurrency);

  const updateAmount = (amount: string) => {
    onChange(priceFromInput(amount, price.currency));
  };

  const updateCurrency = (currency: PriceCurrency) => {
    setLastCurrency(currency);
    onChange(priceFromInput(price.amount, currency));
  };

  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.priceField}>
        <input id={id} inputMode="decimal" value={price.amount} onChange={(event) => updateAmount(event.target.value)} placeholder="7.50" />
        <div className={styles.currencyToggle} aria-label={`${label} currency`}>
          <button className={price.currency === "USD" ? styles.selectedCurrency : ""} type="button" onClick={() => updateCurrency("USD")}>
            USD
          </button>
          <button className={price.currency === "LBP" ? styles.selectedCurrency : ""} type="button" onClick={() => updateCurrency("LBP")}>
            LBP
          </button>
        </div>
      </div>
    </div>
  );
}

type AdminItemDrawerProps = {
  isUploadingImage: boolean;
  item: MenuItem;
  onAddSize: () => void;
  onClose: () => void;
  onDelete: () => void;
  onRemoveImage: () => void;
  onRemoveSize: (sizeId: string) => void;
  onUpdate: (patch: Partial<MenuItem>) => void;
  onUpdateSize: (sizeId: string, patch: Partial<MenuSize>) => void;
  onUploadImage: (file: File) => void;
};

type PendingCrop = {
  readonly file: File;
  readonly url: string;
};

const cropAspect = 3 / 2;

function centeredCropForImage(width: number, height: number): PercentCrop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 92,
      },
      cropAspect,
      width,
      height,
    ),
    width,
    height,
  );
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not crop image."));
    }, "image/jpeg", 0.92);
  });
}

async function cropImageFile(file: File, image: HTMLImageElement, crop: PixelCrop) {
  const canvas = document.createElement("canvas");
  const outputWidth = 1200;
  const outputHeight = 800;
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image crop.");

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
  const blob = await canvasToBlob(canvas);
  const croppedName = file.name.replace(/\.[^.]+$/, "") || "menu-image";
  return new File([blob], `${croppedName}-cropped.jpg`, { type: "image/jpeg" });
}

export function AdminItemDrawer({ isUploadingImage, item, onAddSize, onClose, onDelete, onRemoveImage, onRemoveSize, onUpdate, onUpdateSize, onUploadImage }: AdminItemDrawerProps) {
  const hasImage = Boolean(item.image);
  const imageInputId = `drawer-image-upload-${item.id}`;
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropError, setCropError] = useState("");
  const cropImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    return () => {
      if (pendingCrop) URL.revokeObjectURL(pendingCrop.url);
    };
  }, [pendingCrop]);

  const closeCropper = () => {
    if (pendingCrop) URL.revokeObjectURL(pendingCrop.url);
    setPendingCrop(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setIsCropping(false);
    setCropError("");
  };

  const openCropper = (file: File) => {
    if (pendingCrop) URL.revokeObjectURL(pendingCrop.url);
    setPendingCrop({ file, url: URL.createObjectURL(file) });
    setCrop(undefined);
    setCompletedCrop(null);
    setCropError("");
  };

  const openCurrentImageCropper = async () => {
    if (!item.image) return;
    setCropError("");

    try {
      const response = await fetch(imageSource(item.image));
      if (!response.ok) throw new Error("Could not load image.");
      const blob = await response.blob();
      const file = new File([blob], `${item.title || "menu-image"}.jpg`, { type: blob.type || "image/jpeg" });
      openCropper(file);
    } catch {
      setCropError("Could not open this image for cropping. Choose the source file again to crop it.");
    }
  };

  const uploadCroppedImage = async () => {
    if (!pendingCrop) return;
    if (!cropImageRef.current || !completedCrop?.width || !completedCrop.height) {
      setCropError("Choose a crop area before uploading.");
      return;
    }

    setIsCropping(true);
    try {
      const croppedFile = await cropImageFile(pendingCrop.file, cropImageRef.current, completedCrop);
      onUploadImage(croppedFile);
      closeCropper();
    } catch {
      setCropError("Could not crop this image. Try another file.");
      setIsCropping(false);
    }
  };

  const initializeCrop = (image: HTMLImageElement) => {
    const nextCrop = centeredCropForImage(image.width, image.height);
    setCrop(nextCrop);
    setCompletedCrop(convertToPixelCrop(nextCrop, image.width, image.height));
  };

  return (
    <aside className={styles.editorDrawer} aria-label="Edit menu item details">
      <div className={styles.drawerHeader}>
        <div>
          <p className="micro-label">Edit item</p>
          <h2>{item.title}</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close item editor">
          x
        </button>
      </div>

      <div className={styles.drawerFields}>
        <div className={styles.drawerImageBlock}>
          {hasImage ? (
            <figure className={styles.drawerMedia}>
              <img src={imageSource(item.image)} alt="" />
              <figcaption className={styles.drawerImageOverlay} aria-label="Image actions">
                <label className={styles.drawerImageTool} htmlFor={imageInputId} aria-disabled={isUploadingImage}>
                  <ImagePlus aria-hidden="true" />
                  {isUploadingImage ? "Uploading" : "Replace"}
                </label>
                <button className={styles.drawerImageTool} type="button" onClick={() => void openCurrentImageCropper()} disabled={isUploadingImage}>
                  <CropIcon aria-hidden="true" />
                  Crop
                </button>
                <button className={`${styles.drawerImageTool} ${styles.dangerImageTool}`} type="button" onClick={onRemoveImage} disabled={isUploadingImage}>
                  <Trash2 aria-hidden="true" />
                  Remove
                </button>
              </figcaption>
            </figure>
          ) : (
            <label className={styles.drawerMediaEmpty} htmlFor={imageInputId} aria-disabled={isUploadingImage}>
              <ImagePlus aria-hidden="true" />
              {isUploadingImage ? "Uploading image" : "Choose & crop image"}
            </label>
          )}
          <input
            className={styles.fileInput}
            id={imageInputId}
            type="file"
            accept="image/*"
            disabled={isUploadingImage}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) openCropper(file);
            }}
          />
          {cropError ? <p className={styles.inlineError}>{cropError}</p> : null}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="item-title">Name</label>
          <input id="item-title" value={item.title} onChange={(event) => onUpdate({ title: event.target.value })} />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="item-description">Description</label>
          <textarea id="item-description" className={styles.drawerTextarea} value={item.description} onChange={(event) => onUpdate({ description: event.target.value })} placeholder="Shown under the item name" />
        </div>

        <RemovableIngredientsField ingredients={item.removableIngredients ?? []} onChange={(next) => onUpdate({ removableIngredients: next.length ? next : undefined })} />

        <div className={styles.fieldGroup}>
          <label htmlFor="item-image">Image path or URL</label>
          <input id="item-image" value={item.image} onChange={(event) => onUpdate({ image: event.target.value, imageKey: undefined })} placeholder="assets/menu/..." />
          <small>Optional. Manual paths are treated as external/static images.</small>
        </div>

        <div className={styles.segmented}>
          <button className={item.pricingMode === "single" ? styles.selectedSegment : ""} type="button" onClick={() => onUpdate({ pricingMode: "single", sizes: [] })}>
            Single price
          </button>
          <button className={item.pricingMode === "sizes" ? styles.selectedSegment : ""} type="button" onClick={() => onUpdate({ pricingMode: "sizes" })}>
            Size prices
          </button>
        </div>

        {item.pricingMode === "single" ? (
          <PriceField id="item-price" label="Price" value={item.price} onChange={(price) => onUpdate({ price })} />
        ) : (
          <div className={styles.sizeEditor}>
            <div className={styles.sizeHeader}>
              <h3>Sizes</h3>
              <button type="button" onClick={onAddSize}>
                <Plus aria-hidden="true" />
                Add size
              </button>
            </div>
            {sortByOrder(item.sizes).map((size) => (
              <div className={styles.sizeRow} key={size.id}>
                <input aria-label="Size label" value={size.label} onChange={(event) => onUpdateSize(size.id, { label: event.target.value })} />
                <PriceField id={`size-price-${size.id}`} label="Size price" value={size.price} onChange={(price) => onUpdateSize(size.id, { price })} />
                <button type="button" onClick={() => onRemoveSize(size.id)} aria-label="Remove size">
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={item.isVisible} onChange={(event) => onUpdate({ isVisible: event.target.checked })} />
          Visible on public menu
        </label>

        <div className={styles.drawerPreview}>
          <span>Customer price</span>
          <strong>{item.pricingMode === "sizes" ? "Shown in size buttons" : formatPrice(item.price) || "M.P."}</strong>
        </div>
      </div>

      <div className={styles.drawerActions}>
        <button className={styles.secondaryButton} type="button" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete item
        </button>
        <button className={styles.primaryButton} type="button" onClick={onClose}>
          Done
        </button>
      </div>

      {pendingCrop ? (
        <div className={styles.cropModalBackdrop} role="presentation">
          <div className={styles.cropModal} role="dialog" aria-modal="true" aria-labelledby="crop-menu-image-title">
            <div className={styles.cropHeader}>
              <div>
                <p className="micro-label">Crop image</p>
                <h3 id="crop-menu-image-title">Frame the menu photo</h3>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeCropper} aria-label="Close cropper">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={styles.cropStage}>
              <ReactCrop
                aspect={cropAspect}
                crop={crop}
                keepSelection
                minWidth={160}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                ruleOfThirds
              >
                <img ref={cropImageRef} src={pendingCrop.url} alt="" onLoad={(event) => initializeCrop(event.currentTarget)} />
              </ReactCrop>
            </div>
            {cropError ? <p className={styles.inlineError}>{cropError}</p> : null}
            <div className={styles.cropActions}>
              <button className={styles.secondaryButton} type="button" onClick={closeCropper}>
                Cancel
              </button>
              <button className={styles.primaryButton} type="button" onClick={() => void uploadCroppedImage()} disabled={isCropping || isUploadingImage}>
                {isCropping || isUploadingImage ? "Uploading" : "Use cropped image"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
