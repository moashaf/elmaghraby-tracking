import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { ROLE_LABELS } from "@/lib/permissions";

export type AdminRole = "admin" | "manager" | "viewer" | "supplier";

function getAccessToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function sanitizeEnvKey(value: string | undefined) {
  if (!value) return null;
  let cleaned = value.trim().replace(/[\r\n]+/g, "");
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || null;
}

/** Legacy JWT keys (eyJ…) only — not sb_secret_ / sb_publishable_. */
function isJwtKey(key: string) {
  return key.startsWith("eyJ") && key.split(".").length === 3;
}

/** Server-only Supabase secret (sb_secret_… or legacy JWT service_role). */
export function getServiceRoleKey() {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ];
  for (const value of candidates) {
    const cleaned = sanitizeEnvKey(value);
    if (cleaned) return cleaned;
  }
  return null;
}

/** sb_secret keys must use apikey only — not Authorization: Bearer (invalid in fetch). */
function createServiceRoleFetch(serviceRoleKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", serviceRoleKey);
    if (isJwtKey(serviceRoleKey)) {
      headers.set("Authorization", `Bearer ${serviceRoleKey}`);
    }
    return fetch(input, { ...init, headers });
  };
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createServiceRoleFetch(serviceRoleKey),
    },
  });
}

function serverConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "إعدادات السيرفر ناقصة: أضف SUPABASE_SERVICE_ROLE_KEY (مفتاح Secret من Supabase) في Vercel → Environment Variables، فعّل Production + Preview، ثم Redeploy (بدون Redeploy المتغير لا يشتغل).";
  }
  if (message.includes("NEXT_PUBLIC_SUPABASE_URL") || message.includes("public Supabase key")) {
    return "إعدادات Supabase ناقصة في Vercel: تأكد من NEXT_PUBLIC_SUPABASE_URL والمفتاح العام ثم أعد النشر.";
  }
  return message || "تعذر تجهيز اتصال Supabase على السيرفر.";
}

export function createRequestClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = sanitizeEnvKey(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or public Supabase key.");
  }

  const accessToken = getAccessToken(request);
  const globalHeaders: Record<string, string> = {};
  if (accessToken && isJwtKey(accessToken)) {
    globalHeaders.Authorization = `Bearer ${accessToken}`;
  }

  return createSupabaseClient(url, key, {
    global: { headers: globalHeaders },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAdmin(request: Request) {
  let requestClient: ReturnType<typeof createRequestClient>;
  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    requestClient = createRequestClient(request);
    adminClient = createAdminClient();
  } catch (configError) {
    return { ok: false as const, error: serverConfigError(configError), status: 500 as const };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return { ok: false as const, error: "غير مصرح بالدخول — أعد تسجيل الدخول.", status: 401 as const };
  }

  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser(accessToken).catch((authError) => ({
    data: { user: null },
    error: authError instanceof Error ? authError : new Error("تعذر التحقق من الجلسة."),
  }));

  if (error || !user) {
    return { ok: false as const, error: "غير مصرح بالدخول — أعد تسجيل الدخول.", status: 401 as const };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    const hint = profileError.message.includes("invalid header")
      ? " تأكد أن SUPABASE_SERVICE_ROLE_KEY في Vercel هو Secret key كامل بدون مسافات أو علامات اقتباس زائدة."
      : "";
    return {
      ok: false as const,
      error: `تعذر التحقق من الصلاحيات: ${profileError.message}${hint}`,
      status: 500 as const,
    };
  }

  if (!profile) {
    return {
      ok: false as const,
      error: "لا يوجد ملف لحسابك. سجّل خروج ثم ادخل مجدداً، أو اطلب من مدير النظام إنشاء ملفك.",
      status: 403 as const,
    };
  }

  if (profile.role !== "admin") {
    const roleLabel = ROLE_LABELS[profile.role as AdminRole] ?? profile.role;
    return {
      ok: false as const,
      error: `دورك الحالي «${roleLabel}» — صفحة المستخدمين للمدير (admin) فقط.`,
      status: 403 as const,
    };
  }

  return { ok: true as const, user, profile, adminClient };
}

export async function requireWriter(request: Request) {
  let requestClient: ReturnType<typeof createRequestClient>;
  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    requestClient = createRequestClient(request);
    adminClient = createAdminClient();
  } catch (configError) {
    return { ok: false as const, error: serverConfigError(configError), status: 500 as const };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return { ok: false as const, error: "غير مصرح بالدخول — أعد تسجيل الدخول.", status: 401 as const };
  }

  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser(accessToken).catch((authError) => ({
    data: { user: null },
    error: authError instanceof Error ? authError : new Error("تعذر التحقق من الجلسة."),
  }));

  if (error || !user) {
    return { ok: false as const, error: "غير مصرح بالدخول — أعد تسجيل الدخول.", status: 401 as const };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false as const, error: `تعذر التحقق من الصلاحيات: ${profileError.message}`, status: 500 as const };
  }

  if (!profile) {
    return { ok: false as const, error: "لا يوجد ملف لحسابك.", status: 403 as const };
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    return { ok: false as const, error: "ليس لديك صلاحية تعديل الشحنات.", status: 403 as const };
  }

  return { ok: true as const, user, profile, adminClient };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function upsertProfileRole(
  adminClient: SupabaseClient,
  values: { id: string; full_name: string; role: AdminRole; supplier_id?: string | null }
) {
  return adminClient.from("profiles").upsert({
    id: values.id,
    full_name: values.full_name,
    role: values.role,
    supplier_id: values.role === "supplier" ? values.supplier_id ?? null : null,
    locale: "ar",
  });
}
