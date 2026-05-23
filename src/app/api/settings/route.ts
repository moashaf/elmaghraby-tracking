import { z } from "zod";
import { createAdminClient, createRequestClient, jsonError, requireAdmin } from "@/lib/supabase/server";

const settingsSchema = z.object({
  require_costs_before_close: z.boolean(),
  require_customs_document: z.boolean(),
  delayed_after_eta_days: z.number().int().min(0).max(365),
});

export async function GET(request: Request) {
  const requestClient = createRequestClient(request);
  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser();
  if (error || !user) return jsonError("غير مصرح بالدخول", 401);

  const { data, error: settingsError } = await createAdminClient()
    .from("app_settings")
    .select("key, value")
    .eq("key", "system")
    .maybeSingle();

  if (settingsError) return jsonError(settingsError.message);

  return Response.json({
    settings: data?.value ?? {
      require_costs_before_close: true,
      require_customs_document: false,
      delayed_after_eta_days: 0,
    },
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("إعدادات النظام غير صحيحة");

  const { error } = await admin.adminClient.from("app_settings").upsert({
    key: "system",
    value: parsed.data,
    updated_by: admin.user.id,
  });

  if (error) return jsonError(error.message);
  return Response.json({ settings: parsed.data });
}
