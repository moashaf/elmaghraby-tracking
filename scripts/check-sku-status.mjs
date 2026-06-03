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
  console.error("Missing DB env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const samples = await client.query(`
  select name_ar, sku from public.products
  where name_ar ilike '%SK-999N%' and name_ar ilike '%خلاط%'
  limit 3
`);
console.log("SK-999N blender:", samples.rows);

const bag = await client.query(`
  select name_ar, sku from public.products
  where name_ar ilike '%109-12%'
  limit 3
`);
console.log("109-12 bag:", bag.rows);

const numeric = await client.query(`select count(*)::int as n from public.products where sku ~ '^[0-9]+$'`);
const oldPattern = await client.query(
  `select count(*)::int as n from public.products where sku ~ '^[A-Z]+[0-9]+-'`
);
console.log("Products with numeric-only SKU:", numeric.rows[0].n);
console.log("Products with old prefix SKU (GIFT09- etc):", oldPattern.rows[0].n);

const triggers = await client.query(`
  select tgname
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where c.relname = 'products' and not t.tgisinternal
`);
console.log(
  "products triggers:",
  triggers.rows.map((r) => r.tgname)
);

await client.end();
