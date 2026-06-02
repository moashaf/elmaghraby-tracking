"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Save, Settings, ShieldCheck, UserRound } from "lucide-react";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { useProfile } from "@/context/profile-context";
import { useLanguage } from "@/context/language-context";
import { useTheme } from "@/context/theme-context";
import { DEFAULT_THEME } from "@/lib/theme";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

type Role = UserRole;

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  locale: string;
};

type SystemSettings = {
  require_costs_before_close: boolean;
  require_customs_document: boolean;
  delayed_after_eta_days: number;
};

const defaultSettings: SystemSettings = {
  require_costs_before_close: true,
  require_customs_document: false,
  delayed_after_eta_days: 0,
};

export default function SettingsPage() {
  const { isAdmin: userIsAdmin } = useProfile();
  const { tr } = useLanguage();
  const { theme, patchTheme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = userIsAdmin;

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession().catch(() => ({ data: { session: null } }));
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser().catch((loadError) => ({
      data: { user: null },
      error: loadError instanceof Error ? loadError : new Error("تعذر التحقق من الجلسة."),
    }));

    if (userError || !user) {
      setLoading(false);
      setError("سجل الدخول أولا.");
      return;
    }

    setEmail(user.email ?? "");
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, locale")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setLoading(false);
      setError(profileError.message);
      return;
    }

    let response: Response;
    let payload: { settings?: SystemSettings; error?: string };
    try {
      response = await fetch("/api/settings", {
        headers: await authHeaders(),
      });
      payload = await response.json();
    } catch (settingsError) {
      setLoading(false);
      setError(getSupabaseErrorMessage(settingsError));
      return;
    }

    setProfile(profileRow as Profile);
    setFullName(profileRow.full_name ?? "");
    setSettings(payload.settings ?? defaultSettings);
    setLoading(false);

    if (!response.ok) setError(payload.error ?? "تعذر تحميل إعدادات النظام.");
  }, [authHeaders]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!profile) return;

    setSavingProfile(true);
    const { error: updateError } = await createClient()
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", profile.id);
    setSavingProfile(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("تم حفظ الملف الشخصي.");
    await load();
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingSettings(true);

    let response: Response;
    let payload: { settings?: SystemSettings; error?: string };
    try {
      response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify(settings),
      });
      payload = await response.json();
    } catch (settingsError) {
      setSavingSettings(false);
      setError(getSupabaseErrorMessage(settingsError));
      return;
    }
    setSavingSettings(false);

    if (!response.ok) {
      setError(payload.error ?? "تعذر حفظ إعدادات النظام.");
      return;
    }

    setSettings(payload.settings ?? settings);
    setMessage("تم حفظ إعدادات النظام.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("الإعدادات", "Settings")}
        description={tr("إدارة الملف الشخصي وإعدادات التشغيل العامة.", "Manage your profile and system settings.")}
      />
      <ErrorMessage message={error} />
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="card space-y-4 p-4">
        <div className="font-bold">المظهر والثيم</div>
        <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-sm font-semibold">
          الوضع الداكن
          <input checked={theme.darkMode} onChange={(event) => patchTheme({ darkMode: event.target.checked })} type="checkbox" />
        </label>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="label">
            اللون الأساسي
            <input className="input h-11" type="color" value={theme.primary} onChange={(event) => patchTheme({ primary: event.target.value })} />
          </label>
          <label className="label">
            لون الشريط الجانبي
            <input className="input h-11" type="color" value={theme.navy} onChange={(event) => patchTheme({ navy: event.target.value })} />
          </label>
          <label className="label">
            لون الخلفية
            <input className="input h-11" type="color" value={theme.background} onChange={(event) => patchTheme({ background: event.target.value })} />
          </label>
          <label className="label">
            لون الخط
            <input className="input h-11" type="color" value={theme.fontColor} onChange={(event) => patchTheme({ fontColor: event.target.value })} />
          </label>
        </div>
        <button className="btn btn-secondary text-sm" onClick={() => setTheme(DEFAULT_THEME)} type="button">
          استعادة الألوان الافتراضية
        </button>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <form className="card space-y-4 p-4" onSubmit={saveProfile}>
          <div className="flex items-center gap-2 font-bold">
            <UserRound className="h-5 w-5 text-[var(--primary)]" />
            الملف الشخصي
          </div>
          <label className="label">
            الاسم
            <input className="input" disabled={loading} value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="label">
            البريد الإلكتروني
            <input className="input" disabled value={email} />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            الدور الحالي:
            <StatusPill className="bg-slate-100 text-slate-700">{profile ? ROLE_LABELS[profile.role] : "..."}</StatusPill>
          </div>
          <button className="btn" disabled={savingProfile || loading} type="submit">
            <Save className="h-4 w-4" />
            {savingProfile ? "جاري الحفظ..." : "حفظ الملف"}
          </button>
        </form>

        <form className="card space-y-4 p-4" onSubmit={saveSettings}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold">
              <Settings className="h-5 w-5 text-[var(--primary)]" />
              إعدادات النظام
            </div>
            <StatusPill className={isAdmin ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
              {isAdmin ? "admin" : "قراءة فقط"}
            </StatusPill>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-sm font-semibold">
            إلزام تسجيل المصاريف قبل الإغلاق
            <input
              checked={settings.require_costs_before_close}
              disabled={!isAdmin}
              type="checkbox"
              onChange={(event) => setSettings({ ...settings, require_costs_before_close: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-sm font-semibold">
            إلزام مستند جمركي قبل الإغلاق
            <input
              checked={settings.require_customs_document}
              disabled={!isAdmin}
              type="checkbox"
              onChange={(event) => setSettings({ ...settings, require_customs_document: event.target.checked })}
            />
          </label>
          <label className="label">
            اعتبار الشحنة متأخرة بعد ETA بعدد أيام
            <input
              className="input"
              disabled={!isAdmin}
              min={0}
              type="number"
              value={settings.delayed_after_eta_days}
              onChange={(event) => setSettings({ ...settings, delayed_after_eta_days: Number(event.target.value) })}
            />
          </label>
          <button className="btn" disabled={!isAdmin || savingSettings || loading} type="submit">
            <ShieldCheck className="h-4 w-4" />
            {savingSettings ? "جاري الحفظ..." : "حفظ إعدادات النظام"}
          </button>
        </form>
      </div>

      <section className="card grid gap-3 p-4 text-sm text-[var(--muted)] md:grid-cols-3">
        <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <Info className="h-4 w-4 text-[var(--primary)]" />
          حول النظام
        </div>
        <div>Elmaghraby Tracing v0.1.0</div>
        <div>Supabase + Next.js + Arabic RTL</div>
      </section>
    </div>
  );
}
