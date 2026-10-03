"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Plus, Save, Trash2 } from "lucide-react";
import { QuickProductModal } from "@/components/quick-product-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage } from "@/components/ui";
import { toEntityOptions } from "@/lib/entity-options";
import { syncProductQuantityFields, mergeOrAppendProductLine } from "@/lib/shipment-product-quantity";
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

function isItemDraftEmpty(row: PurchaseOrderItemDraft) {
  return (
    !row.product_id &&
    !row.cartons_count.trim() &&
    !row.unit_quantity.trim() &&
    !row.notes.trim() &&
    !row.is_new_incoming_product &&
    !row.is_disassembled
  );
}

function isItemDraftValid(row: PurchaseOrderItemDraft) {
  return Boolean(row.product_id) && toPositiveNumber(row.cartons_count) > 0 && toPositiveNumber(row.unit_quantity) > 0;
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
  const [committedItems, setCommittedItems] = useState<PurchaseOrderItemDraft[]>([]);
  const [itemDraft, setItemDraft] = useState<PurchaseOrderItemDraft>({ ...emptyItem });
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const productSelectRef = useRef<HTMLButtonElement>(null);
  const cartonsRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const disassembledRef = useRef<HTMLInputElement>(null);
  const newIncomingRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
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
  const cartonStats = useMemo(() => {
    const rows = isItemDraftValid(itemDraft)
      ? mergeOrAppendProductLine(committedItems, itemDraft, editingItemIndex)
      : committedItems;
    const entered = rows.reduce((sum, row) => sum + toPositiveNumber(row.cartons_count), 0);
    return { entered };
  }, [committedItems, itemDraft, editingItemIndex]);

  function itemsForSave() {
    if (isItemDraftValid(itemDraft)) {
      return mergeOrAppendProductLine(committedItems, itemDraft, editingItemIndex);
    }
    return committedItems;
  }

  function commitItemDraft() {
    if (!isItemDraftValid(itemDraft)) {
      setError(ui("أضف منتجا مع كرتين ووحدة صحيحة قبل التنزيل."));
      return false;
    }
    setCommittedItems((current) => mergeOrAppendProductLine(current, itemDraft, editingItemIndex));
    setItemDraft({ ...emptyItem });
    setEditingItemIndex(null);
    setError("");
    queueMicrotask(() => productSelectRef.current?.focus());
    return true;
  }

  function startEditCommittedItem(index: number) {
    if (editingItemIndex === index) return;
    let nextCommitted = committedItems;
    if (!isItemDraftEmpty(itemDraft)) {
      if (!isItemDraftValid(itemDraft)) {
        setError(ui("كمّل بيانات المنتج فوق أولاً أو امسحه قبل تعديل صنف آخر."));
        return;
      }
      nextCommitted = mergeOrAppendProductLine(committedItems, itemDraft, editingItemIndex);
      setCommittedItems(nextCommitted);
    }
    setEditingItemIndex(index);
    setItemDraft({ ...nextCommitted[index] });
    setError("");
  }

  function removeCommittedItem(index: number) {
    setCommittedItems((current) => current.filter((_, rowIndex) => rowIndex !== index));
    if (editingItemIndex == null) return;
    if (editingItemIndex === index) {
      setItemDraft({ ...emptyItem });
      setEditingItemIndex(null);
      return;
    }
    if (editingItemIndex > index) setEditingItemIndex(editingItemIndex - 1);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isItemDraftEmpty(itemDraft) && !isItemDraftValid(itemDraft)) {
      setError(ui("كمّل بيانات المنتج فوق أو نزّله قبل حفظ أمر الشراء."));
      return;
    }

    const validItems = itemsForSave();

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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-2 min-[1100px]:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_7rem_minmax(12rem,auto)_auto]">
            <SearchableSelect
              ref={productSelectRef}
              options={productOptions}
              value={itemDraft.product_id}
              onAdvance={() => cartonsRef.current?.focus()}
              onChange={(value) => setItemDraft((current) => ({ ...current, product_id: value }))}
              placeholder={ui("ابحث عن المنتج (SKU أو الاسم)")}
            />
            <input
              className="input"
              min={0}
              placeholder={ui("الكرتين")}
              ref={cartonsRef}
              type="number"
              value={itemDraft.cartons_count}
              onChange={(event) =>
                setItemDraft((current) => syncProductQuantityFields({ ...current, cartons_count: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                unitRef.current?.focus();
              }}
            />
            <input
              className="input"
              min={0}
              placeholder={ui("الوحدة")}
              ref={unitRef}
              type="number"
              value={itemDraft.unit_quantity}
              onChange={(event) =>
                setItemDraft((current) => syncProductQuantityFields({ ...current, unit_quantity: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                disassembledRef.current?.focus();
              }}
            />
            <input
              className="input bg-slate-50 text-[var(--foreground)]"
              placeholder={ui("إجمالي القطع")}
              readOnly
              tabIndex={-1}
              type="number"
              value={itemDraft.quantity}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
              <label className="flex items-center gap-2">
                <input
                  checked={itemDraft.is_disassembled}
                  ref={disassembledRef}
                  onChange={(event) => setItemDraft((current) => ({ ...current, is_disassembled: event.target.checked }))}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    newIncomingRef.current?.focus();
                  }}
                  type="checkbox"
                />
                {ui("مفكك")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={itemDraft.is_new_incoming_product}
                  ref={newIncomingRef}
                  onChange={(event) =>
                    setItemDraft((current) => ({ ...current, is_new_incoming_product: event.target.checked }))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    notesRef.current?.focus();
                  }}
                  type="checkbox"
                />
                {ui("منتج وارد جديد")}
              </label>
            </div>
            <input
              className="input sm:col-span-2 min-[1100px]:col-span-5"
              placeholder={ui("ملاحظات المنتج")}
              ref={notesRef}
              value={itemDraft.notes}
              onChange={(event) => setItemDraft((current) => ({ ...current, notes: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                commitItemDraft();
              }}
            />
            <button className="btn px-2 sm:col-span-2 min-[1100px]:col-span-1" onClick={() => commitItemDraft()} type="button">
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {committedItems.length ? (
              committedItems.map((row, index) => {
                const isEditing = editingItemIndex === index;
                return (
                  <div
                    className={`grid cursor-pointer grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2 min-[1100px]:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_7rem_minmax(12rem,auto)_auto] ${
                      isEditing ? "border-[var(--navy)] bg-[rgb(15_118_110_/_8%)]" : "border-[var(--border)]"
                    }`}
                    key={`${row.product_id}-${index}`}
                    onClick={() => startEditCommittedItem(index)}
                  >
                    <SearchableSelect
                      options={productOptions}
                      disabled
                      value={row.product_id}
                      onChange={() => undefined}
                      placeholder={ui("ابحث عن المنتج (SKU أو الاسم)")}
                    />
                    <input className="input bg-slate-50" readOnly tabIndex={-1} value={row.cartons_count} />
                    <input className="input bg-slate-50" readOnly tabIndex={-1} value={row.unit_quantity} />
                    <input className="input bg-slate-50" readOnly tabIndex={-1} value={row.quantity} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                      <label className="flex items-center gap-2">
                        <input checked={row.is_disassembled} disabled type="checkbox" />
                        {ui("مفكك")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input checked={row.is_new_incoming_product} disabled type="checkbox" />
                        {ui("منتج وارد جديد")}
                      </label>
                    </div>
                    <button
                      className="btn btn-secondary px-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeCommittedItem(index);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {row.notes ? <input className="input bg-slate-50 sm:col-span-2 min-[1100px]:col-span-5" readOnly tabIndex={-1} value={row.notes} /> : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-[var(--muted)]">{ui("لا توجد أصناف بعد. أدخل المنتج فوق ثم Enter أو السهم لتحت.")}</p>
            )}
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
            setItemDraft((current) => ({ ...current, product_id: product.id }));
            setShowProductModal(false);
            queueMicrotask(() => cartonsRef.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}
