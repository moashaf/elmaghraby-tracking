"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit2, Plus, Save, Search, Trash2, Users } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Role = UserRole;

type UserRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  email: string;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
};

type UserForm = {
  id?: string;
  full_name: string;
  email: string;
  password: string;
  role: Role;
};

const emptyForm: UserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "viewer",
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/users", {
      headers: await authHeaders(),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "تعذر تحميل المستخدمين.");
      return;
    }

    setRows(payload.users ?? []);
  }, [authHeaders]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.full_name, row.user_code, row.email, ROLE_LABELS[row.role]].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, rows]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const isEdit = Boolean(form.id);
    const response = await fetch(isEdit ? `/api/users/${form.id}` : "/api/users", {
      method: isEdit ? "PATCH" : "POST",
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
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "تعذر حفظ المستخدم.");
      return;
    }

    setForm(emptyForm);
    await load();
  }

  async function removeUser(id: string) {
    setError("");
    setDeletingId(id);
    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    const payload = await response.json();
    setDeletingId("");

    if (!response.ok) {
      setError(payload.error ?? "تعذر حذف المستخدم.");
      return;
    }

    await load();
  }

  return (
    <AdminGuard>
    <div className="space-y-5">
      <PageHeader
        title="المستخدمون"
        description="إنشاء حسابات Supabase Auth وتحديد صلاحيات العمل داخل النظام."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill className="bg-emerald-50 text-emerald-700">
              <Users className="inline h-3.5 w-3.5" /> admin only
            </StatusPill>
            <Link className="btn text-sm" href="/users/new">
              <Plus className="h-4 w-4" />
              مستخدم جديد
            </Link>
          </div>
        }
      />
      <ErrorMessage message={error} />

      {form.id ? (
      <form className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
        <input
          className="input"
          placeholder="اسم المستخدم"
          required
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <input
          className="input"
          disabled={Boolean(form.id)}
          placeholder="البريد الإلكتروني"
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          className="input"
          disabled={Boolean(form.id)}
          minLength={6}
          placeholder={form.id ? "لا يتغير من هنا" : "كلمة المرور"}
          required={!form.id}
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn" disabled={saving} type="submit">
          <Save className="h-4 w-4" />
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </form>
      ) : null}

      <div className="card p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input className="input pr-9" placeholder="بحث بالاسم أو البريد أو الدور" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card p-4 text-sm text-[var(--muted)]">جاري التحميل...</div>
        ) : filtered.length ? (
          filtered.map((row) => (
            <article className="card space-y-3 p-4" key={row.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{row.full_name ?? "-"}</div>
                  <div className="text-xs text-[var(--muted)]">{row.user_code ?? "—"}</div>
                  <div className="text-sm text-[var(--muted)]">{row.email}</div>
                </div>
                <StatusPill className="bg-slate-100 text-slate-700">{ROLE_LABELS[row.role]}</StatusPill>
              </div>
              <div className="text-xs text-[var(--muted)]">
                آخر دخول: {row.last_sign_in_at ? row.last_sign_in_at.slice(0, 10) : "-"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary px-2 py-1 text-xs"
                  onClick={() =>
                    setForm({
                      id: row.id,
                      full_name: row.full_name ?? "",
                      email: row.email,
                      password: "",
                      role: row.role,
                    })
                  }
                  type="button"
                >
                  <Edit2 className="h-4 w-4" />
                  تعديل
                </button>
                <button
                  className="btn btn-danger px-2 py-1 text-xs"
                  disabled={deletingId === row.id}
                  onClick={() => void removeUser(row.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="card p-4 text-sm text-[var(--muted)]">لا يوجد مستخدمون.</div>
        )}
      </div>

      <div className="card hidden overflow-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">البريد</th>
              <th className="p-3 text-right">الدور</th>
              <th className="p-3 text-right">آخر دخول</th>
              <th className="p-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={6}>
                  جاري التحميل...
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3 font-semibold">{row.full_name ?? "-"}</td>
                  <td className="p-3">{row.user_code ?? "—"}</td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3">{ROLE_LABELS[row.role]}</td>
                  <td className="p-3">{row.last_sign_in_at ? row.last_sign_in_at.slice(0, 10) : "-"}</td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <button
                      className="btn btn-secondary px-2 py-1 text-xs"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          full_name: row.full_name ?? "",
                          email: row.email,
                          password: "",
                          role: row.role,
                        })
                      }
                      type="button"
                    >
                      <Edit2 className="h-4 w-4" />
                      تعديل
                    </button>
                    <button
                      className="btn btn-danger px-2 py-1 text-xs"
                      disabled={deletingId === row.id}
                      onClick={() => void removeUser(row.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && !filtered.length ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={6}>
                  لا يوجد مستخدمون.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
    </AdminGuard>
  );
}
