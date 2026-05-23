"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Save, Search } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Product, ProductCategory } from "@/lib/types";

type ProductForm = {
  id?: string;
  sku: string;
  name_ar: string;
  category_id: string;
  unit: string;
  is_active: boolean;
};

const emptyForm: ProductForm = {
  sku: "",
  name_ar: "",
  category_id: "",
  unit: "piece",
  is_active: true,
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
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
    const supabase = createClient();
    const [result, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,sku,name_ar,name_en,category,category_id,unit,is_active")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_categories")
        .select("id,name_ar,code,parent_id,is_active")
        .eq("is_active", true)
        .order("name_ar"),
    ]);
    setLoading(false);

    if (result.error || categoriesResult.error) {
      setError(result.error?.message || categoriesResult.error?.message || "تعذر تحميل بيانات المنتجات.");
      return;
    }

    setRows((result.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as ProductCategory[]);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.sku, row.name_ar, row.category].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, rows]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const category = categories.find((row) => row.id === form.category_id);
    const payload = {
      name_ar: form.name_ar.trim(),
      category: category?.name_ar ?? null,
      category_id: form.category_id || null,
      unit: form.unit.trim() || "piece",
      is_active: form.is_active,
    };

    const result = form.id
      ? await createClient().from("products").update(payload).eq("id", form.id)
      : await createClient().from("products").insert(payload);

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
      <PageHeader title="المنتجات" />
      <ErrorMessage message={error} />

      <form className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
        {form.id ? (
          <input className="input bg-slate-50" disabled value={form.sku} title="الكود يُولَّد تلقائيا ولا يُعدَّل" />
        ) : (
          <input className="input bg-slate-50 text-[var(--muted)]" disabled placeholder="SKU تلقائي" value="" readOnly />
        )}
        <input className="input" placeholder="اسم المنتج" required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
        <select className="input" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
          <option value="">اختر الفئة</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.code ? `${category.code} — ` : ""}
              {category.name_ar}
            </option>
          ))}
        </select>
        <select className="input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
          <option value="piece">piece</option>
          <option value="carton">carton</option>
          <option value="kg">kg</option>
        </select>
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
            placeholder="بحث بالاسم أو SKU أو التصنيف"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">التصنيف</th>
              <th className="p-3 text-right">الوحدة</th>
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
                  <td className="p-3 font-semibold">{row.sku}</td>
                  <td className="p-3">{row.name_ar}</td>
                  <td className="p-3">{row.category ?? "-"}</td>
                  <td className="p-3">{row.unit}</td>
                  <td className="p-3">{row.is_active ? "نشط" : "متوقف"}</td>
                  <td className="p-3">
                    <button
                      className="btn btn-secondary px-2 py-1 text-xs"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          sku: row.sku,
                          name_ar: row.name_ar,
                          category_id: row.category_id ?? "",
                          unit: row.unit,
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
