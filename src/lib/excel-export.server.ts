import type { SupabaseClient } from "@supabase/supabase-js";
import { packXlsxWithEmbeddedImages, type ExcelSheetRow } from "@/lib/excel-xlsx";
import { mapPool } from "@/lib/map-pool";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage-path";

const IMAGE_CONCURRENCY = 6;
const MAX_IMAGE_BYTES = 8000;
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

async function compressIfNeeded(input: Buffer) {
  if (input.length <= MAX_IMAGE_BYTES && input[0] === 0xff && input[1] === 0xd8) return input;
  try {
    const { default: sharp } = await import("sharp");
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
  } catch {
    return null;
  }
}

async function loadThumb(
  supabase: SupabaseClient,
  source: { path?: string | null; url?: string | null }
) {
  try {
    if (source.path) {
      const transformed = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(source.path, 120, {
        transform: { width: 72, height: 72, resize: "contain", quality: 40 },
      });
      if (!transformed.error && transformed.data?.signedUrl) {
        const response = await fetch(transformed.data.signedUrl);
        if (response.ok) {
          const buf = Buffer.from(await response.arrayBuffer());
          const compressed = await compressIfNeeded(buf);
          if (compressed) return compressed;
        }
      }
      const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(source.path);
      if (error || !data) return null;
      return compressIfNeeded(Buffer.from(await data.arrayBuffer()));
    }
    if (source.url) {
      const response = await fetch(source.url);
      if (!response.ok) return null;
      return compressIfNeeded(Buffer.from(await response.arrayBuffer()));
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
