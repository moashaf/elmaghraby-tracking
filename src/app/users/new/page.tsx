"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Save, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/admin-guard";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { toEntityOptions } from "@/lib/entity-options";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { Supplier } from "@/lib/types";

type Role = UserRole;

export default function NewUserPage() {
  const router = useRouter();
  const { tr } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "viewer" as Role,
    supplier_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void createClient()
      .from("suppliers")
      .select("id,name_ar,is_active")
      .eq("is_active", true)
      .order("name_ar")
      .then((result) => setSuppliers((result.data ?? []) as Supplier[]));
  }, []);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession().catch(() => ({ data: { session: null } }));
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

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
          supplier_id: form.role === "supplier" ? form.supplier_id || null : null,
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
        title={tr("إنشاء مستخدم", "Create user")}
        description={tr("حساب جديد بصلاحيات واضحة داخل النظام.", "Create a new user with clear permissions.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill className="bg-emerald-50 text-emerald-700">
              <UserPlus className="inline h-3.5 w-3.5" /> admin only
            </StatusPill>
            <Link className="btn btn-secondary text-sm" href="/users">
              <ArrowRight className="h-4 w-4" />
              {tr("رجوع", "Back")}
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
          {form.role === "supplier" ? (
            <label className="label md:col-span-2">
              المورد المرتبط
              <SearchableSelect
                options={toEntityOptions(suppliers, (row) => row.name_ar)}
                value={form.supplier_id}
                onChange={(value) => setForm({ ...form, supplier_id: value })}
                placeholder="اختر المورد"
              />
            </label>
          ) : null}
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
