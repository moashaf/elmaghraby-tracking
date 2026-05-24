/**
 * Delete a category and its products (root only by default).
 *
 * Usage:
 *   node scripts/delete-category.mjs "ماكينة موس"
 *   node scripts/delete-category.mjs "ماكينة موس" --include "خردوات"
 */

import { readFileSync } from "fs";
import pg from "pg";

const args = process.argv.slice(2);
const nameFlagIndex = args.indexOf("--name");
const rootArgIndex = args.indexOf("--root");
const rootFilter = rootArgIndex >= 0 ? args[rootArgIndex + 1] : null;
const categoryName =
  nameFlagIndex >= 0
    ? args[nameFlagIndex + 1]
    : args.find((arg, index) => !arg.startsWith("--") && arg !== rootFilter && index !== rootArgIndex + 1);

if (!categoryName) {
  console.error("Usage: node scripts/delete-category.mjs --name <category> [--root <parent>]");
  process.exit(1);
}

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

loadEnv();
const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing database credentials in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    let categoriesResult;
    if (rootFilter) {
      categoriesResult = await client.query(
        `select c.id, c.name_ar, c.code, p.name_ar as parent_name
         from public.product_categories c
         join public.product_categories p on p.id = c.parent_id
         where c.name_ar = $1 and p.name_ar = $2`,
        [categoryName, rootFilter]
      );
    } else {
      categoriesResult = await client.query(
        `select c.id, c.name_ar, c.code, null as parent_name
         from public.product_categories c
         where c.name_ar = $1 and c.parent_id is null`,
        [categoryName]
      );
    }

    if (!categoriesResult.rows.length) {
      throw new Error(`لم تُعثر على فئة «${categoryName}»${rootFilter ? ` تحت «${rootFilter}»` : " (رئيسية)"}.`);
    }

    let deletedProducts = 0;
    let skippedInShipments = 0;
    let deletedChildren = 0;

    for (const category of categoriesResult.rows) {
      const childCats = await client.query(`select id from public.product_categories where parent_id = $1`, [category.id]);
      for (const child of childCats.rows) {
        const childProducts = await client.query(`select id from public.products where category_id = $1`, [child.id]);
        for (const product of childProducts.rows) {
          const inShipment = await client.query(
            `select 1 from public.shipment_products where product_id = $1 limit 1`,
            [product.id]
          );
          if (inShipment.rows.length) {
            skippedInShipments += 1;
            continue;
          }
          await client.query(`delete from public.products where id = $1`, [product.id]);
          deletedProducts += 1;
        }
        await client.query(`delete from public.product_categories where id = $1`, [child.id]);
        deletedChildren += 1;
      }

      const products = await client.query(`select id from public.products where category_id = $1`, [category.id]);
      for (const product of products.rows) {
        const inShipment = await client.query(
          `select 1 from public.shipment_products where product_id = $1 limit 1`,
          [product.id]
        );
        if (inShipment.rows.length) {
          skippedInShipments += 1;
          continue;
        }
        await client.query(`delete from public.products where id = $1`, [product.id]);
        deletedProducts += 1;
      }

      await client.query(`delete from public.product_categories where id = $1`, [category.id]);
      console.log(`Deleted category: ${category.name_ar}${category.parent_name ? ` (${category.parent_name})` : ""} [${category.code}]`);
    }

    await client.query("commit");
    console.log(`Products deleted: ${deletedProducts}`);
    if (deletedChildren) console.log(`Child categories deleted: ${deletedChildren}`);
    if (skippedInShipments) console.log(`Skipped (linked to shipments): ${skippedInShipments}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
