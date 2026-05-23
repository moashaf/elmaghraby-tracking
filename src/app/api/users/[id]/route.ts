import { z } from "zod";
import { jsonError, requireAdmin, upsertProfileRole, type AdminRole } from "@/lib/supabase/server";

const updateUserSchema = z.object({
  full_name: z.string().min(2),
  role: z.enum(["admin", "manager", "viewer"]),
});

export async function PATCH(request: Request, context: RouteContext<"/api/users/[id]">) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const { id } = await context.params;
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("بيانات المستخدم غير صحيحة");

  const { error: authError } = await admin.adminClient.auth.admin.updateUserById(id, {
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (authError) return jsonError(authError.message);

  const { error } = await upsertProfileRole(admin.adminClient, {
    id,
    full_name: parsed.data.full_name,
    role: parsed.data.role as AdminRole,
  });
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext<"/api/users/[id]">) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const { id } = await context.params;
  if (id === admin.user.id) return jsonError("لا يمكن حذف المستخدم الحالي");

  const { error } = await admin.adminClient.auth.admin.deleteUser(id);
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}
