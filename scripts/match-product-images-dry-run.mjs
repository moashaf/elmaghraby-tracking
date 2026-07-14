/**
 * Dry-run only: match #Item-{SKU}.jpg files to products.sku — no uploads.
 * Usage: node scripts/match-product-images-dry-run.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const IMAGES_DIR = "D:/New folder/products-export-2026-06-29/images";

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

/** #Item-010670.jpg → 010670 ; 010067-2.jpg → 010067 ; 010067.jpg → 010067 */
function skuFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, "").trim();
  let code = base;

  const hashed = code.match(/^#item-(.+)$/i);
  if (hashed) code = hashed[1].trim();

  const variant = code.match(/^(.*)-(\d+)$/);
  if (variant && Number(variant[2]) >= 2) {
    code = variant[1];
  }

  code = code.trim();
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  return code;
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

async function main() {
  const files = readdirSync(IMAGES_DIR).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f)
  );

  const byImageSku = new Map();
  let unparsed = 0;
  for (const file of files) {
    const sku = skuFromFilename(file);
    if (!sku) {
      unparsed += 1;
      continue;
    }
    const entry = byImageSku.get(sku) ?? { primary: null, variants: [] };
    const isVariant = /^#item-.+-\d+\.(jpe?g|png|webp)$/i.test(file) &&
      Number((file.match(/-(\d+)\.(jpe?g|png|webp)$/i) || [])[1] || 0) >= 2;
    if (isVariant) entry.variants.push(file);
    else entry.primary = entry.primary ?? file;
    byImageSku.set(sku, entry);
  }

  const imageSkus = [...byImageSku.keys()];
  console.log(`Image files: ${files.length}`);
  console.log(`Unique SKUs from filenames: ${imageSkus.length}`);
  console.log(`Unparsed filenames: ${unparsed}`);

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dbBySku = await fetchAllProducts(sb);
  console.log(`Products with SKU in DB: ${dbBySku.size}`);

  let matchedExact = 0;
  let matchedStripZeros = 0;
  let withImage = 0;
  let withoutImage = 0;
  const missing = [];

  for (const sku of imageSkus) {
    let product = dbBySku.get(sku);
    let via = "exact";
    if (!product) {
      const stripped = sku.replace(/^0+/, "") || "0";
      product = dbBySku.get(stripped);
      via = "strip-zeros";
    }
    if (!product) {
      missing.push(sku);
      continue;
    }
    if (via === "exact") matchedExact += 1;
    else matchedStripZeros += 1;
    if (product.image_url) withImage += 1;
    else withoutImage += 1;
  }

  const matched = matchedExact + matchedStripZeros;
  console.log("---");
  console.log(`MATCHED SKUs: ${matched}`);
  console.log(`  exact match: ${matchedExact}`);
  console.log(`  match after stripping leading zeros: ${matchedStripZeros}`);
  console.log(`  already have image_url: ${withImage}`);
  console.log(`  empty image (ready for upload): ${withoutImage}`);
  console.log(`NO MATCH in DB: ${missing.length}`);
  if (missing.length) {
    console.log(`Sample missing: ${missing.slice(0, 20).join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
