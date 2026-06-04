import { z } from "zod";
import { createAdminClient, createRequestClient, jsonError, requireAdmin } from "@/lib/supabase/server";

const settingsSchema = z.object({
  require_costs_before_close: z.boolean(),
  require_customs_document: z.boolean(),
  delayed_after_eta_days: z.number().int().min(0).max(365),
});

export async function GET(request: Request) {
  let requestClient: ReturnType<typeof createRequestClient>;
  try {
    requestClient = createRequestClient(request);
  } catch {
    return jsonError("إعدادات Supabase ناقصة في Vercel: تأكد من NEXT_PUBLIC_SUPABASE_URL والمفتاح العام ثم أعد النشر.", 500);
  }

  const {
    data: { user },
    error,
  } = await requestClient.auth.getUser().catch((authError) => ({
    data: { user: null },
    error: authError instanceof Error ? authError : new Error("تعذر التحقق من الجلسة."),
  }));
  if (error || !user) return jsonError("غير مصرح بالدخول", 401);

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return jsonError("إعدادات السيرفر ناقصة: أضف SUPABASE_SERVICE_ROLE_KEY في Vercel Environment Variables ثم أعد النشر.", 500);
  }

  const { data, error: settingsError } = await adminClient
    .from("app_settings")
    .select("key, value")
    .eq("key", "system")
    .maybeSingle();

  const defaultSettings = {
    require_costs_before_close: true,
    require_customs_document: false,
    delayed_after_eta_days: 0,
  };

  if (settingsError) {
    const missingTable =
      settingsError.message.includes("app_settings") || settingsError.message.includes("schema cache");
    if (missingTable) {
      return Response.json({
        settings: defaultSettings,
        warning:
          "جدول إعدادات النظام غير موجود. شغّل supabase/patch-missing-tables.sql من SQL Editor ثم حدّث الصفحة.",
      });
    }
    return jsonError(settingsError.message);
  }

  return Response.json({
    settings: data?.value ?? defaultSettings,
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

  if (error) {
    const missingTable = error.message.includes("app_settings") || error.message.includes("schema cache");
    if (missingTable) {
      return jsonError(
        "جدول إعدادات النظام غير موجود. شغّل supabase/patch-missing-tables.sql من Supabase SQL Editor.",
        503
      );
    }
    return jsonError(error.message);
  }
  return Response.json({ settings: parsed.data });
}
