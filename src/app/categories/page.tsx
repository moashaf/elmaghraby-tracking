"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Edit2, FileSpreadsheet, FolderTree, Plus, Save, Search, Trash2, X } from "lucide-react";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader, StatusPill } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import {
  buildCategoryBreadcrumb,
  buildCategorySelectOptions,
  categoryHasChildren,
  countDirectChildren,
  getDirectChildren,
  getRootCategories,
} from "@/lib/category-options";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import { signedProductImageUrls } from "@/lib/product-images";
import { fetchCategoryShippedProducts } from "@/lib/reports/build-reports";
import type { ReportRow } from "@/lib/reports/shipment-helpers";
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

type ListScope = { type: "all" } | { type: "under"; parentId: string };

export default function CategoriesPage() {
  const { tr } = useLanguage();
  const [rows, setRows] = useState<ProductCategory[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [listScope, setListScope] = useState<ListScope>({ type: "all" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [shippedProducts, setShippedProducts] = useState<ReportRow[]>([]);
  const [shippedLoading, setShippedLoading] = useState(false);
  const [exportWithImages, setExportWithImages] = useState(false);
  const [productImageUrls, setProductImageUrls] = useState<Map<string, string>>(new Map());

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const { data: flat, error: loadError } = await fetchAllFromTable<{
      id: string;
      name_ar: string;
      code: string | null;
      parent_id: string | null;
      is_active: boolean;
      created_at?: string;
    }>(createClient(), "product_categories", "id,name_ar,code,parent_id,is_active,created_at", {
      column: "name_ar",
      ascending: true,
    });
    setLoading(false);

    if (loadError) {
      setError(loadError);
      return;
    }

    const byId = new Map(flat.map((row) => [row.id, row]));
    setRows(
      flat.map((row) => {
        const parentRow = row.parent_id ? byId.get(row.parent_id) : undefined;
        return {
          ...row,
          code: row.code,
          parent: parentRow ? { id: parentRow.id, name_ar: parentRow.name_ar } : null,
        };
      })
    );
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  useEffect(() => {
    if (listScope.type !== "under") {
      setShippedProducts([]);
      return;
    }
    async function loadShipped() {
      if (listScope.type !== "under") return;
      const parentId = listScope.parentId;
      setShippedLoading(true);
      const result = await fetchCategoryShippedProducts(parentId, rows);
      setShippedLoading(false);
      if ("error" in result && result.error) {
        setError(String(result.error));
        setShippedProducts([]);
        return;
      }
      setShippedProducts(result.rows);
    }
    if (rows.length) void loadShipped();
  }, [listScope, rows]);

  useEffect(() => {
    if (!exportWithImages) {
      setProductImageUrls(new Map());
      return;
    }
    const paths = shippedProducts.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
    void signedProductImageUrls(paths).then(setProductImageUrls);
  }, [exportWithImages, shippedProducts]);

  const rootCategories = useMemo(() => getRootCategories(rows), [rows]);

  const parentOptions = useMemo(() => {
    const candidates = rows.filter((row) => row.id !== form.id);
    return buildCategorySelectOptions(candidates);
  }, [form.id, rows]);

  const scopedRows = useMemo(() => {
    if (listScope.type === "all") return rows;
    return getDirectChildren(rows, listScope.parentId);
  }, [listScope, rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return scopedRows;
    return scopedRows.filter((row) =>
      [row.name_ar, row.code, row.parent?.name_ar].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, scopedRows]);

  const breadcrumb = useMemo(() => {
    if (listScope.type !== "under") return [];
    return buildCategoryBreadcrumb(rows, listScope.parentId);
  }, [listScope, rows]);

  const browseParent = listScope.type === "under" ? rows.find((row) => row.id === listScope.parentId) : null;

  async function exportCategoryExcel() {
    if (listScope.type !== "under") return;
    const result = await fetchCategoryShippedProducts(listScope.parentId, rows);
    const categoryName = browseParent?.name_ar ?? "category";
    const sheetRows = result.rows.map((row) => {
      const copy: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith("_")) continue;
        copy[key] = value ?? "";
      }
      return copy;
    });
    const imageUrlList = exportWithImages
      ? result.rows.map((row) => (row._imagePath ? productImageUrls.get(row._imagePath) : null))
      : undefined;
    await downloadExcelWithOptionalImages({
      filename: `category-${categoryName}.xlsx`,
      sheetName: "Products",
      rows: sheetRows,
      imageUrls: imageUrlList,
    });
  }

  const activeCount = rows.filter((row) => row.is_active).length;

  const shippedColumns = useMemo(() => {
    if (!shippedProducts.length) return [];
    return Object.keys(shippedProducts[0]).filter((key) => !key.startsWith("_"));
  }, [shippedProducts]);

  function openUnder(parentId: string) {
    setListScope({ type: "under", parentId });
    if (!form.id) {
      setForm((current) => ({ ...current, parent_id: parentId }));
    }
  }

  function showAll() {
    setListScope({ type: "all" });
  }

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

  function parentPath(row: ProductCategory) {
    if (!row.parent_id) return tr("رئيسية", "Root");
    const parent = rows.find((item) => item.id === row.parent_id);
    if (!parent) return row.parent?.name_ar ?? "-";
    if (!parent.parent_id) return parent.name_ar;
    const grand = rows.find((item) => item.id === parent.parent_id);
    return grand ? `${grand.name_ar} / ${parent.name_ar}` : parent.name_ar;
  }

  const listHint =
    listScope.type === "all"
      ? tr("كل الفئات في النظام", "All categories")
      : tr(
          `الفئات الفرعية تحت «${browseParent?.name_ar ?? ""}» (${scopedRows.length})`,
          `Subcategories under “${browseParent?.name_ar ?? ""}” (${scopedRows.length})`
        );

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("الفئات", "Categories")}
        description={tr(
          "اختر «الكل» أو فئة رئيسية، ثم ادخل للفروع. اضغط «عرض الفروع» لفتح مستوى أعمق.",
          "Pick All or a main category, then drill into subcategories."
        )}
        actions={
          <StatusPill className="bg-emerald-50 text-emerald-700">
            <FolderTree className="inline h-3.5 w-3.5" /> {rows.length} فئة — {activeCount} نشطة
          </StatusPill>
        }
      />
      <ErrorMessage message={error} />

      <form className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_140px_1fr_120px_120px]" onSubmit={submit}>
        <input
          className="input"
          placeholder="اسم الفئة"
          required
          value={form.name_ar}
          onChange={(event) => setForm({ ...form, name_ar: event.target.value })}
        />
        <input
          className="input"
          placeholder="كود (اختياري)"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <SearchableSelect
          options={parentOptions}
          placeholder="تحت فئة — ابحث (فاضي = رئيسية)"
          value={form.parent_id}
          onChange={(value) => setForm({ ...form, parent_id: value })}
        />
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

      <div className="card space-y-4 p-4">
        <div>
          <div className="mb-2 text-sm font-semibold text-[var(--muted)]">{tr("الفئات الرئيسية", "Main categories")}</div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`btn text-sm ${listScope.type === "all" ? "" : "btn-secondary"}`}
              onClick={showAll}
              type="button"
            >
              {tr("الكل", "All")}
            </button>
            {rootCategories.map((root) => {
              const childCount = countDirectChildren(rows, root.id);
              const active =
                listScope.type === "under" && listScope.parentId === root.id;
              return (
                <button
                  className={`btn text-sm ${active ? "" : "btn-secondary"}`}
                  key={root.id}
                  onClick={() => openUnder(root.id)}
                  type="button"
                >
                  {root.name_ar}
                  {childCount > 0 ? (
                    <span className="mr-1 opacity-70">({childCount})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {listScope.type === "under" ? (
          <nav aria-label="مسار التصفح" className="flex flex-wrap items-center gap-2 text-sm">
            <button className="font-semibold text-[#0f766e] hover:underline" onClick={showAll} type="button">
              {tr("الكل", "All")}
            </button>
            {breadcrumb.map((item, index) => (
              <span className="flex items-center gap-2" key={item.id}>
                <ChevronLeft className="h-4 w-4 text-[var(--muted)]" />
                {index === breadcrumb.length - 1 ? (
                  <span className="font-bold">{item.name_ar}</span>
                ) : (
                  <button
                    className="font-semibold text-[#0f766e] hover:underline"
                    onClick={() => openUnder(item.id)}
                    type="button"
                  >
                    {item.name_ar}
                  </button>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="text-sm text-[var(--muted)]">{listHint}</div>

        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
          <input
            className="input pr-9"
            placeholder={tr("بحث بالاسم أو الكود", "Search by name or code")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {listScope.type === "under" ? (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">{tr("منتجات مشحونة", "Shipped products")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {tr(
                  `منتجات الشحنات ضمن «${browseParent?.name_ar ?? ""}» وفروعها`,
                  `Shipment products under “${browseParent?.name_ar ?? ""}” and subcategories`
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={exportWithImages}
                  onChange={(event) => setExportWithImages(event.target.checked)}
                  type="checkbox"
                />
                {tr("بالصور", "With images")}
              </label>
              <button className="btn btn-secondary" onClick={() => void exportCategoryExcel()} type="button">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  {shippedColumns.map((column) => (
                    <th className="p-3 text-right" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shippedLoading ? (
                  <tr>
                    <td className="p-4 text-[var(--muted)]" colSpan={Math.max(shippedColumns.length, 1)}>
                      {tr("جاري التحميل...", "Loading...")}
                    </td>
                  </tr>
                ) : shippedProducts.length ? (
                  shippedProducts.map((row, index) => (
                    <tr className="border-t border-[var(--border)]" key={index}>
                      {shippedColumns.map((column) => (
                        <td className="p-3" key={column}>
                          {row[column] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-4 text-[var(--muted)]" colSpan={Math.max(shippedColumns.length, 1)}>
                      {tr("لا توجد منتجات مشحونة في هذه الفئة.", "No shipped products in this category.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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
              filtered.map((row) => {
                const hasChildren = categoryHasChildren(rows, row.id);
                const childCount = countDirectChildren(rows, row.id);
                return (
                  <tr className="border-t border-[var(--border)]" key={row.id}>
                    <td className="p-3 font-semibold">{row.name_ar}</td>
                    <td className="p-3">{row.code ?? "-"}</td>
                    <td className="p-3">{parentPath(row)}</td>
                    <td className="p-3">{row.is_active ? "نشطة" : "متوقفة"}</td>
                    <td className="flex flex-wrap gap-2 p-3">
                      {hasChildren ? (
                        <button
                          className="btn btn-secondary px-2 py-1 text-xs"
                          onClick={() => openUnder(row.id)}
                          type="button"
                        >
                          <FolderTree className="h-4 w-4" />
                          {tr("عرض الفروع", "Subcategories")} ({childCount})
                        </button>
                      ) : null}
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
                );
              })
            )}
            {!loading && !filtered.length ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={5}>
                  {listScope.type === "under"
                    ? tr("لا توجد فئات فرعية هنا.", "No subcategories here.")
                    : tr("لا توجد فئات.", "No categories.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
