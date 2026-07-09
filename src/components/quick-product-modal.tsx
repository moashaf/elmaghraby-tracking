"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage } from "@/components/ui";
import { buildCategorySelectOptions } from "@/lib/category-options";
import { fileFromClipboardEvent } from "@/lib/clipboard-image";
import { uploadProductImage } from "@/lib/product-images";
import { syncProductQuantityFields } from "@/lib/shipment-product-quantity";
import { useLanguage } from "@/context/language-context";
import { createClient } from "@/lib/supabase/client";
import type { Product, ProductCategory } from "@/lib/types";

export function QuickProductModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: ProductCategory[];
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const { ui, tr } = useLanguage();
  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories]);
  const [form, setForm] = useState({ name_ar: "", category_id: "", barcode: "", sku: "", is_active: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pickImage(file: File | null) {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function handlePasteImage(event: React.ClipboardEvent) {
    const file = fileFromClipboardEvent(event);
    if (!file) return;
    event.preventDefault();
    pickImage(file);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const category = categories.find((row) => row.id === form.category_id);
    const sku = form.sku.trim();
    const payload = {
      name_ar: form.name_ar.trim(),
      category: category?.name_ar ?? null,
      category_id: form.category_id || null,
      barcode: form.barcode.trim() || null,
      unit: "piece",
      is_active: form.is_active,
      ...(sku ? { sku } : {}),
    };

    const result = await createClient()
      .from("products")
      .insert(payload)
      .select("id,sku,name_ar,name_en,category,category_id,barcode,unit,is_active,image_url")
      .single();

    if (result.error) {
      setLoading(false);
      if (result.error.message.includes("products_barcode_unique_idx")) {
        setError(ui("الباركود مستخدم لمنتج آخر."));
      } else if (result.error.message.includes("products_sku_key")) {
        setError(ui("كود SKU مستخدم لمنتج آخر."));
      } else {
        setError(result.error.message);
      }
      return;
    }

    const product = result.data as Product;

    if (imageFile) {
      const upload = await uploadProductImage(product.id, imageFile);
      if (upload.error) {
        setLoading(false);
        setError(ui("تم حفظ المنتج لكن فشل رفع الصورة.") + " " + upload.error);
        onCreated(product);
        return;
      }
      product.image_url = upload.path ?? product.image_url;
    }

    setLoading(false);
    onCreated(product);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-4 p-5" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{ui("منتج جديد")}</h2>
          <button className="btn btn-secondary p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ErrorMessage message={error} />
        <p className="text-xs text-[var(--muted)]">{ui("سيتم توليد SKU تلقائيا من كود الفئة.")}</p>
        <label className="label">
          {tr("SKU (اختياري)", "SKU (optional)")}
          <input
            className="input"
            placeholder={ui("اتركه فارغا لتوليد SKU تلقائيا")}
            value={form.sku}
            onChange={(event) => setForm({ ...form, sku: event.target.value })}
          />
        </label>
        <label className="label">
          {ui("اسم المنتج")}
          <input className="input" required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
        </label>
        <label className="label">
          {ui("الفئة")}
          <SearchableSelect
            options={categoryOptions}
            placeholder={ui("ابحث عن الفئة...")}
            required
            value={form.category_id}
            onChange={(value) => setForm({ ...form, category_id: value })}
          />
        </label>
        <label className="label">
          {ui("الباركود (اختياري)")}
          <input className="input" inputMode="numeric" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
        </label>
        <div className="space-y-2">
          <span className="label mb-0">{ui("صورة (اختياري)")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-secondary cursor-pointer">
              <ImagePlus className="h-4 w-4" />
              {ui("اختر ملف")}
              <input accept="image/*" className="hidden" onChange={(event) => pickImage(event.target.files?.[0] ?? null)} type="file" />
            </label>
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-16 w-16 rounded border border-[var(--border)] object-contain" src={imagePreview} />
            ) : null}
          </div>
          <div
            className="rounded-md border border-dashed border-[var(--border)] bg-slate-50/80 p-3 text-center text-sm text-[var(--muted)] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20"
            contentEditable={false}
            onPaste={handlePasteImage}
            tabIndex={0}
          >
            {ui("اضغط هنا ثم Ctrl+V للصق صورة من Excel أو أي برنامج")}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} type="checkbox" />
          {ui("نشط")}
        </label>
        <button className="btn" disabled={loading} type="submit">
          {loading ? ui("جاري الحفظ...") : ui("حفظ المنتج")}
        </button>
      </form>
    </div>
  );
}
