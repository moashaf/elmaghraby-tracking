/**
 * Update product SKU from Excel by product Arabic name (name_ar).
 *
 * Usage:
 *   node scripts/update-sku-from-excel.mjs "c:/Users/hp/Downloads/Book3.xlsx"
 *
 * Expected columns (header row):
 *   - اسم الصنف
 *   - SKU الجديد
 *
 * Notes:
 * - Matches by exact trimmed name (name_ar).
 * - Skips missing products.
 * - Detects duplicate/conflicting rows in Excel.
 */

import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const filePath = process.argv[2] ?? "c:/Users/hp/Downloads/Book3.xlsx";

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

function parseExcel(path) {
  const workbook = XLSX.readFile(path);
  const first = workbook.SheetNames[0];
  const sheet = workbook.Sheets[first];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const header = rows[0]?.map((v) => String(v ?? "").trim()) ?? [];
  const nameIndex = header.indexOf("اسم الصنف");
  const skuIndex = header.indexOf("SKU الجديد");
  if (nameIndex === -1 || skuIndex === -1) {
    throw new Error(`Missing headers. Found: ${header.join(" | ")}`);
  }

  const map = new Map(); // name -> sku
  const conflicts = [];
  const empty = [];

  for (let i = 1; i < rows.length; i += 1) {
    const name = String(rows[i]?.[nameIndex] ?? "").trim();
    const sku = String(rows[i]?.[skuIndex] ?? "").trim();
    if (!name || !sku) {
      if (name || sku) empty.push({ row: i + 1, name, sku });
      continue;
    }
    const existing = map.get(name);
    if (existing && existing !== sku) {
      conflicts.push({ row: i + 1, name, sku, existing });
      continue;
    }
    map.set(name, sku);
  }

  return { map, conflicts, empty, sheetName: first, totalRows: rows.length - 1 };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

loadEnv();
const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  const { map, conflicts, empty, sheetName, totalRows } = parseExcel(filePath);

  console.log(`Sheet: ${sheetName}`);
  console.log(`Rows: ${totalRows}`);
  console.log(`Parsed updates: ${map.size}`);
  console.log(`Empty/partial rows skipped: ${empty.length}`);

  if (conflicts.length) {
    console.warn(`Conflicts in Excel (same name with different SKU): ${conflicts.length}`);
    console.warn("These names will be skipped. Sample:");
    console.warn(conflicts.slice(0, 20));
    const conflictNames = new Set(conflicts.map((c) => c.name));
    for (const name of conflictNames) map.delete(name);
    console.log(`Updates after skipping conflicts: ${map.size}`);
  }

  await client.connect();

  const entries = [...map.entries()].map(([name_ar, sku]) => ({ name_ar, sku }));
  const batches = chunk(entries, 500);
  let updated = 0;
  let missing = 0;

  for (const batch of batches) {
    const names = batch.map((b) => b.name_ar);
    const found = await client.query(`select id, name_ar from public.products where name_ar = any($1::text[])`, [names]);
    const foundSet = new Set(found.rows.map((r) => r.name_ar));
    for (const b of batch) if (!foundSet.has(b.name_ar)) missing += 1;

    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      if (!foundSet.has(row.name_ar)) continue;
      values.push(`($${p++}::text, $${p++}::text)`);
      params.push(row.name_ar, row.sku);
    }

    if (!values.length) continue;

    const result = await client.query(
      `
      update public.products p
      set sku = v.sku
      from (values ${values.join(",")}) as v(name_ar, sku)
      where p.name_ar = v.name_ar
      `,
      params
    );
    updated += result.rowCount ?? 0;
  }

  await client.end();

  console.log(`Updated products: ${updated}`);
  console.log(`Missing products skipped: ${missing}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

