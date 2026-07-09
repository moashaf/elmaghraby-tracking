import { useLanguage } from "@/context/language-context";
import { getPoStatusLabel, type PoStatus } from "@/lib/purchase-order-status";

const STATUS_COLORS: Record<PoStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-50 text-blue-700",
  partially_received: "bg-amber-50 text-amber-800",
  received: "bg-emerald-50 text-emerald-700",
  over_received: "bg-orange-50 text-orange-800",
  cancelled: "bg-red-50 text-red-700",
};

export function PurchaseOrderStatusPill({ status }: { status: PoStatus }) {
  const { lang } = useLanguage();
  return (
    <span className={`status-badge ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>
      {getPoStatusLabel(status, lang) ?? status}
    </span>
  );
}
