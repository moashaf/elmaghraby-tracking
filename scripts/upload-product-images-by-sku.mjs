/**
 * Bulk-upload product images matched by SKU.
 * Filenames: #Item-010670.jpg OR 010067.jpg (gallery -2/-3 used only if no primary)
 *
 *   node scripts/upload-product-images-by-sku.mjs
 *   node scripts/upload-product-images-by-sku.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, resolve, extname } from "path";

const IMAGES_DIR = "D:/New folder/products-export-2026-06-29/images";
const BUCKET = "product-images";
const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = 4;

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

function skuFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, "").trim();
  let code = base;
  const hashed = code.match(/^#item-(.+)$/i);
  if (hashed) code = hashed[1].trim();
  const variant = code.match(/^(.*)-(\d+)$/);
  if (variant && Number(variant[2]) >= 2) code = variant[1];
  code = code.trim();
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  return code;
}

function isGalleryVariant(name) {
  return Number((name.match(/-(\d+)\.(jpe?g|png|webp)$/i) || [])[1] || 0) >= 2;
}

function mimeFor(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function safeStorageFileName(originalName) {
  const trimmed = originalName.trim() || "file";
  const dot = trimmed.lastIndexOf(".");
  const ext =
    dot > 0 ? trimmed.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = trimmed
    .slice(0, dot > 0 ? dot : trimmed.length)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${Date.now()}-${base || "file"}${ext || ""}`;
}

function productImagePath(productId, fileName) {
  return `products/${productId}/${safeStorageFileName(fileName)}`;
}

async function fetchAllProducts(sb) {
  const bySku = new Map();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb
      .from("products")
      .select("id,sku,image_url")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if (row.sku) bySku.set(String(row.sku).trim(), row);
    }
    if (data.length < page) break;
    from += page;
  }
  return bySku;
}

async function mapPool(items, limit, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

async function main() {
  const files = readdirSync(IMAGES_DIR).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f)
  );

  const bySku = new Map();
  for (const file of files) {
    const sku = skuFromFilename(file);
    if (!sku) continue;
    const entry = bySku.get(sku) ?? { primary: null, variants: [] };
    if (isGalleryVariant(file)) entry.variants.push(file);
    else entry.primary = entry.primary ?? file;
    bySku.set(sku, entry);
  }

  for (const [, entry] of bySku) {
    if (!entry.primary && entry.variants.length) {
      entry.primary = entry.variants.sort()[0];
    }
  }

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Need SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dbBySku = await fetchAllProducts(sb);

  const jobs = [];
  const missing = [];
  for (const [sku, entry] of bySku) {
    const product = dbBySku.get(sku);
    if (!product || !entry.primary) {
      if (!product) missing.push(sku);
      continue;
    }
    jobs.push({ sku, product, file: entry.primary });
  }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "UPLOAD"}`);
  console.log(`Jobs: ${jobs.length} | Missing SKUs: ${missing.length}`);

  let ok = 0;
  let failed = 0;
  const errors = [];

  await mapPool(jobs, CONCURRENCY, async (job, i) => {
    const label = `[${i + 1}/${jobs.length}] ${job.sku}`;
    try {
      if (DRY_RUN) {
        if ((i + 1) % 100 === 0 || i === 0) console.log(`DRY ${label} <- ${job.file}`);
        ok += 1;
        return;
      }

      const abs = join(IMAGES_DIR, job.file);
      const buffer = readFileSync(abs);
      const path = productImagePath(job.product.id, job.file);

      const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, buffer, {
        upsert: true,
        contentType: mimeFor(job.file),
      });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await sb
        .from("products")
        .update({ image_url: path })
        .eq("id", job.product.id);
      if (updateError) throw new Error(updateError.message);

      ok += 1;
      if (ok % 50 === 0 || ok === jobs.length) {
        console.log(`OK ${ok}/${jobs.length} (last: ${job.sku})`);
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ sku: job.sku, message });
      console.error(`FAIL ${label}: ${message}`);
    }
  });

  console.log("---");
  console.log(`Done. ok=${ok} failed=${failed} missingSku=${missing.length}`);
  if (errors.length) {
    console.log("Sample failures:");
    for (const row of errors.slice(0, 15)) {
      console.log(`  ${row.sku}: ${row.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
