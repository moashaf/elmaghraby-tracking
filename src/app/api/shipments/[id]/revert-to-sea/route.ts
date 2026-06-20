import { jsonError, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return jsonError(admin.error, admin.status);

  const { id } = await params;
  const { data: shipment, error: fetchError } = await admin.adminClient
    .from("shipments")
    .select("id, status, eta")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return jsonError(fetchError.message, 500);
  if (!shipment) return jsonError("الشحنة غير موجودة.", 404);
  if (shipment.status !== "customs") {
    return jsonError("لا يمكن الإرجاع إلا للشحنات في الجمارك.", 400);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (shipment.eta && today >= shipment.eta) {
    return jsonError("لا يمكن الإرجاع بعد تاريخ الوصول المتوقع (ETA).", 400);
  }

  const { error: updateError } = await admin.adminClient
    .from("shipments")
    .update({
      status: "in_sea",
      previous_status: null,
      auto_moved_to_customs_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) return jsonError(updateError.message, 500);
  return Response.json({ ok: true });
}
