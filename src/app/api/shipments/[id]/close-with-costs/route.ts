import { CUSTOMS_RELEASE_DOC_TYPE } from "@/lib/storage-path";
import { validateCloseShipmentRules } from "@/lib/close-shipment-rules";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@/lib/system-settings";
import { jsonError, requireWriter } from "@/lib/supabase/server";

type CloseCostsBody = {
  customs_cost?: number;
  clearance_cost?: number;
  local_transport_cost?: number;
  other_expenses?: number;
  closing_notes?: string | null;
};

async function loadSystemSettings(adminClient: ReturnType<typeof import("@/lib/supabase/server").createAdminClient>) {
  const { data } = await adminClient.from("app_settings").select("value").eq("key", "system").maybeSingle();
  if (!data?.value) return DEFAULT_SYSTEM_SETTINGS;
  const value = data.value as Partial<SystemSettings>;
  return {
    require_costs_before_close: value.require_costs_before_close ?? DEFAULT_SYSTEM_SETTINGS.require_costs_before_close,
    require_customs_document: value.require_customs_document ?? DEFAULT_SYSTEM_SETTINGS.require_customs_document,
    delayed_after_eta_days: value.delayed_after_eta_days ?? DEFAULT_SYSTEM_SETTINGS.delayed_after_eta_days,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id: shipmentId } = await params;
  let body: CloseCostsBody;
  try {
    body = (await request.json()) as CloseCostsBody;
  } catch {
    return jsonError("طلب غير صالح.", 400);
  }

  const customsCost = Number(body.customs_cost) || 0;
  const clearanceCost = Number(body.clearance_cost) || 0;
  const localTransportCost = Number(body.local_transport_cost) || 0;
  const otherExpenses = Number(body.other_expenses) || 0;
  const closingNotes = body.closing_notes?.trim() || null;
  const totalCost = customsCost + clearanceCost + localTransportCost + otherExpenses;

  const { data: shipment, error: shipmentError } = await auth.adminClient
    .from("shipments")
    .select("id, status, closed_at")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipmentError) return jsonError(shipmentError.message, 500);
  if (!shipment) return jsonError("الشحنة غير موجودة.", 404);

  const settings = await loadSystemSettings(auth.adminClient);
  const isAlreadyClosed = shipment.status === "closed";

  const { data: customsDoc } = await auth.adminClient
    .from("shipment_documents")
    .select("id")
    .eq("shipment_id", shipmentId)
    .eq("doc_type", CUSTOMS_RELEASE_DOC_TYPE)
    .limit(1)
    .maybeSingle();

  const validation = validateCloseShipmentRules({
    isAlreadyClosed,
    totalCost,
    hasCustomsDocument: Boolean(customsDoc),
    settings,
  });
  if (!validation.ok) return jsonError(validation.message, 400);

  const costPayload = {
    customs_cost: customsCost,
    shipping_cost: 0,
    clearance_cost: clearanceCost,
    local_transport_cost: localTransportCost,
    other_expenses: otherExpenses,
    closing_notes: closingNotes,
    updated_at: new Date().toISOString(),
  };

  const { data: existingCost } = await auth.adminClient
    .from("shipment_costs")
    .select("id")
    .eq("shipment_id", shipmentId)
    .maybeSingle();

  const costResult = existingCost
    ? await auth.adminClient.from("shipment_costs").update(costPayload).eq("id", existingCost.id).select("id").single()
    : await auth.adminClient
        .from("shipment_costs")
        .insert({
          shipment_id: shipmentId,
          ...costPayload,
          closed_by: auth.user.id,
          closed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

  if (costResult.error) return jsonError(costResult.error.message, 500);

  if (!isAlreadyClosed) {
    const { error: closeError } = await auth.adminClient
      .from("shipments")
      .update({
        status: "closed",
        previous_status: shipment.status,
        closed_at: shipment.closed_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);

    if (closeError) return jsonError(closeError.message, 500);

    await auth.adminClient.from("shipment_timeline_events").insert({
      shipment_id: shipmentId,
      event_type: "closed_with_costs",
      title_ar: "إغلاق الشحنة",
      description_ar: "تم حفظ المصاريف وإغلاق الشحنة",
      metadata: { cost_id: costResult.data.id },
      created_by: auth.user.id,
    });
  }

  return Response.json({ ok: true, cost_id: costResult.data.id });
}
