"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Save, Search, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useProfile } from "@/context/profile-context";
import { useLanguage } from "@/context/language-context";
import { buildCategorySelectOptions } from "@/lib/category-options";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import type { Product, ProductCategory } from "@/lib/types";

type ProductForm = {
  id?: string;
  sku: string;
  name_ar: string;
  category_id: string;
  barcode: string;
  unit: string;
  is_active: boolean;
};

const emptyForm: ProductForm = {
  sku: "",
  name_ar: "",
  category_id: "",
  barcode: "",
  unit: "piece",
  is_active: true,
};

const SEARCH_LIMIT = 80;
const SEARCH_DEBOUNCE_MS = 300;

function escapeIlike(term: string) {
  return term.replace(/[%_\\]/g, "\\$&");
}

function productDeleteError(message: string) {
  if (message.includes("shipment_products") || message.includes("23503")) {
    return "لا يمكن حذف المنتج لأنه مرتبط بشحنة. احذفه من الشحنة أولا أو أوقفه (غير نشط).";
  }
  return message;
}

export default function ProductsPage() {
  const { canWrite } = useProfile();
  const { tr } = useLanguage();
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  async function loadCategories() {
    setError("");
    if (!isSupabaseConfigured()) {
      setCategoriesLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setCategoriesLoading(true);
    const categoriesResult = await fetchAllFromTable(
      createClient(),
      "product_categories",
      "id,name_ar,code,parent_id,is_active",
      { column: "name_ar" }
    );
    setCategoriesLoading(false);

    if (categoriesResult.error) {
      setError(categoriesResult.error || "تعذر تحميل الفئات.");
      return;
    }

    setCategories((categoriesResult.data ?? []) as ProductCategory[]);
  }

  async function searchProducts(term: string) {
    const trimmed = term.trim();
    if (!trimmed) {
      setRows([]);
      setSearching(false);
      return;
    }

    if (!isSupabaseConfigured()) return;

    setSearching(true);
    setError("");

    const escaped = escapeIlike(trimmed);
    const filter = `sku.ilike.%${escaped}%,name_ar.ilike.%${escaped}%,category.ilike.%${escaped}%,barcode.ilike.%${escaped}%`;

    const result = await createClient()
      .from("products")
      .select("id,sku,name_ar,name_en,category,category_id,barcode,unit,is_active")
      .or(filter)
      .order("name_ar")
      .limit(SEARCH_LIMIT);

    setSearching(false);

    if (result.error) {
      setError(result.error.message);
      setRows([]);
      return;
    }

    setRows((result.data as Product[] | null) ?? []);
  }

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRows([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchProducts(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories]);
  const hasQuery = query.trim().length > 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const category = categories.find((row) => row.id === form.category_id);
    const barcode = form.barcode.trim() || null;
    const sku = form.sku.trim();
    const payload = {
      name_ar: form.name_ar.trim(),
      category: category?.name_ar ?? null,
      category_id: form.category_id || null,
      barcode,
      unit: "piece",
      is_active: form.is_active,
      ...(sku ? { sku } : {}),
    };

    const result = form.id
      ? await createClient().from("products").update(payload).eq("id", form.id)
      : await createClient().from("products").insert(payload);

    setSaving(false);

    if (result.error) {
      if (result.error.message.includes("products_barcode_unique_idx")) {
        setError("الباركود مستخدم لمنتج آخر.");
      } else if (result.error.message.includes("products_sku_key")) {
        setError("كود SKU مستخدم لمنتج آخر.");
      } else {
        setError(result.error.message);
      }
      return;
    }

    setForm(emptyForm);
    if (hasQuery) await searchProducts(query.trim());
  }

  async function removeProduct(row: Product) {
    if (!window.confirm(`حذف المنتج «${row.name_ar}» (${row.sku}) نهائيا؟`)) return;

    setError("");
    setDeletingId(row.id);
    const result = await createClient().from("products").delete().eq("id", row.id);
    setDeletingId("");

    if (result.error) {
      setError(productDeleteError(result.error.message));
      return;
    }

    if (form.id === row.id) setForm(emptyForm);
    if (hasQuery) await searchProducts(query.trim());
  }

  return (
    <div className="space-y-5">
      <PageHeader title={tr("المنتجات", "Products")} />
      <ErrorMessage message={error} />

      {canWrite ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={submit}>
          <input
            className="input"
            placeholder={tr("SKU (اختياري)", "SKU (optional)")}
            value={form.sku}
            onChange={(event) => setForm({ ...form, sku: event.target.value })}
            title={tr("اتركه فارغا لتوليد SKU تلقائيا", "Leave empty to auto-generate SKU")}
          />
          <input
            className="input"
            placeholder={tr("اسم المنتج", "Product name")}
            required
            value={form.name_ar}
            onChange={(event) => setForm({ ...form, name_ar: event.target.value })}
          />
          <SearchableSelect
            options={categoryOptions}
            placeholder={tr("ابحث عن الفئة...", "Search category...")}
            required
            value={form.category_id}
            onChange={(value) => setForm({ ...form, category_id: value })}
            disabled={categoriesLoading}
          />
          <input
            className="input"
            inputMode="numeric"
            placeholder="الباركود (اختياري)"
            value={form.barcode}
            onChange={(event) => setForm({ ...form, barcode: event.target.value })}
          />
          <input
            className="input bg-slate-50"
            disabled
            readOnly
            value="piece"
            title={tr("الوحدة الافتراضية", "Default unit")}
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                type="checkbox"
              />
              نشط
            </label>
            <button className="btn ms-auto" disabled={saving || categoriesLoading} type="submit">
              {form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "..." : form.id ? "حفظ" : "إضافة"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="card p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input
            autoComplete="off"
            className="input pr-9"
            placeholder={tr(
              "ابحث بالاسم أو SKU أو الباركود — النتائج تظهر أثناء الكتابة",
              "Search by name, SKU, or barcode — results appear as you type"
            )}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {hasQuery && !searching ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {rows.length >= SEARCH_LIMIT
              ? tr(`أول ${SEARCH_LIMIT} نتيجة — حدّد البحث أكثر`, `First ${SEARCH_LIMIT} results — refine your search`)
              : tr(`${rows.length} نتيجة`, `${rows.length} result(s)`)}
          </p>
        ) : null}
      </div>

      {!hasQuery ? (
        <div className="card p-8 text-center text-sm text-[var(--muted)]">
          {tr(
            "ابدأ بالبحث لعرض المنتجات — لا يتم تحميل كل الأصناف مرة واحدة.",
            "Start typing to search products — the full catalog is not loaded at once."
          )}
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-right">SKU</th>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-right">الباركود</th>
                <th className="p-3 text-right">التصنيف</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {searching ? (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={6}>
                    {tr("جاري البحث...", "Searching...")}
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr className="border-t border-[var(--border)]" key={row.id}>
                    <td className="p-3 font-semibold">{row.sku}</td>
                    <td className="p-3">{row.name_ar}</td>
                    <td className="p-3">{row.barcode ?? "-"}</td>
                    <td className="p-3">{row.category ?? "-"}</td>
                    <td className="p-3">{row.is_active ? "نشط" : "متوقف"}</td>
                    <td className="flex flex-wrap gap-2 p-3">
                      {canWrite ? (
                        <button
                          className="btn btn-secondary px-2 py-1 text-xs"
                          onClick={() =>
                            setForm({
                              id: row.id,
                              sku: row.sku,
                              name_ar: row.name_ar,
                              category_id: row.category_id ?? "",
                              barcode: row.barcode ?? "",
                              unit: row.unit,
                              is_active: row.is_active,
                            })
                          }
                          type="button"
                        >
                          <Edit2 className="h-4 w-4" />
                          تعديل
                        </button>
                      ) : null}
                      {canWrite ? (
                        <button
                          className="btn btn-danger px-2 py-1 text-xs"
                          disabled={deletingId === row.id}
                          onClick={() => void removeProduct(row)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={6}>
                    {tr("لا توجد نتائج.", "No results.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
