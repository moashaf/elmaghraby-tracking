/**
 * Import product categories from Excel (parent + subcategory columns).
 *
 * Usage:
 *   node scripts/import-categories.mjs
 *   node scripts/import-categories.mjs "c:/path/to/file.xlsx"
 */

import { readFileSync } from "fs";
import pg from "pg";
import XLSX from "xlsx";

const defaultPath = "c:/Users/hp/Downloads/فئات رئيسية + فرعية.xlsx";
const filePath = process.argv[2] ?? defaultPath;

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
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let currentParent = null;
  const tree = [];

  for (let index = 1; index < rows.length; index += 1) {
    const main = String(rows[index][0] ?? "").trim();
    const sub = String(rows[index][1] ?? "").trim();

    if (main) {
      currentParent = main;
      tree.push({ parent: main, children: [] });
      continue;
    }

    if (sub && currentParent) {
      tree[tree.length - 1].children.push(sub);
    }
  }

  return tree;
}

function parentCode(name) {
  if (PARENT_CODES[name]) return PARENT_CODES[name];
  const latin = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (latin.slice(0, 6) || "CAT") + Math.random().toString(36).slice(2, 4).toUpperCase();
}

function childCode(parent, index) {
  return `${parentCode(parent)}-${String(index).padStart(2, "0")}`;
}

loadEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const tree = parseWorkbook(filePath);
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  const existing = await client.query("select count(*)::int as count from public.product_categories");
  if (existing.rows[0].count > 0) {
    console.log(`Clearing ${existing.rows[0].count} existing categories...`);
    await client.query("delete from public.product_categories");
  }

  let parentCount = 0;
  let childCount = 0;

  for (const group of tree) {
    const code = parentCode(group.parent);
    const parentResult = await client.query(
      `insert into public.product_categories (name_ar, code, parent_id, is_active)
       values ($1, $2, null, true)
       returning id`,
      [group.parent, code]
    );
    const parentId = parentResult.rows[0].id;
    parentCount += 1;

    for (let index = 0; index < group.children.length; index += 1) {
      const childName = group.children[index];
      await client.query(
        `insert into public.product_categories (name_ar, code, parent_id, is_active)
         values ($1, $2, $3, true)`,
        [childName, childCode(group.parent, index + 1), parentId]
      );
      childCount += 1;
    }
  }

  const summary = await client.query(`
    select
      (select count(*)::int from public.product_categories where parent_id is null) as parents,
      (select count(*)::int from public.product_categories where parent_id is not null) as children
  `);

  console.log(`Imported from: ${filePath}`);
  console.log(`Parents inserted: ${parentCount}`);
  console.log(`Children inserted: ${childCount}`);
  console.log("Database totals:", summary.rows[0]);

  await client.end();
}

main().catch(async (error) => {
  console.error(error.message);
  await client.end().catch(() => {});
  process.exit(1);
});
