export function getSupabaseErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";

  const combined = `${message} ${cause}`.trim();

  if (
    combined.includes("ENOTFOUND") ||
    combined.includes("tenant/user") ||
    combined.includes("not found")
  ) {
    return "مشروع Supabase غير موجود أو متوقف. افتح supabase.com/dashboard وتأكد أن المشروع شغال، ثم حدّث NEXT_PUBLIC_SUPABASE_URL والمفتاح في Vercel وأعد النشر.";
  }

  if (
    message.includes("fetch failed") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  ) {
    return "تعذر الاتصال بـ Supabase. تأكد من رابط NEXT_PUBLIC_SUPABASE_URL في Vercel، وأن مشروع Supabase يعمل، ثم Redeploy.";
  }

  return message || "حدث خطأ غير متوقع أثناء الاتصال بـ Supabase.";
}

export async function checkSupabaseReachable(url: string, key: string) {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
    });
    if (!response.ok) {
      return { ok: false as const, message: `Supabase ردّ بحالة ${response.status}. تحقق من إعدادات المشروع.` };
    }
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: getSupabaseErrorMessage(error) };
  }
}
