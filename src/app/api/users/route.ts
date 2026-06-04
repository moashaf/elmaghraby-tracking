import { z } from "zod";
import { jsonError, requireAdmin, upsertProfileRole, type AdminRole } from "@/lib/supabase/server";

const createUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  role: z.enum(["admin", "manager", "viewer"]),
});

async function loadProfiles(adminClient: ReturnType<typeof import("@/lib/supabase/server").createAdminClient>) {
  const withCode = await adminClient
    .from("profiles")
    .select("id, full_name, role, locale, user_code, created_at")
    .order("created_at", { ascending: false });

  if (!withCode.error) return withCode;

  const missingColumn =
    withCode.error.message.includes("user_code") || withCode.error.message.includes("schema cache");
  if (!missingColumn) return withCode;

  const fallback = await adminClient
    .from("profiles")
    .select("id, full_name, role, locale, created_at")
    .order("created_at", { ascending: false });

  if (fallback.error) return fallback;

  return {
    data: (fallback.data ?? []).map((row) => ({ ...row, user_code: null })),
    error: null,
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const [{ data: profiles, error: profilesError }, { data: authUsers, error: authError }] = await Promise.all([
    loadProfiles(admin.adminClient),
    admin.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesError) return jsonError(profilesError.message);
  if (authError) return jsonError(authError.message);

  const authById = new Map(authUsers.users.map((user) => [user.id, user]));
  const rows = (profiles ?? []).map((profile) => {
    const authUser = authById.get(profile.id);
    return {
      ...profile,
      email: authUser?.email ?? "",
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      confirmed_at: authUser?.confirmed_at ?? null,
    };
  });

  return Response.json({ users: rows });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("بيانات المستخدم غير صحيحة");

  const { email, full_name, password, role } = parsed.data;
  const { data, error } = await admin.adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error || !data.user) return jsonError(error?.message ?? "تعذر إنشاء المستخدم");

  const profileResult = await upsertProfileRole(admin.adminClient, {
    id: data.user.id,
    full_name,
    role: role as AdminRole,
  });

  if (profileResult.error) return jsonError(profileResult.error.message);

  return Response.json({ user: { id: data.user.id, email, full_name, role } }, { status: 201 });
}
