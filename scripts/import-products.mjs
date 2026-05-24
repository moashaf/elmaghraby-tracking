/**
 * Import products from Excel sheets + build مفكك category tree.
 *
 * Usage:
 *   node scripts/import-products.mjs
 *   node scripts/import-products.mjs "c:/path/to/الاصناف.xlsx"
 */

import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const defaultPath = "c:/Users/hp/OneDrive/Desktop/الاصناف.xlsx";
const filePath = process.argv[2] ?? defaultPath;

const SHEET_ALIASES = { MACHIN: "MACHINE" };
const MFKK_MAIN = "مفكك";
const MFKK_MAIN_CODE = "MFKK";
const MFKK_SOURCE_MAINS = new Set(["PERSONAL CARE", "APPLIANCE"]);

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

function normalizeBarcode(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function sheetCategoryName(sheet) {
  return SHEET_ALIASES[sheet] ?? sheet;
}

function parseProductsWorkbook(path) {
  const workbook = XLSX.readFile(path);
  const items = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    for (let index = 1; index < rows.length; index += 1) {
      const name = String(rows[index][1] ?? "").trim();
      if (!name) continue;
      items.push({
        sheet: sheetName,
        categoryName: sheetCategoryName(sheetName),
        barcode: normalizeBarcode(rows[index][0]),
        name_ar: name,
      });
    }
  }

  return items;
}

function findDuplicateBarcodes(items) {
  const seen = new Map();
  const duplicates = new Set();

  for (const item of items) {
    if (!item.barcode) continue;
    if (seen.has(item.barcode)) duplicates.add(item.barcode);
    seen.set(item.barcode, true);
  }

  return duplicates;
}

async function loadCategories(client) {
  const result = await client.query(`
    select c.id, c.name_ar, c.code, c.parent_id, p.name_ar as parent_name
    from public.product_categories c
    left join public.product_categories p on p.id = c.parent_id
  `);

  const byName = new Map();
  for (const row of result.rows) {
    const key = row.parent_id ? `${row.parent_name}::${row.name_ar}` : `::${row.name_ar}`;
    byName.set(key, row);
    if (!row.parent_id) byName.set(`::${row.name_ar}`, row);
  }

  return { rows: result.rows, byName };
}

function resolveCategoryId(categories, sheetName, categoryName) {
  if (categoryName === "كشاف") {
    return categories.byName.get("::كشاف")?.id ?? null;
  }

  for (const main of ["PERSONAL CARE", "APPLIANCE", "طبي + TV", "راديو + مشترك + حجر + تليفون", "خردوات", "هدايا", "مستلزمات مطبخ", "سيريا رمضان", "متنوع رمضان", "عدد ومفكات"]) {
    const hit = categories.byName.get(`${main}::${categoryName}`);
    if (hit) return hit.id;
  }

  const fallback = categories.rows.find((row) => row.name_ar === categoryName);
  return fallback?.id ?? null;
}

function slugCode(value, max = 24) {
  const latin = String(value)
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  if (latin.length >= 2) return latin.slice(0, max);
  return "X";
}

loadEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function ensureMfkkTree(client) {
  let mfkkMain = await client.query(
    `select id from public.product_categories where name_ar = $1 and parent_id is null`,
    [MFKK_MAIN]
  );

  let mfkkMainId = mfkkMain.rows[0]?.id;
  if (!mfkkMainId) {
    const inserted = await client.query(
      `insert into public.product_categories (name_ar, code, parent_id, is_active)
       values ($1, $2, null, true) returning id`,
      [MFKK_MAIN, MFKK_MAIN_CODE]
    );
    mfkkMainId = inserted.rows[0].id;
  }

  const products = await client.query(`
    select p.id, p.sku, p.name_ar, c.id as sub_id, c.name_ar as sub_name, c.code as sub_code, gp.name_ar as main_name
    from public.products p
    join public.product_categories c on c.id = p.category_id
    join public.product_categories gp on gp.id = c.parent_id
    where gp.name_ar = any($1::text[])
    order by gp.name_ar, c.name_ar, p.name_ar
  `, [[...MFKK_SOURCE_MAINS]]);

  const mfkkGroupIds = new Map();
  let groupCount = 0;
  let leafCount = 0;

  for (const row of products.rows) {
    let groupId = mfkkGroupIds.get(row.sub_name);
    if (!groupId) {
      const groupCode = `MFKK-${row.sub_code}`;
      const existingGroup = await client.query(
        `select id from public.product_categories where code = $1`,
        [groupCode]
      );
      if (existingGroup.rows[0]?.id) {
        groupId = existingGroup.rows[0].id;
      } else {
        const insertedGroup = await client.query(
          `insert into public.product_categories (name_ar, code, parent_id, is_active)
           values ($1, $2, $3, true) returning id`,
          [row.sub_name, groupCode, mfkkMainId]
        );
        groupId = insertedGroup.rows[0].id;
        groupCount += 1;
      }
      mfkkGroupIds.set(row.sub_name, groupId);
    }

    const leafName = `${row.sku} — ${row.name_ar}`.slice(0, 250);
    const leafCode = `MFKK-${row.sub_code}-${slugCode(row.sku, 20)}`;
    const existingLeaf = await client.query(
      `select id from public.product_categories where code = $1`,
      [leafCode]
    );
    if (existingLeaf.rows[0]?.id) continue;

    await client.query(
      `insert into public.product_categories (name_ar, code, parent_id, is_active)
       values ($1, $2, $3, true)`,
      [leafName, leafCode, groupId]
    );
    leafCount += 1;
  }

  return { groupCount, leafCount, productLinks: products.rows.length };
}

async function main() {
  const items = parseProductsWorkbook(filePath);
  const duplicateInFile = findDuplicateBarcodes(items);

  await client.connect();
  await client.query("begin");

  try {
    await client.query("delete from public.products");
    await client.query(`
      delete from public.product_categories
      where parent_id in (
        select id from public.product_categories where code like 'MFKK-%'
      )
      or parent_id in (
        select c.id from public.product_categories c
        join public.product_categories p on p.id = c.parent_id
        where p.code = $1
      )
      or code like 'MFKK-%'
      or (name_ar = $2 and parent_id is null)
    `, [MFKK_MAIN_CODE, MFKK_MAIN]);

    const categories = await loadCategories(client);
    const usedBarcodes = new Set();
    let inserted = 0;
    let skippedDuplicate = 0;
    let skippedMissingCategory = 0;
    const missingSheets = new Set();

    for (const item of items) {
      if (item.barcode) {
        if (duplicateInFile.has(item.barcode) || usedBarcodes.has(item.barcode)) {
          skippedDuplicate += 1;
          continue;
        }
      }

      const categoryId = resolveCategoryId(categories, item.sheet, item.categoryName);
      if (!categoryId) {
        skippedMissingCategory += 1;
        missingSheets.add(item.sheet);
        continue;
      }

      const categoryRow = categories.rows.find((row) => row.id === categoryId);

      try {
        await client.query(
          `insert into public.products (name_ar, category, category_id, barcode, unit, sku, is_active)
           values ($1, $2, $3, $4, 'piece', '', true)`,
          [item.name_ar, categoryRow?.name_ar ?? item.categoryName, categoryId, item.barcode]
        );
        inserted += 1;
        if (item.barcode) usedBarcodes.add(item.barcode);
      } catch (error) {
        if (String(error.message).includes("products_barcode_unique_idx") || String(error.message).includes("duplicate key")) {
          skippedDuplicate += 1;
          continue;
        }
        throw error;
      }
    }

    const mfkk = await ensureMfkkTree(client);

    await client.query("commit");

    const totals = await client.query(`
      select
        (select count(*)::int from public.products) as products,
        (select count(*)::int from public.product_categories) as categories
    `);

    console.log(`Imported from: ${filePath}`);
    console.log(`Products inserted: ${inserted}`);
    console.log(`Skipped duplicate barcodes: ${skippedDuplicate}`);
    console.log(`Skipped missing category: ${skippedMissingCategory}`);
    if (missingSheets.size) console.log("Missing category sheets:", [...missingSheets].join(", "));
    console.log(`مفكك groups created: ${mfkk.groupCount}`);
    console.log(`مفكك product folders created: ${mfkk.leafCount}`);
    console.log(`مفكك linked to ${mfkk.productLinks} products in PC/APPL`);
    console.log("Database totals:", totals.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

main().catch(async (error) => {
  console.error(error.message);
  await client.end().catch(() => {});
  process.exit(1);
});
