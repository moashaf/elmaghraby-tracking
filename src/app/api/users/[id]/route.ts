import { z } from "zod";
import { jsonError, requireAdmin, upsertProfileRole, type AdminRole } from "@/lib/supabase/server";

const updateUserSchema = z.object({
  full_name: z.string().min(2),
  role: z.enum(["admin", "manager", "viewer", "supplier"]),
  supplier_id: z.string().uuid().optional().nullable(),
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

  if (parsed.data.role === "supplier" && !parsed.data.supplier_id) {
    return jsonError("يجب ربط حساب المورد بمورد من القائمة.");
  }

  const { error } = await upsertProfileRole(admin.adminClient, {
    id,
    full_name: parsed.data.full_name,
    role: parsed.data.role as AdminRole,
    supplier_id: parsed.data.role === "supplier" ? parsed.data.supplier_id ?? null : null,
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
