/**
 * Import products from SOKANY.xlsx — per-row category, skip existing SKUs.
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/SOKANY.xlsx";
const SUPABASE_URL = "https://qwlhsgxxekltqjheobna.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Sheet label → category name in DB */
const CATEGORY_ALIASES = {
  "غلايه كهربائيه": "غلاية كهربائية",
  "مطحنه+ماكينه قهوه": "مطحنة + ماكينة قهوة",
  "قلايه هوائيه": "قلاية هوائية",
  كبه: "كبة",
  مفرمه: "مفرمة",
  عجانه: "عجانة",
  مكنسه: "مكنسة",
  "شاشات (T.V)": "TV",
};

function loadRows() {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils
    .sheet_to_json(sheet, { header: 1, defval: "" })
    .slice(1)
    .map((row) => ({
      barcode: String(row[0] ?? "").trim() || null,
      categoryLabel: String(row[1] ?? "").trim(),
      name_ar: String(row[2] ?? "").trim(),
      sku: String(row[3] ?? "").trim(),
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

  const { data: categories, error: catError } = await sb.from("product_categories").select("id,name_ar").eq("is_active", true);
  if (catError) throw new Error(catError.message);

  const categoryByName = new Map(categories.map((c) => [c.name_ar.trim(), c]));
  const existing = await fetchExistingSkus(
    sb,
    rows.map((r) => r.sku)
  );

  let skippedExisting = 0;
  let skippedCategory = 0;
  const inserted = [];
  const unresolved = new Set();

  for (const row of rows) {
    if (existing.has(row.sku)) {
      skippedExisting += 1;
      continue;
    }

    const dbCategoryName = CATEGORY_ALIASES[row.categoryLabel] ?? row.categoryLabel;
    const category = categoryByName.get(dbCategoryName);
    if (!category) {
      unresolved.add(row.categoryLabel);
      skippedCategory += 1;
      continue;
    }

    const { error } = await sb.from("products").insert({
      sku: row.sku,
      name_ar: row.name_ar,
      name_en: null,
      category_id: category.id,
      category: category.name_ar,
      barcode: row.barcode,
      unit: "piece",
      is_active: true,
    });

    if (error) {
      if (error.message.includes("products_sku_key") || error.message.includes("duplicate")) {
        skippedExisting += 1;
        existing.add(row.sku);
        continue;
      }
      throw new Error(`SKU ${row.sku}: ${error.message}`);
    }

    existing.add(row.sku);
    inserted.push(row.sku);
    console.log(`OK ${row.sku} | ${category.name_ar} | ${row.name_ar.slice(0, 45)}`);
  }

  console.log("\nDone.");
  console.log(`Sheet rows: ${rows.length}`);
  console.log(`Inserted: ${inserted.length}`);
  console.log(`Skipped existing SKU: ${skippedExisting}`);
  console.log(`Skipped (category): ${skippedCategory}`);
  if (unresolved.size) console.log("Unresolved categories:", [...unresolved]);
}

main().catch((error) => {
  console.error("IMPORT FAILED:", error.message);
  process.exit(1);
});
