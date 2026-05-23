"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShipWheel } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { APP_CREDIT_NAME } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
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
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-3">
      <form className="card w-full space-y-5 p-6" onSubmit={submit}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[#0f766e] text-white">
            <ShipWheel className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">تسجيل الدخول</h1>
            <p className="text-sm text-[var(--muted)]">Elmaghraby Tracing</p>
          </div>
        </div>
        <ErrorMessage message={error} />
        <label className="label">
          البريد الإلكتروني
          <input className="input" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="label">
          كلمة المرور
          <input className="input" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="btn w-full" disabled={loading} type="submit">
          <LogIn className="h-4 w-4" />
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
      <p className="text-center text-xs text-[var(--muted)]">Powered by {APP_CREDIT_NAME}</p>
      </div>
    </main>
  );
}
