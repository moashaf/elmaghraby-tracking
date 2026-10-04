import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { mapPool } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";

const THUMB_CONCURRENCY = 8;
const MAX_THUMB_BYTES = 12000;
const TOTAL_THUMBS_BUDGET = 7 * 1024 * 1024;
const FETCH_MS = 8000;

function xlsxFilename(name: string) {
  return name.toLowerCase().endsWith(".xlsx") ? name : `${name.replace(/\.xls$/i, "")}.xlsx`;
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(
    new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = xlsxFilename(filename);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function jpegThumb(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (bytes.length <= MAX_THUMB_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8) return bytes;
  if (typeof createImageBitmap !== "function") return null;

  try {
    const bitmap = await createImageBitmap(
      new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer])
    );
    const scale = Math.min(72 / bitmap.width, 72 / bitmap.height, 1);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.38));
    if (!blob || blob.size > MAX_THUMB_BYTES * 2) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function thumbFromPath(path: string) {
  const signed = await createClient()
    .storage.from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(path, 120, {
      transform: { width: 72, height: 72, resize: "contain", quality: 40 },
    });
  const url = signed.error ? null : signed.data?.signedUrl;
  if (!url) return null;
  const bytes = await fetchWithTimeout(url);
  if (!bytes?.length) return null;
  return jpegThumb(bytes);
}

async function thumbFromUrl(url: string) {
  const bytes = await fetchWithTimeout(url);
  if (!bytes?.length) return null;
  return jpegThumb(bytes);
}

export async function downloadExcelWithOptionalImages(options: {
  filename: string;
  sheetName: string;
  rows: Record<string, string | number | null>[];
  imageUrls?: Array<string | null | undefined>;
  imageStoragePaths?: Array<string | null | undefined>;
  imageColumnLabel?: string;
  linkColumn?: string;
  linkUrls?: Array<string | null | undefined>;
  linkLabel?: string;
}) {
  const hasImages = Boolean(
    options.imageStoragePaths?.some((path) => path) || options.imageUrls?.some((url) => url)
  );
  const hasLinks = Boolean(options.linkColumn && options.linkUrls?.some((url) => url));
  const filename = xlsxFilename(options.filename);

  if (!hasImages && !hasLinks) {
    const worksheet = XLSX.utils.json_to_sheet(options.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName);
    XLSX.writeFile(workbook, filename);
    return;
  }

  const uniqueSources = new Map<string, { path?: string; url?: string }>();
  const rowCount = options.rows.length;
  for (let index = 0; index < rowCount; index += 1) {
    const path = options.imageStoragePaths?.[index]?.trim();
    const url = options.imageUrls?.[index]?.trim();
    const key = path || url;
    if (!key || uniqueSources.has(key)) continue;
    uniqueSources.set(key, { path: path || undefined, url: url || undefined });
  }

  const thumbs = new Map<string, Uint8Array>();
  let used = 0;
  const fetched = await mapPool([...uniqueSources.entries()], THUMB_CONCURRENCY, async ([key, source]) => {
    const thumb = source.path ? await thumbFromPath(source.path) : source.url ? await thumbFromUrl(source.url) : null;
    return [key, thumb] as const;
  });
  for (const [key, thumb] of fetched) {
    if (!thumb) continue;
    if (used + thumb.length > TOTAL_THUMBS_BUDGET) continue;
    used += thumb.length;
    thumbs.set(key, thumb);
  }

  const imagesByRow = hasImages
    ? options.rows.map((_, index) => {
        const path = options.imageStoragePaths?.[index]?.trim();
        const url = options.imageUrls?.[index]?.trim();
        const key = path || url;
        return key ? thumbs.get(key) : undefined;
      })
    : undefined;

  const { packXlsxWithEmbeddedImages } = await import("@/lib/excel-xlsx");
  const bytes = await packXlsxWithEmbeddedImages({
    sheetName: options.sheetName,
    rows: options.rows,
    imageColumnLabel: options.imageColumnLabel,
    imagesByRow,
    linkColumn: options.linkColumn,
    linkUrls: options.linkUrls,
    linkLabel: options.linkLabel,
  });

  triggerDownload(bytes, filename);
}
