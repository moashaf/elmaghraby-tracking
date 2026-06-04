import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

console.log("=== تشخيص المستخدمين والإعدادات ===\n");

console.log("متغيرات البيئة (محلي):");
console.log("  NEXT_PUBLIC_SUPABASE_URL:", url ? "موجود" : "ناقص");
console.log("  SUPABASE_SERVICE_ROLE_KEY:", serviceKey ? "موجود" : "ناقص (مطلوب لـ /api/users و /api/settings)");
console.log("  SUPABASE_DB_PASSWORD:", dbPassword ? "موجود" : "ناقص");

if (!url || !serviceKey) {
  console.log("\nأضف المفاتيح في .env.local ثم أعد تشغيل npm run dev");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error: profilesError } = await admin
  .from("profiles")
  .select("id, full_name, role, user_code, created_at")
  .order("created_at", { ascending: false });

if (profilesError) {
  console.log("\nprofiles:", profilesError.message);
} else {
  console.log("\nجدول profiles:", profiles.length, "سجل");
  for (const row of profiles) {
    console.log(`  - ${row.full_name ?? "(بدون اسم)"} | role=${row.role} | code=${row.user_code ?? "—"}`);
  }
}

const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 50 });
if (authError) {
  console.log("\nAuth listUsers:", authError.message);
} else {
  const authIds = new Set(authData.users.map((u) => u.id));
  const orphanAuth = authData.users.filter((u) => !profiles?.some((p) => p.id === u.id));
  const orphanProfiles = (profiles ?? []).filter((p) => !authIds.has(p.id));
  console.log("\nAuth users:", authData.users.length);
  if (orphanAuth.length) {
    console.log("  بدون profile (لن يظهروا بصلاحيات صحيحة):");
    for (const u of orphanAuth) console.log(`    - ${u.email}`);
  }
  if (orphanProfiles.length) console.log("  profiles بدون auth:", orphanProfiles.length);
}

const { data: settings, error: settingsError } = await admin
  .from("app_settings")
  .select("key, value")
  .eq("key", "system")
  .maybeSingle();

if (settingsError) {
  console.log("\napp_settings:", settingsError.message);
  console.log("  → شغّل supabase/patch-missing-tables.sql في SQL Editor");
} else {
  console.log("\napp_settings: OK", settings?.value ? "(يوجد سجل system)" : "(افتراضي)");
}

if (dbPassword && url) {
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-${process.env.SUPABASE_DB_REGION || "eu-west-1"}.pooler.supabase.com:5432/postgres`;
  const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const fn = await client.query(
    "select proname from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and proname = 'current_user_role'"
  );
  console.log("\nدالة current_user_role (لـ RLS إعدادات):", fn.rows.length ? "موجودة" : "ناقصة — شغّل migrations");
  await client.end();
}

console.log("\n--- Vercel (الموقع المنشور) ---");
console.log("أضف نفس SUPABASE_SERVICE_ROLE_KEY في: Project → Settings → Environment Variables");
console.log("ثم Redeploy.");
console.log("\n--- صفحة المستخدمين ---");
console.log("لازم تسجل دخول بحساب role=admin في profiles.");
console.log("لو «غير مصرح»: حدّث profiles.role إلى admin لإيميلك.");
