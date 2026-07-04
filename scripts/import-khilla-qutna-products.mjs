/**
 * Import products from خلة وقطنة.xlsx — category: خله + قطنة + دبوس + مرايا
 * Columns: SKU | إسم الصنف | الباركود الدولى
 *
 *   node scripts/import-khilla-qutna-products.mjs
 *   node scripts/import-khilla-qutna-products.mjs --dry-run
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/خلة وقطنة.xlsx";
const CATEGORY_ID = "e69125bd-e58c-4a63-9593-a4f714b0c9ff";
const CATEGORY_LABEL = "خله + قطنة + دبوس + مرايا";
const SUPABASE_URL = "https://qwlhsgxxekltqjheobna.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

function loadRows() {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils
    .sheet_to_json(sheet, { header: 1, defval: "" })
    .slice(1)
    .map((row) => ({
      sku: String(row[0] ?? "").trim(),
      name_ar: String(row[1] ?? "").trim(),
      barcode: String(row[2] ?? "").trim() || null,
    }))
    .filter((row) => row.sku && row.name_ar);
}

async function fetchProductsBySku(sb, skus) {
  const bySku = new Map();
  for (let i = 0; i < skus.length; i += 100) {
    const chunk = skus.slice(i, i + 100);
    const { data, error } = await sb
      .from("products")
      .select("id,sku,name_ar,category,category_id,barcode")
      .in("sku", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) bySku.set(row.sku, row);
  }
  return bySku;
}

async function main() {
  if (!SERVICE_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = loadRows();
  const products = await fetchProductsBySku(
    sb,
    rows.map((r) => r.sku)
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const product = products.get(row.sku);

    if (!product) {
      if (!DRY_RUN) {
        const { error } = await sb.from("products").insert({
          sku: row.sku,
          name_ar: row.name_ar,
          name_en: null,
          category_id: CATEGORY_ID,
          category: CATEGORY_LABEL,
          barcode: row.barcode,
          unit: "piece",
          is_active: true,
        });
        if (error) throw new Error(`INSERT ${row.sku}: ${error.message}`);
      }
      inserted += 1;
      console.log(`${DRY_RUN ? "WOULD INSERT" : "INSERT"} ${row.sku} | ${row.name_ar.slice(0, 50)}`);
      continue;
    }

    const patch = {};
    if (product.category_id !== CATEGORY_ID || product.category !== CATEGORY_LABEL) {
      patch.category_id = CATEGORY_ID;
      patch.category = CATEGORY_LABEL;
    }
    if (product.name_ar.trim() !== row.name_ar) patch.name_ar = row.name_ar;
    if (row.barcode && (product.barcode ?? "").trim() !== row.barcode) patch.barcode = row.barcode;

    if (!Object.keys(patch).length) {
      skipped += 1;
      continue;
    }

    if (!DRY_RUN) {
      const { error } = await sb.from("products").update(patch).eq("id", product.id);
      if (error) throw new Error(`UPDATE ${row.sku}: ${error.message}`);
    }
    updated += 1;
    console.log(`${DRY_RUN ? "WOULD UPDATE" : "UPDATE"} ${row.sku}`);
    if (patch.name_ar) console.log(`  name: ${product.name_ar} → ${row.name_ar}`);
    if (patch.category) console.log(`  category → ${CATEGORY_LABEL}`);
  }

  console.log("\nDone.", DRY_RUN ? "(dry-run)" : "");
  console.log(`Sheet rows: ${rows.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${skipped}`);
}

main().catch((error) => {
  console.error("IMPORT FAILED:", error.message);
  process.exit(1);
});
