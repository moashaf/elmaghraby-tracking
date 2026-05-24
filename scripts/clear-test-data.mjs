/**
 * Clears operational/test data while keeping auth users, profiles, and app settings.
 *
 * Usage: node scripts/clear-test-data.mjs
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

  const ref = url.replace("https://", "").split(".")[0];
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
}

loadEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

const clearSql = `
  truncate table
    public.audit_log,
    public.shipment_timeline_events,
    public.container_files,
    public.shipment_documents,
    public.shipment_costs,
    public.shipment_products,
    public.shipment_containers,
    public.shipments,
    public.shipping_routes,
    public.products,
    public.product_categories,
    public.suppliers,
    public.companies,
    public.entity_code_sequences
  restart identity cascade;
`;

async function main() {
  await client.connect();
  console.log("Clearing operational data...");
  await client.query(clearSql);
  const counts = await client.query(`
    select
      (select count(*)::int from public.shipments) as shipments,
      (select count(*)::int from public.products) as products,
      (select count(*)::int from public.companies) as companies,
      (select count(*)::int from public.suppliers) as suppliers,
      (select count(*)::int from public.profiles) as profiles
  `);
  console.log("Done.", counts.rows[0]);
  await client.end();
}

main().catch(async (error) => {
  console.error(error.message);
  await client.end().catch(() => {});
  process.exit(1);
});
