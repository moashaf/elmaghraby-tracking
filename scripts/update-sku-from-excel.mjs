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
 * Sets SKU to the Excel value exactly (no prefix added).
 * Match priority (highest wins per product):
 *   1) exact name
 *   2) normalized name (spacing/Arabic variants)
 *   3) parenthesis code at start of Excel row e.g. (109-12) — unique only
 */

import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const filePath = process.argv[2] ?? "c:/Users/hp/Downloads/Book3.xlsx";

const PRIORITY = { exact: 3, normalized: 2, paren: 1 };

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

  const map = new Map();
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

function normalizeName(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  return raw
    .normalize("NFKC")
    .replace(/[×✕✖]/g, "x")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)])
    .replace(/\s*وات\s*/g, " وات ")
    .replace(/\s*لتر\s*/g, " لتر ")
    .replace(/(\d)(\s*)(لتر)\b/g, "$1 $3")
    .replace(/[^\p{L}\p{N}\s\-\.\(\)\/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Only when Excel row starts with (109-12) — avoids SK-999N vs SK-999N+31 collisions */
function extractParenCodeAtStart(input) {
  const m = String(input ?? "").trim().match(/^\(([^)]+)\)/);
  return m?.[1]?.trim().toLowerCase() ?? "";
}

/** Any (code) in product name — used for DB index only */
function extractParenCodeAnywhere(input) {
  const m = String(input ?? "").match(/\(([^)]+)\)/);
  return m?.[1]?.trim().toLowerCase() ?? "";
}

async function buildProductIndex(db) {
  const res = await db.query(`select id, name_ar, sku from public.products`);
  const exact = new Map();
  const normalized = new Map();
  const byParen = new Map();
  const skuToId = new Map();

  for (const row of res.rows) {
    exact.set(row.name_ar, row);
    if (row.sku) skuToId.set(row.sku, row.id);
    const key = normalizeName(row.name_ar);
    if (key) {
      const list = normalized.get(key) ?? [];
      list.push(row);
      normalized.set(key, list);
    }
    const paren = extractParenCodeAnywhere(row.name_ar);
    if (paren) {
      const list = byParen.get(paren) ?? [];
      list.push(row);
      byParen.set(paren, list);
    }
  }
  return { exact, normalized, byParen, skuToId, total: res.rows.length };
}

async function assertSkuUnlocked(db) {
  const res = await db.query(`
    select tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'products' and t.tgname = 'products_lock_sku'
  `);
  if (res.rows.length) {
    console.error("");
    console.error("ERROR: products_lock_sku trigger is still active.");
    console.error("Run this in Supabase SQL Editor first:");
    console.error("  drop trigger if exists products_lock_sku on public.products;");
    console.error("  drop function if exists public.lock_product_sku();");
    console.error("");
    process.exit(1);
  }
}

function resolveMatches(entries, index) {
  const pending = new Map();
  let missing = 0;
  let ambiguous = 0;
  const stats = { exact: 0, normalized: 0, paren: 0 };

  function offer(product, sku, excelName, kind) {
    const priority = PRIORITY[kind];
    const current = pending.get(product.id);
    if (!current || priority > current.priority) {
      pending.set(product.id, {
        id: product.id,
        sku,
        excelName,
        productName: product.name_ar,
        priority,
        kind,
      });
    }
  }

  for (const row of entries) {
    const exact = index.exact.get(row.name_ar);
    if (exact) {
      offer(exact, row.sku, row.name_ar, "exact");
      continue;
    }

    const normKey = normalizeName(row.name_ar);
    if (normKey) {
      const normCandidates = index.normalized.get(normKey) ?? [];
      if (normCandidates.length === 1) {
        offer(normCandidates[0], row.sku, row.name_ar, "normalized");
        continue;
      }
      if (normCandidates.length > 1) {
        ambiguous += 1;
        continue;
      }
    }

    const paren = extractParenCodeAtStart(row.name_ar);
    if (paren) {
      const parenCandidates = index.byParen.get(paren) ?? [];
      if (parenCandidates.length === 1) {
        offer(parenCandidates[0], row.sku, row.name_ar, "paren");
        continue;
      }
      if (parenCandidates.length > 1) {
        ambiguous += 1;
        continue;
      }
    }

    missing += 1;
  }

  for (const item of pending.values()) {
    stats[item.kind] += 1;
  }

  return { pending, missing, ambiguous, stats };
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
  await assertSkuUnlocked(client);

  const index = await buildProductIndex(client);
  console.log(`Loaded products: ${index.total}`);

  const entries = [...map.entries()].map(([name_ar, sku]) => ({ name_ar, sku }));
  const { pending, missing, ambiguous, stats } = resolveMatches(entries, index);

  const updates = [...pending.values()];

  // Detect SKU collisions before writing (unique constraint on products.sku)
  const skuOwners = new Map(index.skuToId);
  const safeUpdates = [];
  let skuConflicts = 0;
  for (const row of updates) {
    const owner = skuOwners.get(row.sku);
    if (owner && owner !== row.id) {
      skuConflicts += 1;
      continue;
    }
    skuOwners.set(row.sku, row.id);
    safeUpdates.push(row);
  }

  const batches = chunk(safeUpdates, 500);
  let updated = 0;

  for (const batch of batches) {
    const values = [];
    const params = [];
    let p = 1;
    for (const row of batch) {
      values.push(`($${p++}::uuid, $${p++}::text)`);
      params.push(row.id, row.sku);
    }
    const result = await client.query(
      `
      update public.products p
      set sku = v.sku
      from (values ${values.join(",")}) as v(id, sku)
      where p.id = v.id
      `,
      params
    );
    updated += result.rowCount ?? 0;
  }

  await client.end();

  console.log(`Products to update (unique): ${updates.length}`);
  console.log(`Exact name matches: ${stats.exact}`);
  console.log(`Normalized name matches: ${stats.normalized}`);
  console.log(`Paren-code matches: ${stats.paren}`);
  console.log(`Skipped (SKU already used by another product): ${skuConflicts}`);
  console.log(`Updated products: ${updated}`);
  console.log(`Excel rows with no match: ${missing}`);
  console.log(`Ambiguous matches skipped: ${ambiguous}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
