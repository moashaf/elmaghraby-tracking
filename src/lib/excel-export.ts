import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { mapPool, withTimeout } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";
import { createClient } from "@/lib/supabase/client";

type ImageExtension = "jpeg" | "png" | "gif";
type ExcelImage = { base64: string; extension: ImageExtension };

const EXCEL_IMAGE_MAX_EDGE = 140;
const EXCEL_IMAGE_QUALITY = 0.6;
const IMAGE_FETCH_CONCURRENCY = 4;
const IMAGE_DOWNLOAD_MS = 8000;
const IMAGE_DECODE_MS = 2500;

function triggerDownload(buffer: ArrayBuffer | Uint8Array, filename: string) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadImageBytes(
  supabase: ReturnType<typeof createClient>,
  source: { path?: string | null; url?: string | null }
) {
  try {
    if (source.path) {
      const result = await withTimeout(supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(source.path), IMAGE_DOWNLOAD_MS);
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
    if (!base64) return null;
    return { base64, extension: "jpeg" };
  } catch {
    return null;
  }
}

async function loadExcelImage(
  supabase: ReturnType<typeof createClient>,
  source: { key: string; path?: string | null; url?: string | null }
) {
  const bytes = await downloadImageBytes(supabase, source);
  if (!bytes) return [source.key, null] as const;
  const image = await compressImageForExcel(bytes);
  return [source.key, image] as const;
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
  if (hasImages) worksheet.getColumn(columns.length + 1).width = 14;

  const uniqueSources = new Map<string, { key: string; path?: string | null; url?: string | null }>();
  const rowCount = rows.length;
  for (let index = 0; index < rowCount; index += 1) {
    const path = imageStoragePaths?.[index]?.trim();
    const url = imageUrls?.[index]?.trim();
    const key = path || url;
    if (!key || uniqueSources.has(key)) continue;
    uniqueSources.set(key, { key, path: path || null, url: url || null });
  }

  const compressedByKey = new Map<string, ExcelImage>();
  const supabase = createClient();
  const fetched = await mapPool([...uniqueSources.values()], IMAGE_FETCH_CONCURRENCY, async (source) =>
    loadExcelImage(supabase, source)
  );
  for (const [key, image] of fetched) {
    if (image) compressedByKey.set(key, image);
  }

  const imageIdByKey = new Map<string, number>();
  for (const [key, image] of compressedByKey) {
    imageIdByKey.set(
      key,
      workbook.addImage({
        base64: image.base64,
        extension: image.extension,
      })
    );
  }

  for (let index = 0; index < rowCount; index += 1) {
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
    const url = imageUrls?.[index]?.trim();
    const key = path || url;
    const imageId = key ? imageIdByKey.get(key) : undefined;
    if (imageId == null) continue;

    worksheet.getRow(rowNumber).height = 54;
    worksheet.addImage(imageId, {
      tl: { col: columns.length, row: rowNumber - 1 },
      ext: { width: 72, height: 52 },
    });

    if (index > 0 && index % 40 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, filename);
}
