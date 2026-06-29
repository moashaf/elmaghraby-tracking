/**
 * Sync SOKANY.xlsx names (and category/SKU) onto existing products.
 * Matches by SKU first, then by barcode for rows where DB name equals category.
 *
 * Usage:
 *   node scripts/sync-sokany-product-names.mjs
 *   node scripts/sync-sokany-product-names.mjs --dry-run
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = "c:/Users/hp/OneDrive/Desktop/SOKANY.xlsx";
const SUPABASE_URL = "https://qwlhsgxxekltqjheobna.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

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

function resolveCategory(categoryLabel, categoryByName) {
  const dbCategoryName = CATEGORY_ALIASES[categoryLabel] ?? categoryLabel;
  return categoryByName.get(dbCategoryName) ?? null;
}

async function fetchProducts(sb, skus, barcodes) {
  const byId = new Map();

  for (let i = 0; i < skus.length; i += 100) {
    const chunk = skus.slice(i, i + 100);
    const { data, error } = await sb
      .from("products")
      .select("id,sku,name_ar,category,category_id,barcode")
      .in("sku", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id, row);
  }

  const cleanBarcodes = barcodes.filter(Boolean);
  for (let i = 0; i < cleanBarcodes.length; i += 100) {
    const chunk = cleanBarcodes.slice(i, i + 100);
    const { data, error } = await sb
      .from("products")
      .select("id,sku,name_ar,category,category_id,barcode")
      .in("barcode", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) byId.set(row.id, row);
  }

  return [...byId.values()];
}

async function fetchBarcodeOwners(sb, barcodes) {
  const map = new Map();
  const clean = barcodes.filter(Boolean);
  for (let i = 0; i < clean.length; i += 100) {
    const { data, error } = await sb
      .from("products")
      .select("id,sku,barcode")
      .in("barcode", clean.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) map.set(row.barcode.trim(), row);
  }
  return map;
}

function buildPatch(product, sheetRow, category, usedSkus, barcodeOwners) {
  const patch = {};
  let nameFix = false;
  let categoryFix = false;
  let barcodeFix = false;
  let skuFix = false;

  if (product.name_ar.trim() !== sheetRow.name_ar) {
    patch.name_ar = sheetRow.name_ar;
    nameFix = true;
  }

  if (category) {
    if (product.category_id !== category.id || product.category !== category.name_ar) {
      patch.category_id = category.id;
      patch.category = category.name_ar;
      categoryFix = true;
    }
  }

  if (sheetRow.barcode && (product.barcode ?? "").trim() !== sheetRow.barcode) {
    const owner = barcodeOwners.get(sheetRow.barcode);
    if (!owner || owner.id === product.id) {
      patch.barcode = sheetRow.barcode;
      barcodeFix = true;
    }
  } else if (!sheetRow.barcode && (product.barcode ?? "").trim()) {
    patch.barcode = null;
    barcodeFix = true;
  }

  const nameLooksLikeCategory =
    product.name_ar.trim() === product.category?.trim() ||
    product.name_ar.trim() === sheetRow.categoryLabel;

  if (
    product.sku !== sheetRow.sku &&
    nameLooksLikeCategory &&
    !usedSkus.has(sheetRow.sku)
  ) {
    patch.sku = sheetRow.sku;
    skuFix = true;
  }

  if (!Object.keys(patch).length) return null;

  return { patch, nameFix, categoryFix, barcodeFix, skuFix };
}

async function main() {
  if (!SERVICE_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = loadRows();
  const sheetBySku = new Map(rows.map((row) => [row.sku, row]));
  const sheetByBarcode = new Map(rows.filter((row) => row.barcode).map((row) => [row.barcode, row]));

  const { data: categories, error: catError } = await sb
    .from("product_categories")
    .select("id,name_ar")
    .eq("is_active", true);
  if (catError) throw new Error(catError.message);

  const categoryByName = new Map(categories.map((c) => [c.name_ar.trim(), c]));
  const products = await fetchProducts(sb, [...sheetBySku.keys()], [...sheetByBarcode.keys()]);
  const usedSkus = new Set(products.map((p) => p.sku));
  const barcodeOwners = await fetchBarcodeOwners(
    sb,
    rows.map((row) => row.barcode).filter(Boolean)
  );

  let unchanged = 0;
  let updated = 0;
  let nameFixes = 0;
  let categoryFixes = 0;
  let barcodeFixes = 0;
  let skuFixes = 0;
  const seenIds = new Set();

  const sortedProducts = [...products].sort((a, b) => {
    const sheetA =
      sheetBySku.get(a.sku) ?? (a.barcode ? sheetByBarcode.get(a.barcode.trim()) : null);
    const sheetB =
      sheetBySku.get(b.sku) ?? (b.barcode ? sheetByBarcode.get(b.barcode.trim()) : null);
    const clearA = Boolean(sheetA && !sheetA.barcode && a.barcode);
    const clearB = Boolean(sheetB && !sheetB.barcode && b.barcode);
    return Number(clearB) - Number(clearA);
  });

  for (const product of sortedProducts) {
    if (seenIds.has(product.id)) continue;

    const sheetRow =
      sheetBySku.get(product.sku) ??
      (product.barcode ? sheetByBarcode.get(product.barcode.trim()) : null);

    if (!sheetRow) continue;

    const category = resolveCategory(sheetRow.categoryLabel, categoryByName);
    const result = buildPatch(product, sheetRow, category, usedSkus, barcodeOwners);
    if (!result) {
      unchanged += 1;
      continue;
    }

    const { patch, nameFix, categoryFix, barcodeFix, skuFix } = result;

    if (!DRY_RUN) {
      const { error } = await sb.from("products").update(patch).eq("id", product.id);
      if (error) throw new Error(`Product ${product.sku}: ${error.message}`);
      if (patch.barcode && patch.barcode !== (product.barcode ?? "").trim()) {
        barcodeOwners.set(patch.barcode, { id: product.id, sku: patch.sku ?? product.sku, barcode: patch.barcode });
      }
      if (patch.barcode === null && product.barcode) {
        barcodeOwners.delete(product.barcode.trim());
      }
    }

    seenIds.add(product.id);
    updated += 1;
    if (nameFix) nameFixes += 1;
    if (categoryFix) categoryFixes += 1;
    if (barcodeFix) barcodeFixes += 1;
    if (skuFix) {
      skuFixes += 1;
      usedSkus.delete(product.sku);
      usedSkus.add(sheetRow.sku);
    }

    const label = DRY_RUN ? "WOULD UPDATE" : "UPDATED";
    console.log(`${label} ${product.sku}${skuFix ? ` → ${sheetRow.sku}` : ""}`);
    if (nameFix) console.log(`  name: ${product.name_ar} → ${sheetRow.name_ar}`);
    if (categoryFix && category) console.log(`  category: ${product.category} → ${category.name_ar}`);
    if (barcodeFix) console.log(`  barcode: ${product.barcode ?? ""} → ${sheetRow.barcode}`);
  }

  console.log("\nDone.", DRY_RUN ? "(dry-run)" : "");
  console.log(`Sheet rows: ${rows.length}`);
  console.log(`Products checked: ${products.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Updated: ${updated}`);
  console.log(`Name fixes: ${nameFixes}`);
  console.log(`Category fixes: ${categoryFixes}`);
  console.log(`Barcode fixes: ${barcodeFixes}`);
  console.log(`SKU fixes: ${skuFixes}`);
}

main().catch((error) => {
  console.error("SYNC FAILED:", error.message);
  process.exit(1);
});
