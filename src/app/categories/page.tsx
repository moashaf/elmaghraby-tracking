"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, FolderTree, Plus, Save, Search, Trash2, X } from "lucide-react";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ProductCategory } from "@/lib/types";

type CategoryForm = {
  id?: string;
  name_ar: string;
  code: string;
  parent_id: string;
  is_active: boolean;
};

const emptyForm: CategoryForm = {
  name_ar: "",
  code: "",
  parent_id: "",
  is_active: true,
};

export default function CategoriesPage() {
  const [rows, setRows] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
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
      .from("product_categories")
      .select("id,name_ar,code,parent_id,is_active,created_at")
      .order("created_at", { ascending: false });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const flat = (result.data ?? []) as Omit<ProductCategory, "parent">[];
    const byId = new Map(flat.map((row) => [row.id, row]));

    setRows(
      flat.map((row) => {
        const parentRow = row.parent_id ? byId.get(row.parent_id) : undefined;
        return {
          ...row,
          parent: parentRow ? { id: parentRow.id, name_ar: parentRow.name_ar } : null,
        };
      })
    );
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.name_ar, row.code, row.parent?.name_ar].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, rows]);

  const mainCategories = useMemo(
    () => rows.filter((row) => !row.parent_id && row.id !== form.id),
    [form.id, rows]
  );

  const activeCount = rows.filter((row) => row.is_active).length;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name_ar: form.name_ar.trim(),
      code: form.code.trim() || null,
      parent_id: form.parent_id || null,
      is_active: form.is_active,
    };

    const result = form.id
      ? await createClient().from("product_categories").update(payload).eq("id", form.id)
      : await createClient().from("product_categories").insert(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(emptyForm);
    await load();
  }

  async function removeCategory(row: ProductCategory) {
    setError("");
    setDeletingId(row.id);
    const result = await createClient().from("product_categories").delete().eq("id", row.id);
    setDeletingId("");

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="الفئات"
        description="فئات المنتجات الرئيسية والفرعية المستخدمة عند إنشاء المنتجات والشحنات."
        actions={
          <StatusPill className="bg-emerald-50 text-emerald-700">
            <FolderTree className="inline h-3.5 w-3.5" /> {activeCount} نشطة
          </StatusPill>
        }
      />
      <ErrorMessage message={error} />

      <form className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_160px_1fr_140px_140px]" onSubmit={submit}>
        <input
          className="input"
          placeholder="اسم الفئة"
          required
          value={form.name_ar}
          onChange={(event) => setForm({ ...form, name_ar: event.target.value })}
        />
        <input
          className="input"
          placeholder="كود"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <select className="input" value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}>
          <option value="">فئة رئيسية</option>
          {mainCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--muted)]">
          <input
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            type="checkbox"
          />
          نشطة
        </label>
        <button className="btn" disabled={saving} type="submit">
          {form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? "..." : form.id ? "حفظ" : "إضافة"}
        </button>
      </form>

      {form.id ? (
        <button className="btn btn-secondary text-sm" onClick={() => setForm(emptyForm)} type="button">
          <X className="h-4 w-4" />
          إلغاء التعديل
        </button>
      ) : null}

      <div className="card p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input
            className="input pr-9"
            placeholder="بحث بالاسم أو الكود أو الفئة الرئيسية"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">الفئة</th>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">تحت فئة</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={5}>
                  جاري التحميل...
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3 font-semibold">{row.name_ar}</td>
                  <td className="p-3">{row.code ?? "-"}</td>
                  <td className="p-3">{row.parent?.name_ar ?? "رئيسية"}</td>
                  <td className="p-3">{row.is_active ? "نشطة" : "متوقفة"}</td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <button
                      className="btn btn-secondary px-2 py-1 text-xs"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          name_ar: row.name_ar,
                          code: row.code ?? "",
                          parent_id: row.parent_id ?? "",
                          is_active: row.is_active,
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
                      onClick={() => void removeCategory(row)}
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
                <td className="p-4 text-[var(--muted)]" colSpan={5}>
                  لا توجد فئات.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
