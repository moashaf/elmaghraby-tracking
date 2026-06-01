"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowRight, Coins, Download, Pencil, RefreshCw, X } from "lucide-react";
import { ShipmentFiles } from "@/components/shipment-files";
import { ShipmentForm } from "@/components/shipment-form";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { getNextStatusAction, NEXT_ACTION_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { useProfile } from "@/context/profile-context";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Shipment, ShipmentContainer, ShipmentCost, ShipmentDocument, ShipmentProduct, TimelineEvent } from "@/lib/types";

const bucket = "container-files";

type Tab = "summary" | "containers" | "products" | "files" | "timeline" | "costs";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "ملخص" },
  { id: "containers", label: "الحاويات" },
  { id: "products", label: "المنتجات" },
  { id: "files", label: "الملفات" },
  { id: "timeline", label: "Timeline" },
  { id: "costs", label: "المصاريف" },
];

export default function ShipmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { canWrite } = useProfile();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [containers, setContainers] = useState<ShipmentContainer[]>([]);
  const [products, setProducts] = useState<ShipmentProduct[]>([]);
  const [cost, setCost] = useState<ShipmentCost | null>(null);
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showCosts, setShowCosts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();
    const [shipmentResult, containersResult, productsResult, costResult, timelineResult, documentsResult] = await Promise.all([
      supabase.from("shipments").select("*,companies(name_ar),suppliers(name_ar)").eq("id", params.id).single(),
      supabase.from("shipment_containers").select("*").eq("shipment_id", params.id).order("created_at"),
      supabase.from("shipment_products").select("*,products(sku,name_ar,unit)").eq("shipment_id", params.id).order("created_at"),
      supabase.from("shipment_costs").select("*").eq("shipment_id", params.id).maybeSingle(),
      supabase.from("shipment_timeline_events").select("id,shipment_id,event_type,title_ar,description_ar,created_at").eq("shipment_id", params.id).order("created_at", { ascending: false }),
      supabase.from("shipment_documents").select("*").eq("shipment_id", params.id).order("uploaded_at", { ascending: false }),
    ]);
    setLoading(false);

    if (shipmentResult.error) {
      setError(shipmentResult.error.message);
      return;
    }

    setShipment(shipmentResult.data as Shipment);
    setContainers((containersResult.data ?? []) as ShipmentContainer[]);
    setProducts((productsResult.data ?? []) as ShipmentProduct[]);
    setCost((costResult.data as ShipmentCost | null) ?? null);
    setDocuments((documentsResult.data ?? []) as ShipmentDocument[]);
    setTimeline((timelineResult.data ?? []) as TimelineEvent[]);

    const firstRelatedError = containersResult.error || productsResult.error || costResult.error || timelineResult.error || documentsResult.error;
    if (firstRelatedError) setError(firstRelatedError.message);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && canWrite) {
      queueMicrotask(() => setEditing(true));
    }
  }, [searchParams, canWrite]);

  async function downloadDocument(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function nextAction() {
    if (!shipment) return;
    const action = getNextStatusAction(shipment.status);
    if (action === "to_close" || action === "edit_costs") {
      setShowCosts(true);
      return;
    }
    if (action !== "to_customs") return;

    setSaving(true);
    const result = await createClient().rpc("transition_shipment_status", {
      shipment_id: shipment.id,
      target_status: "customs",
    });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div className="card p-5 text-sm text-[var(--muted)]">جاري تحميل الشحنة...</div>;
  }

  if (!shipment) {
    return <ErrorMessage message={error || "الشحنة غير موجودة."} />;
  }

  const action = getNextStatusAction(shipment.status);
  const readOnly = shipment.status === "closed" && !editing;
  const invDoc = documents.find((doc) => doc.doc_type.toUpperCase() === "INV");

  return (
    <div className="space-y-5">
      <PageHeader
        title={`الشحنة ${shipment.shipment_number}`}
        description={`${shipment.companies?.name_ar ?? "شركة غير محددة"} - ${shipment.suppliers?.name_ar ?? "مورد غير محدد"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-secondary" href="/shipments">
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Link>
            <Link className="btn btn-secondary" href={`/shipments/${shipment.id}/report`}>
              تقرير / PDF
            </Link>
            {readOnly && canWrite ? (
              <button className="btn btn-secondary" onClick={() => setEditing(true)} type="button">
                <Pencil className="h-4 w-4" />
                تعديل
              </button>
            ) : null}
            {editing && shipment.status === "closed" ? (
              <button className="btn btn-secondary" onClick={() => setEditing(false)} type="button">
                إلغاء التعديل
              </button>
            ) : null}
            <button className="btn btn-secondary" onClick={load} type="button">
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
            {action ? (
              <button className="btn" disabled={saving} onClick={nextAction} type="button">
                {saving ? "..." : NEXT_ACTION_LABELS[action]}
              </button>
            ) : null}
          </div>
        }
      />

      <ErrorMessage message={error} />

      <section className="grid gap-4 md:grid-cols-4">
        <InfoCard label="الحالة" value={SHIPMENT_STATUS_LABELS[shipment.status]} badge={`status-${shipment.status}`} />
        <InfoCard label="تاريخ الشحن" value={shipment.shipped_at} />
        <InfoCard label="الوصول المتوقع" value={shipment.eta} />
        <InfoCard label="عدد الحاويات" value={containers.length.toString()} />
      </section>

      {invDoc ? (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-bold">ملف INV</div>
            <p className="text-sm text-[var(--muted)]">{invDoc.file_name}</p>
          </div>
          <button className="btn btn-secondary" onClick={() => downloadDocument(invDoc.storage_path)} type="button">
            <Download className="h-4 w-4" />
            تحميل INV
          </button>
        </section>
      ) : null}

      <div className="flex gap-2 overflow-auto border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === tab.id ? "border-[#0f766e] text-[#0f766e]" : "border-transparent text-[var(--muted)]"}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        <ShipmentForm
          shipment={shipment}
          initialContainers={containers}
          initialProducts={products}
          readOnly={readOnly || !canWrite}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
      {activeTab === "containers" ? <ContainersTable rows={containers} /> : null}
      {activeTab === "products" ? <ProductsTable rows={products} /> : null}
      {activeTab === "files" ? <ShipmentFiles shipmentId={shipment.id} containers={containers} /> : null}
      {activeTab === "timeline" ? <Timeline rows={timeline} /> : null}
      {activeTab === "costs" ? <CostsPanel cost={cost} onEdit={() => setShowCosts(true)} /> : null}

      {showCosts ? (
        <CostsDialog
          cost={cost}
          shipmentId={shipment.id}
          isClosed={shipment.status === "closed"}
          onClose={() => setShowCosts(false)}
          onSaved={async () => {
            setShowCosts(false);
            setEditing(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function InfoCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 font-bold">
        {badge ? <span className={`status-badge ${badge}`}>{value}</span> : value}
      </div>
    </div>
  );
}

function ContainersTable({ rows }: { rows: ShipmentContainer[] }) {
  return (
    <div className="card overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="table-head">
          <tr>
            <th className="p-3 text-right">رقم الحاوية</th>
            <th className="p-3 text-right">الوزن</th>
            <th className="p-3 text-right">الكرتين</th>
            <th className="p-3 text-right">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr className="border-t border-[var(--border)]" key={row.id}>
              <td className="p-3 font-semibold">{row.container_number}</td>
              <td className="p-3">{row.weight_kg ?? "-"}</td>
              <td className="p-3">{row.cartons_count ?? "-"}</td>
              <td className="p-3">{row.notes ?? "-"}</td>
            </tr>
          )) : (
            <tr><td className="p-4 text-[var(--muted)]" colSpan={4}>لا توجد حاويات.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTable({ rows }: { rows: ShipmentProduct[] }) {
  return (
    <div className="card overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="table-head">
          <tr>
            <th className="p-3 text-right">SKU</th>
            <th className="p-3 text-right">المنتج</th>
            <th className="p-3 text-right">الكمية</th>
            <th className="p-3 text-right">الكرتين</th>
            <th className="p-3 text-right">جديد</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr className="border-t border-[var(--border)]" key={row.id}>
              <td className="p-3 font-semibold">{row.products?.sku ?? "-"}</td>
              <td className="p-3">{row.products?.name_ar ?? "-"}</td>
              <td className="p-3">{row.quantity}</td>
              <td className="p-3">{row.cartons_count ?? "-"}</td>
              <td className="p-3">{row.is_new_incoming_product ? "نعم" : "لا"}</td>
            </tr>
          )) : (
            <tr><td className="p-4 text-[var(--muted)]" colSpan={5}>لا توجد منتجات.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ rows }: { rows: TimelineEvent[] }) {
  return (
    <div className="card divide-y divide-[var(--border)]">
      {rows.length ? rows.map((row) => (
        <div className="p-4" key={row.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{row.title_ar}</h3>
            <span className="text-xs text-[var(--muted)]">{new Date(row.created_at).toISOString().slice(0, 10)}</span>
          </div>
          {row.description_ar ? <p className="mt-1 text-sm text-[var(--muted)]">{row.description_ar}</p> : null}
        </div>
      )) : (
        <div className="p-4 text-sm text-[var(--muted)]">لا توجد أحداث بعد.</div>
      )}
    </div>
  );
}

function CostsPanel({ cost, onEdit }: { cost: ShipmentCost | null; onEdit: () => void }) {
  const values = useMemo(() => cost ? [
    ["جمارك", cost.customs_cost],
    ["شحن", cost.shipping_cost],
    ["تخليص", cost.clearance_cost],
    ["نقل داخلي", cost.local_transport_cost],
    ["مصروفات أخرى", cost.other_expenses],
    ["الإجمالي", cost.total_cost],
  ] : [], [cost]);

  if (!cost) {
    return (
      <div className="card p-5">
        <p className="text-sm text-[var(--muted)]">لم يتم تسجيل مصاريف لهذه الشحنة بعد.</p>
        <button className="btn mt-4" onClick={onEdit} type="button">
          <Coins className="h-4 w-4" />
          إدخال المصاريف
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="grid gap-3 md:grid-cols-3">
        {values.map(([label, value]) => (
          <div className="rounded-md border border-[var(--border)] p-3" key={label}>
            <div className="text-sm text-[var(--muted)]">{label}</div>
            <div className="mt-1 font-bold">{Number(value).toLocaleString("ar-EG")}</div>
          </div>
        ))}
      </div>
      {cost.closing_notes ? <p className="mt-4 text-sm text-[var(--muted)]">{cost.closing_notes}</p> : null}
      <button className="btn mt-4" onClick={onEdit} type="button">
        تعديل المصاريف
      </button>
    </div>
  );
}

function CostsDialog({
  shipmentId,
  cost,
  isClosed,
  onClose,
  onSaved,
}: {
  shipmentId: string;
  cost: ShipmentCost | null;
  isClosed: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customs_cost: cost?.customs_cost?.toString() ?? "0",
    shipping_cost: cost?.shipping_cost?.toString() ?? "0",
    clearance_cost: cost?.clearance_cost?.toString() ?? "0",
    local_transport_cost: cost?.local_transport_cost?.toString() ?? "0",
    other_expenses: cost?.other_expenses?.toString() ?? "0",
    closing_notes: cost?.closing_notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await createClient().rpc("close_shipment_with_costs", {
      shipment_id: shipmentId,
      customs_cost: Number(form.customs_cost) || 0,
      shipping_cost: Number(form.shipping_cost) || 0,
      clearance_cost: Number(form.clearance_cost) || 0,
      local_transport_cost: Number(form.local_transport_cost) || 0,
      other_expenses: Number(form.other_expenses) || 0,
      closing_notes: form.closing_notes.trim() || null,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <form className="card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-auto p-5" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">مصاريف الإغلاق</h2>
          <button className="btn btn-secondary p-2" onClick={onClose} type="button"><X className="h-4 w-4" /></button>
        </div>
        <ErrorMessage message={error} />
        <div className="grid gap-3 md:grid-cols-2">
          <CostInput label="الجمارك" name="customs_cost" form={form} setForm={setForm} />
          <CostInput label="الشحن" name="shipping_cost" form={form} setForm={setForm} />
          <CostInput label="التخليص" name="clearance_cost" form={form} setForm={setForm} />
          <CostInput label="النقل الداخلي" name="local_transport_cost" form={form} setForm={setForm} />
          <CostInput label="مصروفات أخرى" name="other_expenses" form={form} setForm={setForm} />
        </div>
        <label className="label">
          ملاحظات الإغلاق
          <textarea className="input min-h-24" value={form.closing_notes} onChange={(event) => setForm({ ...form, closing_notes: event.target.value })} />
        </label>
        <button className="btn" disabled={loading} type="submit">
          {loading ? "جاري الحفظ..." : isClosed ? "حفظ المصاريف" : "حفظ وإغلاق"}
        </button>
      </form>
    </div>
  );
}

type CostsForm = {
  customs_cost: string;
  shipping_cost: string;
  clearance_cost: string;
  local_transport_cost: string;
  other_expenses: string;
  closing_notes: string;
};

function CostInput({
  label,
  name,
  form,
  setForm,
}: {
  label: string;
  name: keyof Omit<CostsForm, "closing_notes">;
  form: CostsForm;
  setForm: React.Dispatch<React.SetStateAction<CostsForm>>;
}) {
  return (
    <label className="label">
      {label}
      <input className="input" min={0} step="0.01" type="number" value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
    </label>
  );
}
