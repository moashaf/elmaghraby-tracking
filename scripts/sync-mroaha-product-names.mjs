/**
 * Sync مروحة.xlsx product names onto existing products (by SKU).
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/مروحة.xlsx";
const CATEGORY_ID = "9acb521a-b243-4199-8804-48ff9426e820";
const CATEGORY_LABEL = "مروحة";
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
      barcode: String(row[0] ?? "").trim() || null,
      name_ar: String(row[1] ?? "").trim(),
      sku: String(row[2] ?? "").trim(),
    }))
    .filter((row) => row.sku && row.name_ar);
}

async function main() {
  if (!SERVICE_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = loadRows();
  const sheetBySku = new Map(rows.map((row) => [row.sku, row]));
  const skus = [...sheetBySku.keys()];

  const products = [];
  for (let i = 0; i < skus.length; i += 100) {
    const { data, error } = await sb
      .from("products")
      .select("id,sku,name_ar,category,category_id,barcode")
      .in("sku", skus.slice(i, i + 100));
    if (error) throw new Error(error.message);
    products.push(...(data ?? []));
  }

  let updated = 0;
  let unchanged = 0;

  for (const product of products) {
    const sheetRow = sheetBySku.get(product.sku);
    if (!sheetRow) continue;

    const patch = {};
    if (product.name_ar.trim() !== sheetRow.name_ar) patch.name_ar = sheetRow.name_ar;
    if (product.category !== CATEGORY_LABEL || product.category_id !== CATEGORY_ID) {
      patch.category = CATEGORY_LABEL;
      patch.category_id = CATEGORY_ID;
    }
    if (sheetRow.barcode && (product.barcode ?? "").trim() !== sheetRow.barcode) {
      patch.barcode = sheetRow.barcode;
    }

    if (!Object.keys(patch).length) {
      unchanged += 1;
      continue;
    }

    if (!DRY_RUN) {
      const { error } = await sb.from("products").update(patch).eq("id", product.id);
      if (error) throw new Error(`SKU ${product.sku}: ${error.message}`);
    }

    updated += 1;
    const label = DRY_RUN ? "WOULD UPDATE" : "UPDATED";
    console.log(`${label} ${product.sku}`);
    if (patch.name_ar) console.log(`  name: ${product.name_ar} → ${sheetRow.name_ar}`);
  }

  console.log("\nDone.", DRY_RUN ? "(dry-run)" : "");
  console.log(`In DB: ${products.length}, updated: ${updated}, unchanged: ${unchanged}`);
}

main().catch((error) => {
  console.error("SYNC FAILED:", error.message);
  process.exit(1);
});
