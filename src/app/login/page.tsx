"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn, ShipWheel } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { APP_CREDIT_NAME } from "@/lib/constants";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { checkSupabaseReachable, getSupabaseErrorMessage } from "@/lib/supabase/errors";

export default function LoginPage() {
  const router = useRouter();
  const { tr } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const config = readSupabaseConfig();
      if (!config.ok) {
        setError(config.message);
        setChecking(false);
        return;
      }

      const health = await checkSupabaseReachable(config.url, config.key);
      if (!health.ok) setError(health.message);
      setChecking(false);
    })();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured()) {
      setError(
        "إعدادات Supabase غير موجودة على الموقع المنشور. في Vercel: Environment Variables (الرابط + المفتاح) ثم Redeploy."
      );
      return;
    }

    setLoading(true);
    let supabase;
    try {
      supabase = createClient();
    } catch (configError) {
      setLoading(false);
      setError(configError instanceof Error ? configError.message : "إعدادات Supabase غير صحيحة.");
      return;
    }

    const { data, error: signInError } = await supabase.auth
      .signInWithPassword({
        email: email.trim(),
        password,
      })
      .catch((signInCatchError) => ({
        data: { session: null },
        error: new Error(getSupabaseErrorMessage(signInCatchError)),
      }));

    if (signInError) {
      setLoading(false);
      setError(getSupabaseErrorMessage(signInError));
      return;
    }

    if (!data.session) {
      setLoading(false);
      setError("تم تسجيل الدخول لكن الجلسة لم تُحفظ. أعد المحاولة.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="login-page grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]" dir="ltr">
      <div className="login-hero-panel relative">
        <Image
          alt=""
          aria-hidden
          className="login-hero-art"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 58vw"
          src="/login-ship-hero.png"
        />
      </div>

      <div className="login-form-panel" dir="auto">
        <div className="w-full max-w-md space-y-4">
          <div className="login-hero-copy hidden text-center lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f766e]">Elmaghraby Tracing</p>
            <h2 className="mt-2 text-2xl font-bold leading-snug text-[#1e293b]">
              {tr("نظام تتبع الشحنات والاستيراد", "Shipment & import tracking", "货运与进口跟踪系统")}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tr(
                "تابع شحناتك من البحر حتى الجمارك — في مكان واحد.",
                "Track shipments from sea to customs — in one place."
              )}
            </p>
          </div>
          <form className="card login-form-card w-full space-y-5 p-6" onSubmit={submit}>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-[#0f766e] text-white">
                <ShipWheel className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{tr("تسجيل الدخول", "Sign in", "登录")}</h1>
                <p className="text-sm text-[var(--muted)]">Elmaghraby Tracing</p>
              </div>
            </div>
            <ErrorMessage message={error} />
            <label className="label">
              {tr("البريد الإلكتروني", "Email", "邮箱")}
              <input
                className="input"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="label">
              {tr("كلمة المرور", "Password", "密码")}
              <input
                className="input"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="btn w-full" disabled={loading || checking || Boolean(error)} type="submit">
              <LogIn className="h-4 w-4" />
              {checking
                ? tr("جاري التحقق...", "Checking...")
                : loading
                  ? tr("جاري الدخول...", "Signing in...")
                  : tr("دخول", "Sign in")}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--muted)]">Powered by {APP_CREDIT_NAME}</p>
        </div>
      </div>
    </div>
  );
}
