import { addDaysToIsoDate } from "@/lib/eta";
import { createClient } from "@/lib/supabase/client";
import { todayIso } from "@/lib/reports/shipment-helpers";

export type SystemSettings = {
  require_costs_before_close: boolean;
  require_customs_document: boolean;
  delayed_after_eta_days: number;
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  require_costs_before_close: true,
  require_customs_document: false,
  delayed_after_eta_days: 0,
};

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await createClient()
    .from("app_settings")
    .select("value")
    .eq("key", "system")
    .maybeSingle();

  if (error || !data?.value) return DEFAULT_SYSTEM_SETTINGS;

  const value = data.value as Partial<SystemSettings>;
  return {
    require_costs_before_close: value.require_costs_before_close ?? DEFAULT_SYSTEM_SETTINGS.require_costs_before_close,
    require_customs_document: value.require_customs_document ?? DEFAULT_SYSTEM_SETTINGS.require_customs_document,
    delayed_after_eta_days: value.delayed_after_eta_days ?? DEFAULT_SYSTEM_SETTINGS.delayed_after_eta_days,
  };
}

/** Shipment is overdue when still in sea past shipped_at + duration (or ETA + grace). */
export function isShipmentDelayed(
  eta: string | null | undefined,
  status: string,
  settings: SystemSettings,
  today = todayIso(),
  shippedAt?: string | null,
  shippingDurationDays?: number | null
): boolean {
  if (status !== "in_sea") return false;

  if (shippedAt && shippingDurationDays != null && shippingDurationDays > 0) {
    const threshold = addDaysToIsoDate(shippedAt, shippingDurationDays);
    return today > threshold;
  }

  if (!eta) return false;
  const threshold = addDaysToIsoDate(eta, settings.delayed_after_eta_days ?? 0);
  return today > threshold;
}
