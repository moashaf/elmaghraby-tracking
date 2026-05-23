import pg from "pg";
import { readFileSync } from "fs";

const text = readFileSync(".env.local", "utf8");
for (const line of text.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const i = trimmed.indexOf("=");
  if (i === -1) continue;
  process.env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
}

const ref = "qwlhsgxxekltqjheobna";
const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD);
const url = `postgresql://postgres.${ref}:${pw}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const constraints = await client.query(
  `select conname from pg_constraint where conrelid = 'public.product_categories'::regclass and contype = 'f'`
);
console.log("fkeys", constraints.rows);
const count = await client.query("select count(*)::int as n from product_categories");
console.log("count", count.rows[0].n);
await client.end();
