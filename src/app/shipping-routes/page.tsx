"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Route, Search, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { useProfile } from "@/context/profile-context";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { PORT_SELECT_OPTIONS } from "@/lib/port-options";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ShippingRoute } from "@/lib/types";

type RouteForm = {
  shipping_port: string;
  arrival_port: string;
  duration_days: string;
};

const emptyForm: RouteForm = {
  shipping_port: "",
  arrival_port: "",
  duration_days: "",
};

export default function ShippingRoutesPage() {
  const { tr } = useLanguage();
  const { canWrite } = useProfile();
  const [rows, setRows] = useState<ShippingRoute[]>([]);
  const [form, setForm] = useState<RouteForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const result = await createClient()
      .from("shipping_routes")
      .select("id,shipping_port,arrival_port,duration_days,is_active")
      .eq("is_active", true)
      .order("shipping_port");
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setRows((result.data ?? []) as ShippingRoute[]);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.shipping_port, row.arrival_port, String(row.duration_days)].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const days = Number(form.duration_days);
    if (!form.shipping_port || !form.arrival_port || !Number.isFinite(days) || days < 1) {
      setError("اختر الميناءين وأدخل مدة الشحن بالأيام.");
      return;
    }

    setSaving(true);
    const result = await createClient().from("shipping_routes").insert({
      shipping_port: form.shipping_port,
      arrival_port: form.arrival_port,
      duration_days: days,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(emptyForm);
    await load();
  }

  async function removeRoute(id: string) {
    setError("");
    const result = await createClient().from("shipping_routes").update({ is_active: false }).eq("id", id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("مسارات الشحن", "Shipping routes")}
        description={tr(
          "حدد مدة الشحن بين الميناءين — تُستخدم تلقائيا عند إنشاء شحنة جديدة.",
          "Define shipping duration between ports (used automatically when creating shipments)."
        )}
        actions={
          <StatusPill className="bg-emerald-50 text-emerald-700">
            <Route className="inline h-3.5 w-3.5" /> {rows.length} مسار
          </StatusPill>
        }
      />
      <ErrorMessage message={error} />

      {canWrite ? (
      <form className="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_140px_120px]" onSubmit={submit}>
        <label className="label">
          ميناء الشحن
          <SearchableSelect
            options={PORT_SELECT_OPTIONS}
            value={form.shipping_port}
            onChange={(value) => setForm({ ...form, shipping_port: value })}
            placeholder="ميناء الشحن"
            required
          />
        </label>
        <label className="label">
          ميناء الوصول
          <SearchableSelect
            options={PORT_SELECT_OPTIONS}
            value={form.arrival_port}
            onChange={(value) => setForm({ ...form, arrival_port: value })}
            placeholder="ميناء الوصول"
            required
          />
        </label>
        <label className="label">
          المدة (يوم)
          <input
            className="input"
            min={1}
            required
            type="number"
            value={form.duration_days}
            onChange={(event) => setForm({ ...form, duration_days: event.target.value })}
          />
        </label>
        <button className="btn self-end" disabled={saving} type="submit">
          <Plus className="h-4 w-4" />
          {saving ? "..." : "إضافة"}
        </button>
      </form>
      ) : null}

      <div className="card p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input
            className="input pr-9"
            placeholder="بحث بالمسار أو الميناء"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">ميناء الشحن</th>
              <th className="p-3 text-right">ميناء الوصول</th>
              <th className="p-3 text-right">المدة (يوم)</th>
              <th className="p-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={4}>
                  جاري التحميل...
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3">{row.shipping_port}</td>
                  <td className="p-3">{row.arrival_port}</td>
                  <td className="p-3 font-semibold">{row.duration_days}</td>
                  <td className="p-3">
                    <button className="btn btn-danger px-2 py-1 text-xs" onClick={() => void removeRoute(row.id)} type="button">
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && !filtered.length ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={4}>
                  لا توجد مسارات. أضف مسارا من النموذج أعلاه.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
