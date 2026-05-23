import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export type AdminRole = "admin" | "manager" | "viewer";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createRequestClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or public Supabase key.");
  }

  return createSupabaseClient(url, key, {
    global: {
      headers: {
        Authorization: request.headers.get("authorization") ?? "",
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAdmin(request: Request) {
  const requestClient = createRequestClient(request);
  const adminClient = createAdminClient();
  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser();

  if (error || !user) {
    return { ok: false as const, error: "غير مصرح بالدخول", status: 401 as const };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { ok: false as const, error: "هذه الصفحة متاحة للمدير فقط", status: 403 as const };
  }

  return { ok: true as const, user, profile, adminClient };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function upsertProfileRole(
  adminClient: SupabaseClient,
  values: { id: string; full_name: string; role: AdminRole }
) {
  return adminClient.from("profiles").upsert({
    id: values.id,
    full_name: values.full_name,
    role: values.role,
    locale: "ar",
  });
}
