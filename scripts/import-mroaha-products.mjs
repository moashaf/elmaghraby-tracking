/**
 * Import products from مروحة.xlsx — skip existing SKUs, category: مروحة
 * Columns: barcode | name | SKU
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/مروحة.xlsx";
const CATEGORY_ID = "9acb521a-b243-4199-8804-48ff9426e820";
const CATEGORY_LABEL = "مروحة";
const SUPABASE_URL = "https://qwlhsgxxekltqjheobna.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function fetchExistingSkus(sb, skus) {
  const existing = new Set();
  for (let i = 0; i < skus.length; i += 100) {
    const chunk = skus.slice(i, i + 100);
    const { data, error } = await sb.from("products").select("sku").in("sku", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) existing.add(row.sku);
  }
  return existing;
}

async function main() {
  if (!SERVICE_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = loadRows();
  const existing = await fetchExistingSkus(
    sb,
    rows.map((r) => r.sku)
  );

  const skipped = [];
  const inserted = [];

  for (const row of rows) {
    if (existing.has(row.sku)) {
      skipped.push(row);
      continue;
    }

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

    if (error) throw new Error(`SKU ${row.sku}: ${error.message}`);

    existing.add(row.sku);
    inserted.push(row);
    console.log(`OK ${row.sku} | ${row.name_ar.slice(0, 50)}`);
  }

  console.log("\nDone.");
  console.log(`Sheet rows: ${rows.length}`);
  console.log(`Inserted: ${inserted.length}`);
  console.log(`Skipped (existing SKU): ${skipped.length}`);
}

main().catch((error) => {
  console.error("IMPORT FAILED:", error.message);
  process.exit(1);
});
