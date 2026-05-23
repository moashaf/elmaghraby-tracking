function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function readSupabaseConfig() {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = trimEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!url || !key) {
    return {
      ok: false as const,
      message:
        "إعدادات Supabase غير موجودة على السيرفر. في Vercel: Environment Variables ثم Redeploy.",
    };
  }

  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("bad protocol");
    }
  } catch {
    return {
      ok: false as const,
      message: "رابط Supabase غير صحيح. تأكدي من NEXT_PUBLIC_SUPABASE_URL في Vercel (بدون مسافات أو علامات تنصيص).",
    };
  }

  return { ok: true as const, url, key };
}

export function isSupabaseConfigured() {
  return readSupabaseConfig().ok;
}
