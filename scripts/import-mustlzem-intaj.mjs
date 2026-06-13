/**
 * Import مستلزم انتاج — main category + products (name col A, SKU col B).
 *
 * Usage:
 *   node scripts/import-mustlzem-intaj.mjs
 *   node scripts/import-mustlzem-intaj.mjs "c:/path/مستلزم انتاج.xlsx"
 */

import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const defaultPath = "c:/Users/hp/OneDrive/Desktop/مستلزم انتاج.xlsx";
const filePath = process.argv[2] ?? defaultPath;
const MAIN_CATEGORY = "مستلزم انتاج";
const MAIN_CODE = "PROD";

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

function parseWorkbook(path) {
  const workbook = XLSX.readFile(path);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
  const items = [];

  for (let index = 1; index < rows.length; index += 1) {
    const name_ar = String(rows[index][0] ?? "").trim();
    const sku = String(rows[index][1] ?? "").trim();
    if (!name_ar || !sku) continue;
    items.push({ name_ar, sku });
  }

  return items;
}

loadEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function ensureMainCategory() {
  const existing = await client.query(
    `select id, code from public.product_categories where name_ar = $1 and parent_id is null limit 1`,
    [MAIN_CATEGORY]
  );
  if (existing.rows[0]?.id) return existing.rows[0];

  const inserted = await client.query(
    `insert into public.product_categories (name_ar, code, parent_id, is_active)
     values ($1, $2, null, true)
     returning id, code`,
    [MAIN_CATEGORY, MAIN_CODE]
  );
  return inserted.rows[0];
}

async function main() {
  const items = parseWorkbook(filePath);
  await client.connect();
  await client.query("begin");

  try {
    const category = await ensureMainCategory();
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await client.query(`select id from public.products where sku = $1 limit 1`, [item.sku]);
      if (existing.rows[0]?.id) {
        skipped += 1;
        continue;
      }

      try {
        await client.query(
          `insert into public.products (name_ar, category, category_id, sku, unit, is_active)
           values ($1, $2, $3, $4, 'piece', true)`,
          [item.name_ar, MAIN_CATEGORY, category.id, item.sku]
        );
        inserted += 1;
      } catch (error) {
        if (String(error.message).includes("duplicate key")) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    await client.query("commit");

    const totals = await client.query(
      `
      select
        (select count(*)::int from public.products where category_id = $1) as category_products,
        (select count(*)::int from public.products) as all_products
    `,
      [category.id]
    );

    console.log(`Imported from: ${filePath}`);
    console.log(`Main category: ${MAIN_CATEGORY} (${category.code})`);
    console.log(`Rows in file: ${items.length}`);
    console.log(`Products inserted: ${inserted}`);
    console.log(`Skipped (existing SKU): ${skipped}`);
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
