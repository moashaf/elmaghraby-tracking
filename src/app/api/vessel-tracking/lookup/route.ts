import { NextResponse } from "next/server";
import { jsonError, requireWriter } from "@/lib/supabase/server";
import { resolveArrivalEtaFromVoyage } from "@/lib/vessel-tracking/announced-eta";
import { trackVesselByName } from "@/lib/vessel-tracking/track";

export async function POST(request: Request) {
  const writer = await requireWriter(request);
  if (!writer.ok) return jsonError(writer.error, writer.status);

  let body: { vesselName?: string; arrivalPort?: string } = {};
  try {
    body = (await request.json()) as { vesselName?: string; arrivalPort?: string };
  } catch {
    return jsonError("طلب غير صالح.", 400);
  }

  const vesselName = body.vesselName?.trim() ?? "";
  if (vesselName.length < 3) {
    return jsonError("اسم المركب مطلوب.", 400);
  }

  const result = await trackVesselByName(vesselName);
  const eta = resolveArrivalEtaFromVoyage({
    arrivalPort: body.arrivalPort,
    destination: result.destination,
    currentEtaIso: result.etaIso,
    portCalls: result.portCalls,
  });

  return NextResponse.json({
    ok: true,
    destination: result.destination,
    eta,
    locationText: result.locationText,
    trackingStatus: result.trackingStatus,
  });
}
