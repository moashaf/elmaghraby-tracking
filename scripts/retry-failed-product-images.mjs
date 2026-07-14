/**
 * Retry specific failed SKU image uploads.
 *   node scripts/retry-failed-product-images.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, resolve, extname } from "path";

const IMAGES_DIR = "D:/New folder/products-export-2026-06-29/images";
const FAIL = ["050220", "050485", "050486", "050484", "050473"];

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

function findFile(sku) {
  const files = readdirSync(IMAGES_DIR);
  const exact = files.find(
    (f) => f.replace(/\.[^.]+$/, "").replace(/^#item-/i, "") === sku
  );
  if (exact) return exact;
  return files.find((f) => {
    let b = f.replace(/\.[^.]+$/, "").replace(/^#item-/i, "");
    const v = b.match(/^(.*)-(\d+)$/);
    if (v && Number(v[2]) >= 2) b = v[1];
    return b === sku;
  });
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const sku of FAIL) {
    const { data: product, error } = await sb
      .from("products")
      .select("id,sku")
      .eq("sku", sku)
      .maybeSingle();
    if (error || !product) {
      console.log("no product", sku, error?.message);
      continue;
    }
    const file = findFile(sku);
    if (!file) {
      console.log("no file", sku);
      continue;
    }

    const buffer = readFileSync(join(IMAGES_DIR, file));
    const ext = extname(file).toLowerCase();
    const path = `products/${product.id}/${Date.now()}-${sku}${ext}`;
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const up = await sb.storage.from("product-images").upload(path, buffer, {
        upsert: true,
        contentType,
      });
      if (up.error) {
        lastErr = up.error.message;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      const upd = await sb.from("products").update({ image_url: path }).eq("id", product.id);
      if (upd.error) {
        lastErr = upd.error.message;
        continue;
      }
      console.log("OK", sku, file);
      lastErr = null;
      break;
    }
    if (lastErr) console.log("FAIL", sku, lastErr);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
