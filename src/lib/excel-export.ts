import * as XLSX from "xlsx";
import { mapPool, withTimeout } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";
import { createClient } from "@/lib/supabase/client";

type ExcelImage = { base64: string };

const EXCEL_IMAGE_MAX_EDGE = 120;
const EXCEL_IMAGE_QUALITY = 0.55;
const IMAGE_FETCH_CONCURRENCY = 6;
const IMAGE_DOWNLOAD_MS = 6000;
const IMAGE_DECODE_MS = 2000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadImageBytes(
  supabase: ReturnType<typeof createClient>,
  source: { path?: string | null; url?: string | null }
) {
  try {
    if (source.path) {
      const result = await withTimeout(
        supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(source.path),
        IMAGE_DOWNLOAD_MS
      );
      if (!result || result.error || !result.data) return null;
      return await withTimeout(result.data.arrayBuffer(), IMAGE_DOWNLOAD_MS);
    }

    if (source.url) {
      const response = await withTimeout(fetch(source.url), IMAGE_DOWNLOAD_MS);
      if (!response?.ok) return null;
      return await withTimeout(response.arrayBuffer(), IMAGE_DOWNLOAD_MS);
    }
  } catch {
    return null;
  }
  return null;
}

async function compressImageForExcel(buffer: ArrayBuffer): Promise<ExcelImage | null> {
  try {
    const bitmap = await withTimeout(createImageBitmap(new Blob([new Uint8Array(buffer)])), IMAGE_DECODE_MS);
    if (!bitmap) return null;

    const scale = Math.min(1, EXCEL_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height, 1));
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
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", EXCEL_IMAGE_QUALITY);
    const base64 = dataUrl.split(",")[1];
    return base64 ? { base64 } : null;
  } catch {
    return null;
  }
}

function downloadHtmlWorkbook(options: {
  filename: string;
  headers: string[];
  bodyRows: string[][];
}) {
  const head = options.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = options.bodyRows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>${head}</tr>${body}</table></body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const filename = options.filename.replace(/\.xlsx$/i, ".xls");
  triggerDownload(blob, filename);
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
  const {
    filename,
    sheetName,
    rows,
    imageUrls,
    imageStoragePaths,
    imageColumnLabel = "صورة",
    linkColumn,
    linkUrls,
    linkLabel = "فتح الملف",
  } = options;
  const hasImages = Boolean(
    imageStoragePaths?.some((path) => path) || imageUrls?.some((url) => url)
  );
  const hasLinks = Boolean(linkColumn && linkUrls?.some((url) => url));

  if (!hasImages && !hasLinks) {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
    return;
  }

  const columns = rows.length ? Object.keys(rows[0] ?? {}) : [];
  const headers = hasImages ? [...columns, imageColumnLabel] : columns;

  const uniqueSources = new Map<string, { key: string; path?: string | null; url?: string | null }>();
  if (hasImages) {
    for (let index = 0; index < rows.length; index += 1) {
      const path = imageStoragePaths?.[index]?.trim();
      const url = imageUrls?.[index]?.trim();
      const key = path || url;
      if (!key || uniqueSources.has(key)) continue;
      uniqueSources.set(key, { key, path: path || null, url: url || null });
    }
  }

  const compressedByKey = new Map<string, ExcelImage>();
  if (uniqueSources.size) {
    const supabase = createClient();
    const fetched = await mapPool([...uniqueSources.values()], IMAGE_FETCH_CONCURRENCY, async (source) => {
      const bytes = await downloadImageBytes(supabase, source);
      if (!bytes) return [source.key, null] as const;
      return [source.key, await compressImageForExcel(bytes)] as const;
    });
    for (const [key, image] of fetched) {
      if (image) compressedByKey.set(key, image);
    }
  }

  const bodyRows = rows.map((row, index) => {
    const cells = columns.map((column) => {
      if (hasLinks && column === linkColumn && linkUrls?.[index]) {
        const href = escapeHtml(String(linkUrls[index]));
        return `<a href="${href}">${escapeHtml(linkLabel)}</a>`;
      }
      return escapeHtml(String(row[column] ?? ""));
    });
    if (hasImages) {
      const path = imageStoragePaths?.[index]?.trim();
      const url = imageUrls?.[index]?.trim();
      const image = (path || url) ? compressedByKey.get(path || url || "") : undefined;
      cells.push(
        image
          ? `<img width="72" height="52" src="data:image/jpeg;base64,${image.base64}" />`
          : ""
      );
    }
    return cells;
  });

  downloadHtmlWorkbook({ filename, headers, bodyRows });
}
