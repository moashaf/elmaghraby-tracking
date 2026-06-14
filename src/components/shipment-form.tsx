"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage } from "@/components/ui";
import { toEntityOptions } from "@/lib/entity-options";
import { PORT_SELECT_OPTIONS } from "@/lib/port-options";
import { buildCategorySelectOptions } from "@/lib/category-options";
import { addDaysToIsoDate, findRouteDuration } from "@/lib/eta";
import { syncProductQuantityFields, unitFromCartonsAndTotal } from "@/lib/shipment-product-quantity";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import { shipmentInvPath } from "@/lib/storage-path";
import type {
  Company,
  ContainerDraft,
  Product,
  ProductCategory,
  Shipment,
  ShipmentContainer,
  ShipmentFormValues,
  ShipmentProduct,
  ShipmentProductDraft,
  ShippingRoute,
  Supplier,
} from "@/lib/types";

const bucket = "container-files";
const today = new Date().toISOString().slice(0, 10);
const CUSTOMS_CLEARANCE_DAYS = 15;

const emptyForm: ShipmentFormValues = {
  acid: "",
  company_id: "",
  supplier_id: "",
  shipping_port: "",
  arrival_port: "",
  shipped_at: today,
  eta: today,
  shipping_duration_days: "",
  shipment_type: "",
  total_weight_kg: "",
  total_cartons: "",
  value_usd: "",
  containers_count: "",
  route: "",
  notes: "",
};

const emptyContainer: ContainerDraft = {
  container_number: "",
  weight_kg: "",
  cartons_count: "",
  notes: "",
};

const emptyProduct: ShipmentProductDraft = {
  product_id: "",
  quantity: "",
  cartons_count: "",
  unit_quantity: "",
  notes: "",
  is_new_incoming_product: false,
  is_disassembled: false,
};

function formFromShipment(shipment?: Shipment): ShipmentFormValues {
  if (!shipment) return emptyForm;

  return {
    acid: shipment.acid,
    company_id: shipment.company_id,
    supplier_id: shipment.supplier_id,
    shipping_port: shipment.shipping_port,
    arrival_port: shipment.arrival_port,
    shipped_at: shipment.shipped_at,
    eta: shipment.eta,
    shipping_duration_days: shipment.shipping_duration_days?.toString() ?? "",
    shipment_type: shipment.shipment_type ?? "",
    total_weight_kg: shipment.total_weight_kg?.toString() ?? "",
    total_cartons: shipment.total_cartons?.toString() ?? "",
    value_usd: shipment.value_usd?.toString() ?? "",
    containers_count: "",
    route: shipment.route ?? "",
    notes: shipment.notes ?? "",
  };
}

function containerDrafts(rows?: ShipmentContainer[]): ContainerDraft[] {
  if (!rows?.length) return [];

  return rows.map((row) => ({
    container_number: row.container_number,
    weight_kg: row.weight_kg?.toString() ?? "",
    cartons_count: row.cartons_count?.toString() ?? "",
    notes: row.notes ?? "",
  }));
}

function productDrafts(rows?: ShipmentProduct[]): ShipmentProductDraft[] {
  if (!rows?.length) return [{ ...emptyProduct }];

  return rows.map((row) => ({
    product_id: row.product_id,
    quantity: row.quantity.toString(),
    cartons_count: row.cartons_count?.toString() ?? "",
    unit_quantity: unitFromCartonsAndTotal(row.cartons_count, row.quantity),
    notes: row.notes ?? "",
    is_new_incoming_product: row.is_new_incoming_product,
    is_disassembled: row.is_disassembled ?? false,
  }));
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resizeContainers(count: number, current: ContainerDraft[]) {
  if (count <= 0) return [{ ...emptyContainer }];
  if (current.length === count) return current;
  if (current.length < count) {
    return [...current, ...Array.from({ length: count - current.length }, () => ({ ...emptyContainer }))];
  }
  return current.slice(0, count);
}

export function ShipmentForm({
  shipment,
  initialContainers,
  initialProducts,
  readOnly = false,
  onSaved,
}: {
  shipment?: Shipment;
  initialContainers?: ShipmentContainer[];
  initialProducts?: ShipmentProduct[];
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const isNew = !shipment;
  const [form, setForm] = useState<ShipmentFormValues>(() => formFromShipment(shipment));
  const [containers, setContainers] = useState<ContainerDraft[]>(() =>
    containerDrafts(initialContainers).length ? containerDrafts(initialContainers) : [{ ...emptyContainer }]
  );
  const [shipmentProducts, setShipmentProducts] = useState<ShipmentProductDraft[]>(() => productDrafts(initialProducts));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [routes, setRoutes] = useState<ShippingRoute[]>([]);
  const [invFile, setInvFile] = useState<File | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.sku} — ${product.name_ar}`,
        keywords: `${product.sku} ${product.name_ar} ${product.category ?? ""}`,
      })),
    [products]
  );

  const companyOptions = useMemo(
    () =>
      toEntityOptions(
        companies,
        (company) => `${company.code ? `${company.code} — ` : ""}${company.name_ar}`,
        (company) => `${company.code ?? ""} ${company.name_ar} ${company.name_en ?? ""}`
      ),
    [companies]
  );

  const supplierOptions = useMemo(
    () =>
      toEntityOptions(
        suppliers,
        (supplier) => `${supplier.code ? `${supplier.code} — ` : ""}${supplier.name_ar}`,
        (supplier) => `${supplier.code ?? ""} ${supplier.name_ar} ${supplier.country ?? ""}`
      ),
    [suppliers]
  );

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    async function loadLookups() {
      if (!isSupabaseConfigured()) {
        setError("اضبط ملف .env.local أولا بقيم Supabase.");
        return;
      }

      const supabase = createClient();
      const [companiesResult, suppliersResult, productsResult, categoriesResult, routesResult] = await Promise.all([
        supabase.from("companies").select("id,name_ar,name_en,code,is_active").eq("is_active", true).order("name_ar"),
        supabase.from("suppliers").select("id,name_ar,code,country,contact_phone,is_active").eq("is_active", true).order("name_ar"),
        fetchAllFromTable(supabase, "products", "id,sku,name_ar,name_en,category,category_id,unit,is_active", { column: "name_ar" }),
        fetchAllFromTable(supabase, "product_categories", "id,name_ar,code,parent_id,is_active", { column: "name_ar" }),
        supabase.from("shipping_routes").select("id,shipping_port,arrival_port,duration_days,is_active").eq("is_active", true),
      ]);

      if (companiesResult.error || suppliersResult.error || productsResult.error || categoriesResult.error) {
        setError(
          companiesResult.error?.message ||
            suppliersResult.error?.message ||
            productsResult.error ||
            categoriesResult.error ||
            "تعذر تحميل البيانات الأساسية."
        );
        return;
      }

      if (routesResult.error) {
        console.warn("[routes]", routesResult.error.message);
      }

      setCompanies((companiesResult.data ?? []) as Company[]);
      setSuppliers((suppliersResult.data ?? []) as Supplier[]);
      setProducts((productsResult.data ?? []) as Product[]);
      setCategories((categoriesResult.data ?? []) as ProductCategory[]);
      setRoutes((routesResult.data ?? []) as ShippingRoute[]);
    }

    void loadLookups();
  }, []);

  useEffect(() => {
    const duration = findRouteDuration(routes, form.shipping_port, form.arrival_port);
    if (!duration || !form.shipped_at) return;

    const nextEta = addDaysToIsoDate(form.shipped_at, duration);
    queueMicrotask(() => {
      setForm((current) => {
        // Keep ETA always aligned with sea-duration to avoid status/date drift.
        if (current.shipping_duration_days === String(duration) && current.eta === nextEta) return current;
        return {
          ...current,
          shipping_duration_days: String(duration),
          eta: nextEta,
        };
      });
    });
  }, [form.shipping_port, form.arrival_port, form.shipped_at, routes]);

  useEffect(() => {
    const count = Number(form.containers_count);
    if (!Number.isFinite(count) || count < 1) return;
    queueMicrotask(() => {
      setContainers((current) => resizeContainers(Math.min(Math.floor(count), 50), current));
    });
  }, [form.containers_count]);

  function setField<K extends keyof ShipmentFormValues>(key: K, value: ShipmentFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateContainer(index: number, value: ContainerDraft) {
    setContainers((current) => current.map((row, rowIndex) => (rowIndex === index ? value : row)));
  }

  function updateShipmentProduct(index: number, value: ShipmentProductDraft) {
    setShipmentProducts((current) => current.map((row, rowIndex) => (rowIndex === index ? value : row)));
  }

  async function uploadStorage(path: string, file: File) {
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured()) {
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    if (isNew && !invFile) {
      setError("ارفع ملف INV بصيغة PDF قبل حفظ الشحنة.");
      return;
    }

    if (isNew && invFile && invFile.type !== "application/pdf") {
      setError("ملف INV يجب أن يكون PDF.");
      return;
    }

    const validContainers = containers.filter((container) => container.container_number.trim());
    const validProducts = shipmentProducts.filter((row) => {
      if (!row.product_id) return false;
      const cartons = toPositiveNumber(row.cartons_count);
      const unit = toPositiveNumber(row.unit_quantity);
      return cartons > 0 && unit > 0;
    });

    if (!validContainers.length) {
      setError("أضف حاوية واحدة على الأقل.");
      return;
    }

    if (!validProducts.length) {
      setError("أضف منتجا واحدا على الأقل مع كرتين ووحدة صحيحة.");
      return;
    }

    const containerNumbers = validContainers.map((container) => container.container_number.trim().toLowerCase());
    const duplicateContainer = containerNumbers.find((number, index) => containerNumbers.indexOf(number) !== index);
    if (duplicateContainer) {
      setError("رقم الحاوية مكرر داخل نفس الشحنة.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const acidValue = form.acid.trim();
    const { data: acidMatches, error: acidCheckError } = await supabase
      .from("shipments")
      .select("id")
      .eq("acid", acidValue);

    if (acidCheckError) {
      setLoading(false);
      setError(acidCheckError.message);
      return;
    }

    const acidConflict = (acidMatches ?? []).find((row) => row.id !== shipment?.id);
    if (acidConflict) {
      setLoading(false);
      setError("رقم ACID مستخدم في شحنة أخرى ولا يمكن تكراره.");
      return;
    }

    const user = await supabase.auth.getUser();
    const routeDuration = findRouteDuration(routes, form.shipping_port, form.arrival_port);
    const etaValue =
      routeDuration && form.shipped_at ? addDaysToIsoDate(form.shipped_at, routeDuration) : form.eta;

    const shipmentPayload = {
      acid: form.acid.trim(),
      company_id: form.company_id,
      supplier_id: form.supplier_id,
      shipping_port: form.shipping_port.trim(),
      arrival_port: form.arrival_port.trim(),
      shipped_at: form.shipped_at,
      eta: etaValue,
      shipping_duration_days: routeDuration ?? (form.shipping_duration_days ? Number(form.shipping_duration_days) : null),
      shipment_type: form.shipment_type.trim() || "—",
      total_weight_kg: toNullableNumber(form.total_weight_kg),
      total_cartons: toNullableNumber(form.total_cartons),
      value_usd: toNullableNumber(form.value_usd),
      route: form.route.trim() || null,
      notes: form.notes.trim() || null,
      created_by: user.data.user?.id ?? null,
    };

    const savedShipment = shipment
      ? await supabase.from("shipments").update(shipmentPayload).eq("id", shipment.id).select("id").single()
      : await supabase.from("shipments").insert(shipmentPayload).select("id").single();

    if (savedShipment.error) {
      setLoading(false);
      setError(savedShipment.error.message);
      return;
    }

    const shipmentId = savedShipment.data.id as string;

    if (shipment) {
      const [containersDelete, productsDelete] = await Promise.all([
        supabase.from("shipment_containers").delete().eq("shipment_id", shipmentId),
        supabase.from("shipment_products").delete().eq("shipment_id", shipmentId),
      ]);

      if (containersDelete.error || productsDelete.error) {
        setLoading(false);
        setError(containersDelete.error?.message || productsDelete.error?.message || "تعذر تحديث تفاصيل الشحنة.");
        return;
      }
    }

    const containersInsert = await supabase
      .from("shipment_containers")
      .insert(
        validContainers.map((container) => ({
          shipment_id: shipmentId,
          container_number: container.container_number.trim(),
          weight_kg: toNullableNumber(container.weight_kg),
          cartons_count: toNullableNumber(container.cartons_count),
          notes: container.notes.trim() || null,
        }))
      )
      .select("id, container_number");

    if (containersInsert.error) {
      setLoading(false);
      setError(containersInsert.error.message);
      return;
    }

    const insertedContainers = containersInsert.data ?? [];

    if (isNew && invFile) {
      try {
        const invPath = shipmentInvPath(shipmentId, invFile.name);
        await uploadStorage(invPath, invFile);
        const invRow = await supabase.from("shipment_documents").insert({
          shipment_id: shipmentId,
          doc_type: "INV",
          file_name: invFile.name,
          storage_path: invPath,
          mime_type: invFile.type,
          size_bytes: invFile.size,
          uploaded_by: user.data.user?.id ?? null,
        });
        if (invRow.error) throw new Error(invRow.error.message);
      } catch (uploadError) {
        setLoading(false);
        setError(uploadError instanceof Error ? uploadError.message : "تعذر رفع ملف INV.");
        return;
      }
    }

    const productsInsert = await supabase.from("shipment_products").insert(
      validProducts.map((row) => ({
        shipment_id: shipmentId,
        product_id: row.product_id,
        quantity: toPositiveNumber(row.cartons_count) * toPositiveNumber(row.unit_quantity),
        cartons_count: toNullableNumber(row.cartons_count),
        notes: row.notes.trim() || null,
        is_new_incoming_product: row.is_new_incoming_product,
        is_disassembled: row.is_disassembled,
      }))
    );

    setLoading(false);

    if (productsInsert.error) {
      const message = productsInsert.error.message;
      if (message.includes("shipment_products_shipment_id_product_id_key")) {
        setError(
          "قاعدة البيانات لسه تمنع تكرار نفس الصنف في الشحنة. شغّل migration: 20260604000001_allow_duplicate_shipment_products.sql من Supabase SQL Editor ثم حاول الحفظ مرة أخرى (البيانات في النموذج محفوظة)."
        );
        return;
      }
      setError(message);
      return;
    }

    if (onSaved) {
      onSaved();
      return;
    }

    router.push(`/shipments/${shipmentId}`);
    router.refresh();
  }

  const fieldClass = readOnly ? "input bg-[var(--surface)] opacity-90" : "input";
  const disabled = readOnly || loading;

  const cartonStats = useMemo(() => {
    const entered = shipmentProducts.reduce((sum, row) => {
      const value = Number(row.cartons_count);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
    const target = Number(form.total_cartons);
    return {
      entered,
      target: Number.isFinite(target) && target > 0 ? target : null,
    };
  }, [form.total_cartons, shipmentProducts]);

  const customsExitDate = useMemo(() => {
    if (!form.eta) return "";
    return addDaysToIsoDate(form.eta, CUSTOMS_CLEARANCE_DAYS);
  }, [form.eta]);

  return (
    <>
      <form className="card space-y-6 p-5" onSubmit={readOnly ? (event) => event.preventDefault() : submit}>
        {readOnly ? (
          <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
            وضع العرض فقط — اضغط «تعديل» أعلاه لتغيير البيانات.
          </p>
        ) : null}
        <ErrorMessage message={error} />

        <section className="space-y-3">
          <h2 className="font-bold">البيانات الأساسية</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="label">
              رقم ACID
              <input className={fieldClass} required readOnly={readOnly} disabled={disabled} value={form.acid} onChange={(event) => setField("acid", event.target.value)} />
            </label>
            <label className="label">
              الشركة
              <SearchableSelect
                options={companyOptions}
                required
                disabled={disabled}
                placeholder="ابحث عن الشركة..."
                value={form.company_id}
                onChange={(value) => setField("company_id", value)}
              />
            </label>
            <label className="label">
              المورد
              <SearchableSelect
                options={supplierOptions}
                required
                disabled={disabled}
                placeholder="ابحث عن المورد..."
                value={form.supplier_id}
                onChange={(value) => setField("supplier_id", value)}
              />
            </label>
            <label className="label">
              نوع / وصف البضاعة
              <input
                className={fieldClass}
                placeholder="مثال: خردوات — كشاف"
                required
                readOnly={readOnly}
                disabled={disabled}
                value={form.shipment_type}
                onChange={(event) => setField("shipment_type", event.target.value)}
              />
            </label>
            <label className="label">
              ميناء الشحن
              <SearchableSelect
                options={PORT_SELECT_OPTIONS}
                required
                disabled={readOnly}
                value={form.shipping_port}
                onChange={(value) => setField("shipping_port", value)}
                placeholder="اختر ميناء الشحن"
              />
            </label>
            <label className="label">
              ميناء الوصول
              <SearchableSelect
                options={PORT_SELECT_OPTIONS}
                required
                disabled={readOnly}
                value={form.arrival_port}
                onChange={(value) => setField("arrival_port", value)}
                placeholder="اختر ميناء الوصول"
              />
            </label>
            <label className="label">
              تاريخ الشحن
              <input className="input" required type="date" value={form.shipped_at} onChange={(event) => setField("shipped_at", event.target.value)} />
            </label>
            <label className="label">
              تاريخ الوصول المتوقع
              <input className="input bg-slate-50" required readOnly type="date" value={form.eta} />
            </label>
            <label className="label">
              خروج جمرك (بعد 15 يوم)
              <input className="input bg-slate-50" readOnly value={customsExitDate} />
            </label>
            <label className="label">
              مدة الشحن بالأيام
              <input className="input" min={0} readOnly type="number" value={form.shipping_duration_days} />
            </label>
            <label className="label">
              وزن الشحنة الكلي (كجم)
              <input className="input" min={0} type="number" value={form.total_weight_kg} onChange={(event) => setField("total_weight_kg", event.target.value)} />
            </label>
            <label className="label">
              إجمالي الكراتين
              <input className="input" min={0} type="number" value={form.total_cartons} onChange={(event) => setField("total_cartons", event.target.value)} />
            </label>
            <label className="label">
              قيمة الشحنة (USD)
              <input
                className="input"
                min={0}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.value_usd}
                onChange={(event) => setField("value_usd", event.target.value)}
              />
            </label>
            <label className="label">
              عدد الحاويات
              <input
                className="input"
                min={1}
                type="number"
                value={form.containers_count}
                onChange={(event) => setField("containers_count", event.target.value)}
                placeholder="يفتح صفوف الحاويات تلقائيا"
              />
            </label>
            <label className="label xl:col-span-2">
              خط السير
              <input className="input" value={form.route} onChange={(event) => setField("route", event.target.value)} />
            </label>
          </div>

          {isNew ? (
            <label className="label block max-w-md">
              ملف INV (PDF) — إلزامي
              <input
                accept="application/pdf,.pdf"
                className="input"
                required
                type="file"
                onChange={(event) => setInvFile(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}

          <label className="label">
            ملاحظات
            <textarea className="input min-h-24" value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
          </label>
        </section>

        <section className="space-y-3 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">الحاويات</h2>
              <p className="text-sm text-[var(--muted)]">أدخل اسم أو رقم كل حاوية فقط.</p>
            </div>
            {!readOnly ? (
              <button className="btn btn-secondary text-sm" onClick={() => setContainers((current) => [...current, { ...emptyContainer }])} type="button">
                <Plus className="h-4 w-4" />
                حاوية
              </button>
            ) : null}
          </div>
          <div className="space-y-3">
            {containers.map((container, index) => (
              <div className="grid gap-3 rounded-md border border-[var(--border)] p-3 lg:grid-cols-[1fr_auto]" key={index}>
                <input
                  className={fieldClass}
                  disabled={disabled}
                  placeholder="اسم / رقم الحاوية"
                  readOnly={readOnly}
                  value={container.container_number}
                  onChange={(event) => updateContainer(index, { ...container, container_number: event.target.value })}
                />
                {!readOnly ? (
                    <button className="btn btn-secondary px-2" onClick={() => setContainers((current) => current.length === 1 ? [{ ...emptyContainer }] : current.filter((_, rowIndex) => rowIndex !== index))} type="button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 border-t border-[var(--border)] pt-5">
          <div className="sticky top-16 z-[15] flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/95 px-3 py-3 shadow-sm backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-bold">منتجات الشحنة</h2>
              {cartonStats.target != null ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    cartonStats.entered === cartonStats.target
                      ? "bg-emerald-100 text-emerald-800"
                      : cartonStats.entered > cartonStats.target
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  الكراتين: {cartonStats.entered} / {cartonStats.target}
                </span>
              ) : cartonStats.entered > 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  الكراتين المدخلة: {cartonStats.entered}
                </span>
              ) : (
                <span className="text-xs text-[var(--muted)]">حدّد إجمالي الكراتين في بيانات الشحنة</span>
              )}
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary text-sm" onClick={() => setShowProductModal(true)} type="button">
                  <Plus className="h-4 w-4" />
                  منتج جديد
                </button>
                <button className="btn btn-secondary text-sm" onClick={() => setShipmentProducts((current) => [...current, { ...emptyProduct }])} type="button">
                  <Plus className="h-4 w-4" />
                  سطر منتج
                </button>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            {shipmentProducts.map((row, index) => {
              const selected = productById.get(row.product_id);
              return (
                <div className="grid gap-3 rounded-md border border-[var(--border)] p-3 md:grid-cols-[1fr_100px_100px_110px_220px_auto]" key={index}>
                  <SearchableSelect
                    options={productOptions}
                    disabled={readOnly}
                    value={row.product_id}
                    onChange={(value) => updateShipmentProduct(index, { ...row, product_id: value })}
                    placeholder="ابحث عن المنتج (SKU أو الاسم)"
                  />
                  <input
                    className={fieldClass}
                    min={0}
                    placeholder="الكرتين"
                    readOnly={readOnly}
                    type="number"
                    value={row.cartons_count}
                    onChange={(event) =>
                      updateShipmentProduct(
                        index,
                        syncProductQuantityFields({ ...row, cartons_count: event.target.value })
                      )
                    }
                  />
                  <input
                    className={fieldClass}
                    min={0}
                    placeholder="الوحدة"
                    readOnly={readOnly}
                    type="number"
                    value={row.unit_quantity}
                    onChange={(event) =>
                      updateShipmentProduct(
                        index,
                        syncProductQuantityFields({ ...row, unit_quantity: event.target.value })
                      )
                    }
                  />
                  <input
                    className="input bg-slate-50 text-[var(--foreground)]"
                    placeholder="إجمالي القطع"
                    readOnly
                    tabIndex={-1}
                    type="number"
                    value={row.quantity}
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.is_new_incoming_product}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateShipmentProduct(index, { ...row, is_new_incoming_product: event.target.checked })
                        }
                        type="checkbox"
                      />
                      منتج وارد جديد
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={row.is_disassembled}
                        disabled={readOnly}
                        onChange={(event) => updateShipmentProduct(index, { ...row, is_disassembled: event.target.checked })}
                        type="checkbox"
                      />
                      مفكك
                    </label>
                  </div>
                  <button className="btn btn-secondary px-2" disabled={readOnly} onClick={() => setShipmentProducts((current) => current.length === 1 ? [{ ...emptyProduct }] : current.filter((_, rowIndex) => rowIndex !== index))} type="button">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {selected ? <input className="input md:col-span-5" placeholder="ملاحظات المنتج" value={row.notes} onChange={(event) => updateShipmentProduct(index, { ...row, notes: event.target.value })} /> : null}
                </div>
              );
            })}
          </div>
        </section>

        {!readOnly ? (
          <button className="btn" disabled={loading} type="submit">
            <Save className="h-4 w-4" />
            {loading ? "جاري الحفظ..." : shipment ? "حفظ الشحنة" : "حفظ الشحنة"}
          </button>
        ) : null}
      </form>

      {showProductModal ? (
        <QuickProductModal
          categories={categories}
          onClose={() => setShowProductModal(false)}
          onCreated={(product) => {
            setProducts((current) => [product, ...current]);
            setShipmentProducts((current) => {
              const next = current.length === 1 && !current[0].product_id ? [{ ...current[0], product_id: product.id }] : [...current, { ...emptyProduct, product_id: product.id }];
              return next;
            });
            setShowProductModal(false);
          }}
        />
      ) : null}
    </>
  );
}

function QuickProductModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: ProductCategory[];
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories]);
  const [form, setForm] = useState({ name_ar: "", category_id: "", barcode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const category = categories.find((row) => row.id === form.category_id);
    const result = await createClient()
      .from("products")
      .insert({
        name_ar: form.name_ar.trim(),
        category: category?.name_ar ?? null,
        category_id: form.category_id || null,
        barcode: form.barcode.trim() || null,
        unit: "piece",
      })
      .select("id,sku,name_ar,name_en,category,category_id,barcode,unit,is_active")
      .single();

    setLoading(false);

    if (result.error) {
      setError(result.error.message.includes("products_barcode_unique_idx") ? "الباركود مستخدم لمنتج آخر." : result.error.message);
      return;
    }

    onCreated(result.data as Product);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <form className="card w-full max-w-lg space-y-4 p-5" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">منتج جديد</h2>
          <button className="btn btn-secondary p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ErrorMessage message={error} />
        <p className="text-xs text-[var(--muted)]">سيتم توليد SKU تلقائيا من كود الفئة.</p>
        <label className="label">
          اسم المنتج
          <input className="input" required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} />
        </label>
        <label className="label">
          الفئة
          <SearchableSelect
            options={categoryOptions}
            placeholder="ابحث عن الفئة..."
            required
            value={form.category_id}
            onChange={(value) => setForm({ ...form, category_id: value })}
          />
        </label>
        <label className="label">
          الباركود (اختياري)
          <input className="input" inputMode="numeric" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
        </label>
        <button className="btn" disabled={loading} type="submit">
          {loading ? "جاري الحفظ..." : "حفظ المنتج"}
        </button>
      </form>
    </div>
  );
}
