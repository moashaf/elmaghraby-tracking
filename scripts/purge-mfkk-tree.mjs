/**
 * Remove مفكك category tree, linked products, and shipment lines for those products.
 *
 * Usage:
 *   node scripts/purge-mfkk-tree.mjs           # dry-run (counts only)
 *   node scripts/purge-mfkk-tree.mjs --execute # apply deletes
 */

import { readFileSync } from "fs";
import pg from "pg";

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

  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) return null;

  const encoded = encodeURIComponent(password);
  const region = process.env.SUPABASE_DB_REGION || "eu-west-1";
  return `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

loadEnv();

const execute = process.argv.includes("--execute");
const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

const COLLECT_MFKK_IDS = `
with recursive mfkk_roots as (
  select id
  from public.product_categories
  where parent_id is null
    and (name_ar = 'مفكك' or code = 'MFKK')
),
mfkk_tree as (
  select id from mfkk_roots
  union all
  select c.id
  from public.product_categories c
  join mfkk_tree t on c.parent_id = t.id
),
mfkk_by_code as (
  select id
  from public.product_categories
  where code like 'MFKK%'
    and id not in (select id from mfkk_tree)
)
select id from mfkk_tree
union
select id from mfkk_by_code;
`;

async function main() {
  await client.connect();

  const { rows: categoryRows } = await client.query(COLLECT_MFKK_IDS);
  const categoryIds = categoryRows.map((row) => row.id);

  if (!categoryIds.length) {
    console.log("No مفكك categories found. Nothing to delete.");
    await client.end();
    return;
  }

  const { rows: productRows } = await client.query(
    `select id, sku, name_ar from public.products where category_id = any($1::uuid[])`,
    [categoryIds]
  );
  const productIds = productRows.map((row) => row.id);

  const { rows: shipmentLineRows } = productIds.length
    ? await client.query(
        `select id, shipment_id, product_id from public.shipment_products where product_id = any($1::uuid[])`,
        [productIds]
      )
    : { rows: [] };

  console.log("--- مفكك purge plan ---");
  console.log(`Categories to delete: ${categoryIds.length}`);
  console.log(`Products to delete:   ${productIds.length}`);
  console.log(`Shipment lines:       ${shipmentLineRows.length}`);

  if (!execute) {
    console.log("\nDry-run only. Re-run with --execute to apply.");
    await client.end();
    return;
  }

  await client.query("begin");

  try {
    if (shipmentLineRows.length) {
      await client.query(`delete from public.shipment_products where product_id = any($1::uuid[])`, [productIds]);
    }

    if (productIds.length) {
      await client.query(`delete from public.products where id = any($1::uuid[])`, [productIds]);
    }

    for (let pass = 0; pass < 50; pass += 1) {
      const result = await client.query(
        `delete from public.product_categories
         where id = any($1::uuid[])
           and not exists (
             select 1 from public.product_categories child where child.parent_id = product_categories.id
           )`,
        [categoryIds]
      );
      if ((result.rowCount ?? 0) === 0) break;
    }

    await client.query("commit");
    console.log("\nDone. مفكك tree removed.");
  } catch (error) {
    await client.query("rollback");
    console.error("Rollback:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
