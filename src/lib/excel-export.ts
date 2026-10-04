import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { mapPool, withTimeout } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";
import { createClient } from "@/lib/supabase/client";

const IMAGE_FETCH_CONCURRENCY = 6;
const IMAGE_DOWNLOAD_MS = 6000;
const IMAGE_DECODE_MS = 2000;
const MAX_IMAGE_BYTES = 4500;
const TOTAL_IMAGES_BUDGET = 8 * 1024 * 1024;

function triggerDownload(buffer: ArrayBuffer | Uint8Array, filename: string) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const blob = new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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

async function canvasToJpeg(bitmap: ImageBitmap, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 1500);
    canvas.toBlob(
      (blob) => {
        window.clearTimeout(timer);
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressImageForExcel(buffer: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const bitmap = await withTimeout(createImageBitmap(new Blob([new Uint8Array(buffer)])), IMAGE_DECODE_MS);
    if (!bitmap) return null;

    const attempts: Array<{ edge: number; quality: number }> = [
      { edge: 72, quality: 0.42 },
      { edge: 64, quality: 0.34 },
      { edge: 56, quality: 0.28 },
      { edge: 48, quality: 0.22 },
    ];

    let best: Uint8Array | null = null;
    for (const attempt of attempts) {
      const blob = await canvasToJpeg(bitmap, attempt.edge, attempt.quality);
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength <= MAX_IMAGE_BYTES) {
        bitmap.close();
        return bytes;
      }
      if (!best || bytes.byteLength < best.byteLength) best = bytes;
    }

    bitmap.close();
    if (best && best.byteLength <= MAX_IMAGE_BYTES * 1.4) return best;
    return null;
  } catch {
    return null;
  }
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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const columns = rows.length ? Object.keys(rows[0] ?? {}) : [];
  const headers = hasImages ? [...columns, imageColumnLabel] : columns;

  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  if (hasImages) worksheet.getColumn(columns.length + 1).width = 12;

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

  const compressedByKey = new Map<string, Uint8Array>();
  let usedBytes = 0;
  if (uniqueSources.size) {
    const supabase = createClient();
    const fetched = await mapPool([...uniqueSources.values()], IMAGE_FETCH_CONCURRENCY, async (source) => {
      const bytes = await downloadImageBytes(supabase, source);
      if (!bytes) return [source.key, null] as const;
      return [source.key, await compressImageForExcel(bytes)] as const;
    });
    for (const [key, image] of fetched) {
      if (!image) continue;
      if (usedBytes + image.byteLength > TOTAL_IMAGES_BUDGET) continue;
      usedBytes += image.byteLength;
      compressedByKey.set(key, image);
    }
  }

  const imageIdByKey = new Map<string, number>();
  for (const [key, image] of compressedByKey) {
    imageIdByKey.set(
      key,
      workbook.addImage({
        buffer: image as unknown as ExcelJS.Buffer,
        extension: "jpeg",
      })
    );
  }

  for (let index = 0; index < rows.length; index += 1) {
    const values = columns.map((column) => rows[index]?.[column] ?? "");
    if (hasImages) values.push("");
    const rowNumber = worksheet.addRow(values).number;

    if (linkColumn) {
      const linkIndex = columns.indexOf(linkColumn);
      const url = linkUrls?.[index];
      if (linkIndex >= 0 && url) {
        const cell = worksheet.getCell(rowNumber, linkIndex + 1);
        cell.value = { text: linkLabel, hyperlink: url };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    const path = imageStoragePaths?.[index]?.trim();
    const href = imageUrls?.[index]?.trim();
    const key = path || href;
    const imageId = key ? imageIdByKey.get(key) : undefined;
    if (imageId == null) continue;

    worksheet.getRow(rowNumber).height = 48;
    worksheet.addImage(imageId, {
      tl: { col: columns.length, row: rowNumber - 1 },
      ext: { width: 64, height: 46 },
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
