/** Add calendar days to YYYY-MM-DD */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime()) || days <= 0) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
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
