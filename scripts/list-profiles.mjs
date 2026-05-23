import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error: pErr } = await admin
  .from("profiles")
  .select("id, full_name, role, created_at")
  .order("created_at");

if (pErr) {
  console.error("profiles:", pErr.message);
  process.exit(1);
}

const { data: auth, error: aErr } = await admin.auth.admin.listUsers({ perPage: 100 });
if (aErr) {
  console.error("auth:", aErr.message);
  process.exit(1);
}

const emailById = Object.fromEntries(auth.users.map((u) => [u.id, u.email]));
const rows = (profiles ?? []).map((p) => ({ ...p, email: emailById[p.id] ?? null }));
console.log(JSON.stringify(rows, null, 2));
