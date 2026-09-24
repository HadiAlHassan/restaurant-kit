const maxEdge = 1400;

/**
 * Customer photos come straight off a phone. Shrink them to a web-sized JPEG before upload so they
 * stay far below the Worker's 5 MB limit (and fit localStorage in local-dev mode).
 * Falls back to the original file when the browser cannot decode it.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "review-photo"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
