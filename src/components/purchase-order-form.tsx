"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { QuickProductModal } from "@/components/quick-product-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage } from "@/components/ui";
import { toEntityOptions } from "@/lib/entity-options";
import { syncProductQuantityFields } from "@/lib/shipment-product-quantity";
import { useLanguage } from "@/context/language-context";
import { createClient } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import type {
  Product,
  ProductCategory,
  PurchaseOrderFormValues,
  PurchaseOrderItemDraft,
  Supplier,
} from "@/lib/types";

const emptyItem: PurchaseOrderItemDraft = {
  product_id: "",
  cartons_count: "",
  unit_quantity: "",
  quantity: "",
  is_disassembled: false,
  is_new_incoming_product: false,
  notes: "",
};

const emptyForm: PurchaseOrderFormValues = {
  supplier_id: "",
  company_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function toPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function findDefaultSupplier(suppliers: Supplier[]) {
  return suppliers.find((row) => {
    const normalized = row.name_ar.replace(/\s/g, "");
    return normalized.includes("شمس") && (normalized.includes("خديجة") || normalized.includes("خديجه"));
  });
}

type Props = {
  onSaved: (purchaseOrderId: string) => void;
  onCancel?: () => void;
};

export function PurchaseOrderForm({ onSaved, onCancel }: Props) {
  const { ui } = useLanguage();
  const [form, setForm] = useState<PurchaseOrderFormValues>(emptyForm);
  const [items, setItems] = useState<PurchaseOrderItemDraft[]>([{ ...emptyItem }]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const [suppliersResult, companiesResult, productsResult, categoriesResult] = await Promise.all([
        fetchAllFromTable<Supplier>(supabase, "suppliers", "id,name_ar,code,is_active", { column: "name_ar" }),
        fetchAllFromTable<{ id: string; is_active: boolean }>(supabase, "companies", "id,is_active", {
          column: "name_ar",
        }),
        fetchAllFromTable<Product>(supabase, "products", "id,sku,name_ar,unit,is_active", { column: "sku" }),
        fetchAllFromTable<ProductCategory>(supabase, "product_categories", "id,name_ar,code,parent_id,is_active", {
          column: "name_ar",
        }),
      ]);
      const activeSuppliers = suppliersResult.error
        ? []
        : suppliersResult.data.filter((row) => row.is_active);
      const activeCompanies = companiesResult.error
        ? []
        : companiesResult.data.filter((row) => row.is_active);
      if (activeSuppliers.length) setSuppliers(activeSuppliers);

      const defaultSupplier = findDefaultSupplier(activeSuppliers);
      const defaultCompanyId = activeCompanies[0]?.id ?? "";
      setForm((current) => ({
        ...current,
        supplier_id: defaultSupplier?.id ?? current.supplier_id,
        company_id: defaultCompanyId || current.company_id,
      }));
      if (!productsResult.error) setProducts(productsResult.data.filter((row) => row.is_active));
      if (!categoriesResult.error) setCategories(categoriesResult.data.filter((row) => row.is_active));
    })();
  }, []);

  const supplierOptions = useMemo(
    () =>
      toEntityOptions(
        suppliers,
        (row) => `${row.code ? `${row.code} — ` : ""}${row.name_ar}`,
        (row) => `${row.code ?? ""} ${row.name_ar}`
      ),
    [suppliers]
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.sku} — ${product.name_ar}`,
        keywords: `${product.sku} ${product.name_ar}`,
      })),
    [products]
  );
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const cartonStats = useMemo(() => {
    const entered = items.reduce((sum, row) => sum + toPositiveNumber(row.cartons_count), 0);
    return { entered };
  }, [items]);

  function updateItem(index: number, value: PurchaseOrderItemDraft) {
    setItems((current) => current.map((row, i) => (i === index ? value : row)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validItems = items.filter((row) => {
      if (!row.product_id) return false;
      const cartons = toPositiveNumber(row.cartons_count);
      const unit = toPositiveNumber(row.unit_quantity);
      return cartons > 0 && unit > 0;
    });

    if (!form.supplier_id) {
      setError(ui("اختر المورد."));
      return;
    }
    if (!form.company_id) {
      setError(ui("لا توجد شركة نشطة في النظام."));
      return;
    }
    if (!validItems.length) {
      setError(ui("أضف منتجا واحدا على الأقل مع كرتين ووحدة صحيحة."));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const headerResult = await supabase
      .from("purchase_orders")
      .insert({
        supplier_id: form.supplier_id,
        company_id: form.company_id,
        order_date: form.order_date,
        notes: form.notes.trim() || null,
        status: "draft",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (headerResult.error || !headerResult.data) {
      setSaving(false);
      setError(headerResult.error?.message ?? ui("تعذر إنشاء أمر الشراء."));
      return;
    }

    const poId = headerResult.data.id as string;
    const itemsResult = await supabase.from("purchase_order_items").insert(
      validItems.map((row) => ({
        purchase_order_id: poId,
        product_id: row.product_id,
        order_quantity: toPositiveNumber(row.cartons_count) * toPositiveNumber(row.unit_quantity),
        order_cartons: toPositiveNumber(row.cartons_count),
        is_disassembled: row.is_disassembled,
        is_new_incoming_product: row.is_new_incoming_product,
        notes: row.notes.trim() || null,
        item_status: "draft",
      }))
    );

    setSaving(false);
    if (itemsResult.error) {
      setError(itemsResult.error.message);
      return;
    }

    await supabase.from("purchase_order_timeline_events").insert({
      purchase_order_id: poId,
      event_type: "created",
      title_ar: "إنشاء أمر شراء",
      description_ar: "تم إنشاء أمر الشراء كمسودة",
      created_by: user?.id ?? null,
    });

    onSaved(poId);
  }

  return (
    <>
      <form className="card space-y-4 p-5" onSubmit={submit}>
        <ErrorMessage message={error} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            {ui("المورد")}
            <SearchableSelect
              options={supplierOptions}
              value={form.supplier_id}
              onChange={(value) => setForm((current) => ({ ...current, supplier_id: value }))}
              placeholder={ui("اختر المورد")}
            />
          </label>
          <label className="label">
            {ui("تاريخ الطلب")}
            <input
              className="input"
              type="date"
              value={form.order_date}
              onChange={(event) => setForm((current) => ({ ...current, order_date: event.target.value }))}
              required
            />
          </label>
        </div>
        <label className="label">
          {ui("ملاحظات")}
          <textarea
            className="input min-h-20"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>

        <section className="space-y-3 border-t border-[var(--border)] pt-5">
          <div className="sticky top-16 z-[15] flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/95 px-3 py-3 shadow-sm backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold">{ui("بنود أمر الشراء")}</h3>
              {cartonStats.entered > 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {ui("الكراتين المدخلة:")} {cartonStats.entered}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary text-sm" onClick={() => setShowProductModal(true)} type="button">
                <Plus className="h-4 w-4" />
                {ui("منتج جديد")}
              </button>
              <button
                className="btn btn-secondary text-sm"
                onClick={() => setItems((current) => [...current, { ...emptyItem }])}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {ui("سطر منتج")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((row, index) => {
              const selected = productById.get(row.product_id);
              return (
                <div
                  className="grid gap-3 rounded-md border border-[var(--border)] p-3 md:grid-cols-[1fr_100px_100px_110px_220px_auto]"
                  key={index}
                >
                  <SearchableSelect
                    options={productOptions}
                    value={row.product_id}
                    onChange={(value) => updateItem(index, { ...row, product_id: value })}
                    placeholder={ui("ابحث عن المنتج (SKU أو الاسم)")}
                  />
                  <input
                    className="input"
                    min={0}
                    placeholder={ui("الكرتين")}
                    type="number"
                    value={row.cartons_count}
                    onChange={(event) =>
                      updateItem(index, syncProductQuantityFields({ ...row, cartons_count: event.target.value }))
                    }
                  />
                  <input
                    className="input"
                    min={0}
                    placeholder={ui("الوحدة")}
                    type="number"
                    value={row.unit_quantity}
                    onChange={(event) =>
                      updateItem(index, syncProductQuantityFields({ ...row, unit_quantity: event.target.value }))
                    }
                  />
                  <input
                    className="input bg-slate-50 text-[var(--foreground)]"
                    placeholder={ui("إجمالي القطع")}
                    readOnly
                    tabIndex={-1}
                    type="number"
                    value={row.quantity}
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.is_new_incoming_product}
                        onChange={(event) =>
                          updateItem(index, { ...row, is_new_incoming_product: event.target.checked })
                        }
                        type="checkbox"
                      />
                      {ui("منتج وارد جديد")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.is_disassembled}
                        onChange={(event) => updateItem(index, { ...row, is_disassembled: event.target.checked })}
                        type="checkbox"
                      />
                      {ui("مفكك")}
                    </label>
                  </div>
                  <button
                    className="btn btn-secondary px-2"
                    onClick={() =>
                      setItems((current) =>
                        current.length === 1 ? [{ ...emptyItem }] : current.filter((_, rowIndex) => rowIndex !== index)
                      )
                    }
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {selected ? (
                    <input
                      className="input md:col-span-5"
                      placeholder={ui("ملاحظات المنتج")}
                      value={row.notes}
                      onChange={(event) => updateItem(index, { ...row, notes: event.target.value })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={saving} type="submit">
            <Save className="h-4 w-4" />
            {saving ? ui("جاري الحفظ...") : ui("حفظ أمر الشراء")}
          </button>
          {onCancel ? (
            <button className="btn btn-secondary" type="button" onClick={onCancel}>
              {ui("إلغاء")}
            </button>
          ) : null}
        </div>
      </form>

      {showProductModal ? (
        <QuickProductModal
          categories={categories}
          onClose={() => setShowProductModal(false)}
          onCreated={(product) => {
            setProducts((current) => [product, ...current]);
            setItems((current) => {
              const next =
                current.length === 1 && !current[0].product_id
                  ? [{ ...current[0], product_id: product.id }]
                  : [...current, { ...emptyItem, product_id: product.id }];
              return next;
            });
            setShowProductModal(false);
          }}
        />
      ) : null}
    </>
  );
}
