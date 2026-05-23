/**
 * Applies SQL migration files to the remote Supabase Postgres database.
 *
 * Requires in .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_DB_PASSWORD   — Database password from Supabase Dashboard → Settings → Database
 *
 * Usage:
 *   node scripts/apply-migrations.mjs
 *   node scripts/apply-migrations.mjs 20260522000007_product_categories.sql
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
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
  // Session pooler (IPv4) — direct db.* host often resolves to IPv6 only on Windows.
  return `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

loadEnv();

const dbUrl = getDatabaseUrl();
if (!dbUrl) {
  console.error(
    "Set SUPABASE_DB_PASSWORD (or DATABASE_URL) in .env.local.\n" +
      "Password: Supabase Dashboard → Project Settings → Database → Database password"
  );
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const filterArg = process.argv[2];

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .filter((name) => !filterArg || name.includes(filterArg))
  .sort();

if (files.length === 0) {
  console.error("No migration files matched.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`Connected. Applying ${files.length} migration file(s)...`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`→ ${file}`);
    await client.query(sql);
    console.log(`  OK`);
  }

  console.log("Done.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
