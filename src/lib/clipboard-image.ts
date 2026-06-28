import type { ClipboardEvent } from "react";

/** Extract an image file from a paste event (e.g. copy from Excel). */
export function fileFromClipboardEvent(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (!item.type.startsWith("image/")) continue;
    const blob = item.getAsFile();
    if (!blob) continue;
    const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });
  }

  return null;
}
