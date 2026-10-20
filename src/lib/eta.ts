/** YYYY-MM-DD only, ignoring time suffixes from the database. */
export function isoDateOnly(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * AIS sometimes stores a past ATD as next year (Oct 1 → 2027-10-01).
 * If last year's same date sits inside this voyage, that is the cargo arrival.
 */
export function cargoEtaAfterVoyageWindow(
  eta: string | null | undefined,
  shippedAt: string | null | undefined,
  today = todayIsoDate()
) {
  const date = isoDateOnly(eta);
  const shipped = isoDateOnly(shippedAt);
  if (!date) return "";
  if (date <= today) return date;
  const previousYear = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(previousYear)) return date;
  if (shipped && previousYear < shipped) return date;
  if (previousYear <= today) return previousYear;
  return date;
}

export function etaRolledIntoNextVoyage(
  eta: string | null | undefined,
  shippedAt: string | null | undefined,
  today = todayIsoDate()
) {
  const original = isoDateOnly(eta);
  const corrected = cargoEtaAfterVoyageWindow(eta, shippedAt, today);
  return Boolean(original && corrected && corrected < original && corrected <= today);
}

/** Manual in_sea → customs is allowed on/after the cargo ETA (after unrolling next-year AIS dates). */
export function canTransitionToCustoms(
  eta: string | null | undefined,
  today = todayIsoDate(),
  shippedAt?: string | null
) {
  const date = cargoEtaAfterVoyageWindow(eta, shippedAt, today);
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
