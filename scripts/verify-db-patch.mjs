import { readFileSync } from "fs";
import pg from "pg";

function loadEnv() {
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
}

loadEnv();

const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-0-${process.env.SUPABASE_DB_REGION || "eu-west-1"}.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query("alter table public.profiles add column if not exists user_code text unique");

const [{ rows: mfkk }, { rows: settings }, { rows: userCode }] = await Promise.all([
  client.query(
    "select count(*)::int as n from public.product_categories where name_ar = 'مفكك' or code like 'MFKK%'"
  ),
  client.query("select to_regclass('public.app_settings') as t"),
  client.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_code'"
  ),
]);

console.log("mfkk categories left:", mfkk[0].n);
console.log("app_settings table:", settings[0].t ?? "missing");
console.log("profiles.user_code:", userCode.length ? "yes" : "no");

await client.end();
