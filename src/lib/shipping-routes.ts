import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchRouteDurationDays(
  supabase: SupabaseClient,
  shippingPort?: string | null,
  arrivalPort?: string | null
) {
  const from = shippingPort?.trim() ?? "";
  const to = arrivalPort?.trim() ?? "";
  if (!from || !to) return null;

  const { data, error } = await supabase
    .from("shipping_routes")
    .select("duration_days")
    .eq("is_active", true)
    .eq("shipping_port", from)
    .eq("arrival_port", to)
    .maybeSingle();

  if (error) return null;
  const days = Number(data?.duration_days);
  return Number.isFinite(days) && days > 0 ? days : null;
}
