import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { packXlsxWithEmbeddedImages, type ExcelSheetRow } from "@/lib/excel-xlsx";
import { mapPool } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";

const IMAGE_CONCURRENCY = 6;
const MAX_IMAGE_BYTES = 4500;
const TOTAL_IMAGES_BUDGET = 8 * 1024 * 1024;

export type ExcelExportPayload = {
  filename: string;
  sheetName: string;
  rows: ExcelSheetRow[];
  imageStoragePaths?: Array<string | null | undefined>;
  imageUrls?: Array<string | null | undefined>;
  imageColumnLabel?: string;
  linkColumn?: string;
  linkUrls?: Array<string | null | undefined>;
  linkLabel?: string;
};

async function compressJpeg(input: Buffer) {
  const attempts: Array<{ width: number; quality: number }> = [
    { width: 72, quality: 40 },
    { width: 64, quality: 32 },
    { width: 48, quality: 26 },
  ];
  let best: Buffer | null = null;
  for (const attempt of attempts) {
    const out = await sharp(input)
      .rotate()
      .resize(attempt.width, attempt.width, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= MAX_IMAGE_BYTES) return out;
    if (!best || out.length < best.length) best = out;
  }
  return best && best.length <= MAX_IMAGE_BYTES * 1.4 ? best : null;
}

async function loadThumb(
  supabase: SupabaseClient,
  source: { path?: string | null; url?: string | null }
) {
  try {
    if (source.path) {
      const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(source.path);
      if (error || !data) return null;
      const buf = Buffer.from(await data.arrayBuffer());
      return compressJpeg(buf);
    }
    if (source.url) {
      const response = await fetch(source.url);
      if (!response.ok) return null;
      const buf = Buffer.from(await response.arrayBuffer());
      return compressJpeg(buf);
    }
  } catch {
    return null;
  }
  return null;
}

export async function buildExcelWithImagesBuffer(
  supabase: SupabaseClient,
  payload: ExcelExportPayload
) {
  const {
    sheetName,
    rows,
    imageStoragePaths,
    imageUrls,
    imageColumnLabel = "صورة",
    linkColumn,
    linkUrls,
    linkLabel = "فتح الملف",
  } = payload;

  const hasImages = Boolean(imageStoragePaths?.some((path) => path) || imageUrls?.some((url) => url));
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

  const thumbs = new Map<string, Buffer>();
  let used = 0;
  if (uniqueSources.size) {
    const fetched = await mapPool([...uniqueSources.values()], IMAGE_CONCURRENCY, async (source) => {
      const thumb = await loadThumb(supabase, source);
      return [source.key, thumb] as const;
    });
    for (const [key, thumb] of fetched) {
      if (!thumb) continue;
      if (used + thumb.length > TOTAL_IMAGES_BUDGET) continue;
      used += thumb.length;
      thumbs.set(key, thumb);
    }
  }

  const imagesByRow = hasImages
    ? rows.map((_, index) => {
        const path = imageStoragePaths?.[index]?.trim();
        const url = imageUrls?.[index]?.trim();
        const key = path || url;
        return key ? thumbs.get(key) : undefined;
      })
    : undefined;

  return packXlsxWithEmbeddedImages({
    sheetName,
    rows,
    imageColumnLabel,
    imagesByRow,
    linkColumn,
    linkUrls,
    linkLabel,
  });
}
