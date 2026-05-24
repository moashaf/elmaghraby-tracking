/**
 * Import products from Excel (barcode col A, name col B).
 *
 * Root category (default):
 *   node scripts/import-sheet-products.mjs "c:/path/file.xlsx"
 *
 * Subcategory under a parent (e.g. خردوات):
 *   node scripts/import-sheet-products.mjs "c:/path/file.xlsx" --parent خردوات
 */

import { basename, extname } from "path";
import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const args = process.argv.slice(2);
const parentArgIndex = args.indexOf("--parent");
const parentName = parentArgIndex >= 0 ? args[parentArgIndex + 1] : null;
const filePath = args.find((arg) => !arg.startsWith("--") && arg !== parentName);

if (!filePath) {
  console.error("Usage: node scripts/import-sheet-products.mjs <path-to-xlsx> [--parent <main-category>]");
  process.exit(1);
}

const PARENT_CODES = {
  "PERSONAL CARE": "PC",
  كشاف: "KSHF",
  APPLIANCE: "APPL",
  "طبي + TV": "MEDTV",
  "راديو + مشترك + حجر + تليفون": "RDMP",
  خردوات: "HRDW",
  هدايا: "GIFT",
  "مستلزمات مطبخ": "KITC",
  "سيريا رمضان": "RAMS",
  "متنوع رمضان": "RAMM",
  "عدد ومفكات": "TOOL",
};

const ROOT_CATEGORY_CODES = {
  ازالة: "AZAL",
};

function loadEnv() {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i === -1) continue;
      const key = trimmed.slice(0, i).trim();
      const value = trimmed.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!url || !password) return null;
  const ref = url.replace("https://", "").split(".")[0];
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}

function isGenericSheetName(name) {
  return /^Sheet\d+$/i.test(String(name).trim());
}

function resolveSubcategoryLabel(sheetName, path) {
  if (isGenericSheetName(sheetName)) {
    return basename(path, extname(path));
  }
  return sheetName;
}

function parentCode(name) {
  if (PARENT_CODES[name]) return PARENT_CODES[name];
  const latin = String(name)
    .normalize("NFKD")
    .replace(/[^\w]+/g, "")
    .toUpperCase();
  return (latin.slice(0, 6) || "CAT") + Math.random().toString(36).slice(2, 4).toUpperCase();
}

function rootCategoryCode(name) {
  if (ROOT_CATEGORY_CODES[name]) return ROOT_CATEGORY_CODES[name];
  const latin = String(name)
    .normalize("NFKD")
    .replace(/[^\w]+/g, "")
    .toUpperCase();
  if (latin.length >= 2) return latin.slice(0, 8);
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `C${hash.toString(36).toUpperCase().slice(0, 5)}`;
}

function normalizeBarcode(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function parseWorkbook(path) {
  const workbook = XLSX.readFile(path);
  const groups = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const subcategoryName = resolveSubcategoryLabel(sheetName, path);
    const items = [];

    for (let index = 1; index < rows.length; index += 1) {
      const name = String(rows[index][1] ?? "").trim();
      if (!name) continue;
      items.push({
        barcode: normalizeBarcode(rows[index][0]),
        name_ar: name,
      });
    }

    groups.push({ sheetName, subcategoryName, items });
  }

  return groups;
}

loadEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function ensureRootCategory(client, categoryName) {
  const existing = await client.query(
    `select id, code from public.product_categories where name_ar = $1 and parent_id is null limit 1`,
    [categoryName]
  );
  if (existing.rows[0]?.id) {
    const row = existing.rows[0];
    if (!row.code) {
      const code = rootCategoryCode(categoryName);
      await client.query(`update public.product_categories set code = $1 where id = $2`, [code, row.id]);
      return { id: row.id, code };
    }
    return row;
  }

  const code = rootCategoryCode(categoryName);
  const inserted = await client.query(
    `insert into public.product_categories (name_ar, code, parent_id, is_active)
     values ($1, $2, null, true)
     returning id, code`,
    [categoryName, code]
  );
  return inserted.rows[0];
}

async function ensureParentCategory(client, name) {
  const existing = await client.query(
    `select id, code from public.product_categories where name_ar = $1 and parent_id is null limit 1`,
    [name]
  );
  if (!existing.rows[0]?.id) {
    throw new Error(`الفئة الرئيسية «${name}» غير موجودة. أضفها من صفحة الفئات أولا.`);
  }
  const row = existing.rows[0];
  if (!row.code) {
    const code = parentCode(name);
    await client.query(`update public.product_categories set code = $1 where id = $2`, [code, row.id]);
    return { id: row.id, code };
  }
  return row;
}

async function ensureSubCategory(client, parent, subcategoryName) {
  const existing = await client.query(
    `select id, code from public.product_categories where name_ar = $1 and parent_id = $2 limit 1`,
    [subcategoryName, parent.id]
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0];
  }

  const countResult = await client.query(
    `select count(*)::int as count from public.product_categories where parent_id = $1`,
    [parent.id]
  );
  const index = Number(countResult.rows[0]?.count ?? 0) + 1;
  const prefix = parent.code || parentCode(parent.name_ar ?? "خردوات");
  const code = `${prefix}-${String(index).padStart(2, "0")}`;

  const inserted = await client.query(
    `insert into public.product_categories (name_ar, code, parent_id, is_active)
     values ($1, $2, $3, true)
     returning id, code`,
    [subcategoryName, code, parent.id]
  );
  return inserted.rows[0];
}

async function main() {
  const groups = parseWorkbook(filePath);
  await client.connect();
  await client.query("begin");

  try {
    let inserted = 0;
    let skippedDuplicate = 0;
    const summary = [];

    for (const group of groups) {
      let category;
      let categoryLabel;

      if (parentName) {
        const parent = await ensureParentCategory(client, parentName);
        category = await ensureSubCategory(client, parent, group.subcategoryName);
        categoryLabel = `${parentName} / ${group.subcategoryName}`;
      } else {
        category = await ensureRootCategory(client, group.subcategoryName);
        categoryLabel = group.subcategoryName;
      }

      let sheetInserted = 0;

      for (const item of group.items) {
        if (item.barcode) {
          const dup = await client.query(`select id from public.products where barcode = $1 limit 1`, [item.barcode]);
          if (dup.rows[0]?.id) {
            skippedDuplicate += 1;
            continue;
          }
        }

        try {
          await client.query(
            `insert into public.products (name_ar, category, category_id, barcode, unit, sku, is_active)
             values ($1, $2, $3, $4, 'piece', '', true)`,
            [item.name_ar, group.subcategoryName, category.id, item.barcode]
          );
          inserted += 1;
          sheetInserted += 1;
        } catch (error) {
          if (String(error.message).includes("products_barcode_unique_idx") || String(error.message).includes("duplicate key")) {
            skippedDuplicate += 1;
            continue;
          }
          throw error;
        }
      }

      summary.push({
        sheet: group.sheetName,
        category: categoryLabel,
        code: category.code,
        products: sheetInserted,
        rows: group.items.length,
      });
    }

    await client.query("commit");

    console.log(`Imported from: ${filePath}`);
    if (parentName) console.log(`Parent category: ${parentName}`);
    for (const row of summary) {
      console.log(`  [${row.sheet}] → ${row.category} (${row.code}): ${row.products}/${row.rows} منتج`);
    }
    console.log(`Total inserted: ${inserted}`);
    console.log(`Skipped duplicate barcodes: ${skippedDuplicate}`);

    const totals = await client.query(`
      select
        (select count(*)::int from public.products) as products,
        (select count(*)::int from public.product_categories) as categories
    `);
    console.log("Database totals:", totals.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
