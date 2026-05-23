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

const emailArg = process.argv[2];
if (!emailArg) {
  console.error("Usage: node scripts/promote-admin.mjs <email>");
  process.exit(1);
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

const { data: auth, error: aErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (aErr) {
  console.error("auth:", aErr.message);
  process.exit(1);
}

const user = auth.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());
if (!user) {
  console.error("User not found:", emailArg);
  process.exit(1);
}

const fullName =
  (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
  user.email?.split("@")[0] ||
  "Admin";

const { data, error } = await admin
  .from("profiles")
  .upsert({
    id: user.id,
    full_name: fullName,
    role: "admin",
    locale: "ar",
  })
  .select("id, full_name, role")
  .single();

if (error) {
  console.error("update:", error.message);
  process.exit(1);
}

console.log("Updated to admin:", { email: user.email, ...data });
