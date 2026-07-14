import { NextResponse } from "next/server";
import { syncShipmentVesselTracking } from "@/lib/vessel-tracking/sync-shipment";
import { createAdminClient, jsonError, requireWriter } from "@/lib/supabase/server";

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  // Deny by default when CRON_SECRET is unset (never leave the endpoint open).
  if (!secret) return false;

  const header = request.headers.get("x-cron-secret")?.trim();
  if (header && header === secret) return true;

  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() === secret;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("id, vessel_name, arrival_port, status")
    .in("status", ["in_sea"])
    .not("vessel_name", "is", null)
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let updated = 0;
  let notFound = 0;
  let failed = 0;
  let movedToCustoms = 0;
  let revertedToInSea = 0;

  for (const shipment of shipments ?? []) {
    const outcome = await syncShipmentVesselTracking(supabase, shipment);
    if (outcome === "updated") updated++;
    else if (outcome === "not_found") notFound++;
    else if (outcome === "failed") failed++;
    else if (outcome === "moved_to_customs") {
      updated++;
      movedToCustoms++;
    } else if (outcome === "reverted_to_in_sea") {
      updated++;
      revertedToInSea++;
    }
  }

  return NextResponse.json({
    ok: true,
    count: shipments?.length ?? 0,
    updated,
    notFound,
    failed,
    movedToCustoms,
    revertedToInSea,
  });
}

export async function POST(request: Request) {
  const writer = await requireWriter(request);
  if (!writer.ok) return jsonError(writer.error, writer.status);

  let body: { shipmentId?: string } = {};
  try {
    body = (await request.json()) as { shipmentId?: string };
  } catch {
    return jsonError("طلب غير صالح.", 400);
  }

  const shipmentId = body.shipmentId?.trim();
  if (!shipmentId) {
    return jsonError("معرّف الشحنة مطلوب.", 400);
  }

  const { data: shipment, error } = await writer.adminClient
    .from("shipments")
    .select("id, vessel_name, arrival_port, status")
    .eq("id", shipmentId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!shipment) return jsonError("الشحنة غير موجودة.", 404);

  const outcome = await syncShipmentVesselTracking(writer.adminClient, shipment);

  return NextResponse.json({
    ok: true,
    outcome,
    shipmentId,
  });
}
