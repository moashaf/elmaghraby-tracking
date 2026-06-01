"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Save, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/admin-guard";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

type Role = UserRole;

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "viewer" as Role,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession().catch(() => ({ data: { session: null } }));
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    let response: Response;
    let payload: { error?: string };
    try {
      response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });
      payload = await response.json();
    } catch (saveError) {
      setSaving(false);
      setError(getSupabaseErrorMessage(saveError));
      return;
    }
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "تعذر إنشاء المستخدم.");
      return;
    }

    router.push("/users");
    router.refresh();
  }

  return (
    <AdminGuard>
    <div className="space-y-5">
      <PageHeader
        title="إنشاء مستخدم"
        description="حساب جديد بصلاحيات واضحة داخل النظام."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill className="bg-emerald-50 text-emerald-700">
              <UserPlus className="inline h-3.5 w-3.5" /> admin only
            </StatusPill>
            <Link className="btn btn-secondary text-sm" href="/users">
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Link>
          </div>
        }
      />
      <ErrorMessage message={error} />

      <form className="card max-w-3xl space-y-4 p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            اسم المستخدم
            <input
              className="input"
              required
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            />
          </label>
          <label className="label">
            البريد الإلكتروني
            <input
              className="input"
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className="label">
            كلمة المرور
            <input
              className="input"
              minLength={6}
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <label className="label">
            الدور
            <select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="btn" disabled={saving} type="submit">
          <Save className="h-4 w-4" />
          {saving ? "جاري الإنشاء..." : "إنشاء المستخدم"}
        </button>
      </form>
    </div>
    </AdminGuard>
  );
}
