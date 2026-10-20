/** YYYY-MM-DD only, ignoring time suffixes from the database. */
export function isoDateOnly(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Manual in_sea → customs is allowed on/after the cargo ETA date. */
export function canTransitionToCustoms(eta: string | null | undefined, today = todayIsoDate()) {
  const date = isoDateOnly(eta);
  return !date || today >= date;
}

/** Add calendar days to YYYY-MM-DD */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime()) || days <= 0) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromIso` to `toIso` (YYYY-MM-DD). Can be negative. */
export function daysBetweenIsoDates(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso}T12:00:00`);
  const to = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type ShippingRouteLookup = {
  shipping_port: string;
  arrival_port: string;
  duration_days: number;
};

export function findRouteDuration(
  routes: ShippingRouteLookup[],
  shippingPort: string,
  arrivalPort: string
): number | null {
  const from = shippingPort.trim();
  const to = arrivalPort.trim();
  if (!from || !to) return null;

  const match = routes.find(
    (route) => route.shipping_port.trim() === from && route.arrival_port.trim() === to
  );
  return match?.duration_days ?? null;
}
