"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Save, Search } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { ALL_COUNTRIES } from "@/lib/data/countries";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Supplier } from "@/lib/types";

type SupplierForm = {
  id?: string;
  name_ar: string;
  code: string;
  country: string;
  contact_phone: string;
  is_active: boolean;
};

const emptyForm: SupplierForm = {
  name_ar: "",
  code: "",
  country: "",
  contact_phone: "",
  is_active: true,
};

const countryOptions = ALL_COUNTRIES.map((country) => ({ value: country, label: country }));

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
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
      .from("suppliers")
      .select("id,name_ar,code,country,contact_phone,is_active")
      .order("created_at", { ascending: false });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setRows((result.data ?? []) as Supplier[]);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const countryPickerOptions = useMemo(() => {
    if (form.country && !countryOptions.some((option) => option.value === form.country)) {
      return [{ value: form.country, label: form.country }, ...countryOptions];
    }
    return countryOptions;
  }, [form.country]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.name_ar, row.code, row.country, row.contact_phone].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, rows]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name_ar: form.name_ar.trim(),
      country: form.country.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      is_active: form.is_active,
    };

    const result = form.id
      ? await createClient().from("suppliers").update(payload).eq("id", form.id)
      : await createClient().from("suppliers").insert(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(emptyForm);
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="الموردين" description="المورد يتم ربطه بالشحنة فقط وليس بالمنتج." />
      <ErrorMessage message={error} />

      <form className="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_120px_120px]" onSubmit={submit}>
        <input className="input" placeholder="اسم المورد" required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
        {form.id ? (
          <input className="input bg-slate-50" disabled value={form.code} />
        ) : (
          <input className="input bg-slate-50 text-[var(--muted)]" disabled placeholder="كود تلقائي" readOnly value="" />
        )}
        <SearchableSelect
          options={countryPickerOptions}
          value={form.country}
          onChange={(value) => setForm({ ...form, country: value })}
          placeholder="الدولة"
        />
        <input className="input" placeholder="الهاتف" value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
            نشط
          </label>
          <button className="btn ms-auto" disabled={saving} type="submit">
            {form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? "..." : form.id ? "حفظ" : "إضافة"}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input
            className="input pr-9"
            placeholder="بحث بالاسم أو الكود أو الدولة"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">المورد</th>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">الدولة</th>
              <th className="p-3 text-right">الهاتف</th>
              <th className="p-3 text-right">الحالة</th>
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
                  <td className="p-3 font-semibold">{row.name_ar}</td>
                  <td className="p-3">{row.code ?? "-"}</td>
                  <td className="p-3">{row.country ?? "-"}</td>
                  <td className="p-3">{row.contact_phone ?? "-"}</td>
                  <td className="p-3">{row.is_active ? "نشط" : "متوقف"}</td>
                  <td className="p-3">
                    <button
                      className="btn btn-secondary px-2 py-1 text-xs"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          name_ar: row.name_ar,
                          code: row.code ?? "",
                          country: row.country ?? "",
                          contact_phone: row.contact_phone ?? "",
                          is_active: row.is_active,
                        })
                      }
                      type="button"
                    >
                      <Edit2 className="h-4 w-4" />
                      تعديل
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
