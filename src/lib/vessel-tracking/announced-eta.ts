const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function toIsoDate(year: number, monthIndex: number, day: number): string | null {
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Parse AIS-style dates ("Oct 13, 17:00" or "2026-10-13") to YYYY-MM-DD.
 * `eta` rolls a yearless past date into next year (upcoming voyage).
 * `actual` keeps ATA/ATD in the current/previous year so a call that already
 * happened is not treated as next year's ETA.
 */
export function parseAnnouncedEtaToIsoDate(
  raw: string,
  now = new Date(),
  mode: "eta" | "actual" = "eta"
): string | null {
  const text = raw.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (!text || /^(?:n\/?a|unknown|-|—|–)$/i.test(text)) return null;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const named = text.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/
  );
  if (!named) return null;

  const monthIndex = MONTHS[named[1].toLowerCase()];
  if (monthIndex == null) return null;

  const day = Number(named[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const explicitYear = named[3] ? Number(named[3]) : null;
  if (explicitYear && explicitYear >= 2000) {
    return toIsoDate(explicitYear, monthIndex, day);
  }

  const currentYear = now.getFullYear();
  const thisYear = toIsoDate(currentYear, monthIndex, day);
  if (!thisYear) return null;

  const candidate = new Date(`${thisYear}T12:00:00`);
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

  if (mode === "actual") {
    if (candidate.getTime() > now.getTime() + sixtyDaysMs) {
      return toIsoDate(currentYear - 1, monthIndex, day);
    }
    return thisYear;
  }

  if (candidate.getTime() < now.getTime() - fourteenDaysMs) {
    return toIsoDate(currentYear + 1, monthIndex, day);
  }
  return thisYear;
}

function normalizePortKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[،,]/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PORT_ALIASES: Record<string, string[]> = {
  السخنة: ["sokhna", "ain sokhna", "el sokhna", "ain-sokhna", "egsok", "suez", "suez canal"],
  "العين السخنة": ["sokhna", "ain sokhna", "el sokhna", "suez", "suez canal"],
  الإسكندرية: ["alexandria", "al iskandariyah"],
  بورسعيد: ["port said", "port-said", "bur said"],
  دمياط: ["damietta", "dumyat"],
  السويس: ["suez", "suez canal", "as suways", "al suways", "suways"],
  مرسين: ["mersin"],
  جدة: ["jeddah", "jiddah"],
  الدمام: ["dammam"],
  دبي: ["dubai"],
  "جبل علي": ["jebel ali", "jebel-ali"],
};

function aliasTokens(arrivalPort: string) {
  const key = normalizePortKey(arrivalPort);
  const city = key.split(" ")[0] ?? key;
  const aliases = new Set<string>([key, city]);
  for (const [arabic, english] of Object.entries(PORT_ALIASES)) {
    const arabicKey = normalizePortKey(arabic);
    if (key.includes(arabicKey) || arabicKey.includes(city)) {
      for (const item of english) aliases.add(item);
    }
  }
  return [...aliases];
}

export function destinationMatchesArrivalPort(aisPort: string, arrivalPort: string) {
  const ais = normalizePortKey(aisPort);
  const arrival = normalizePortKey(arrivalPort);
  if (!ais || !arrival) return false;
  if (ais.includes(arrival) || arrival.includes(ais.split(" ")[0] ?? arrival)) return true;
  return aliasTokens(arrivalPort).some((token) => token.length >= 4 && ais.includes(token));
}

export function destinationServesArrivalPort(aisPort: string, arrivalPort: string) {
  if (destinationMatchesArrivalPort(aisPort, arrivalPort)) return true;
  return Boolean(arrivalPort && aisPort && isEgyptPort(arrivalPort) && isEgyptPort(aisPort));
}

function isEgyptPort(name: string) {
  return /egypt|مصر|sokhna|suez|suways|alexandria|port said|damietta|دمياط|الإسكندرية|بورسعيد|السويس|السخنة/i.test(
    name
  );
}

export type VoyagePortCall = {
  port: string;
  kind: "ATA" | "ATD" | "ETA";
  dateIso: string;
};

function cargoPortCalls(arrivalPort: string, calls: VoyagePortCall[]) {
  const matching = calls.filter((call) => destinationMatchesArrivalPort(call.port, arrivalPort));
  if (matching.length) return matching;
  if (arrivalPort && isEgyptPort(arrivalPort)) {
    return calls.filter((call) => isEgyptPort(call.port));
  }
  return [];
}

function callsOnThisVoyage(calls: VoyagePortCall[], shippedAt?: string) {
  if (!shippedAt) return calls;
  return calls.filter((call) => call.dateIso.slice(0, 10) >= shippedAt);
}

export function voyageShowsArrivalAtPort(input: {
  arrivalPort?: string | null;
  destination?: string | null;
  currentEtaIso?: string | null;
  portCalls?: VoyagePortCall[];
  shippedAt?: string | null;
  todayIso?: string;
}) {
  const arrivalPort = (input.arrivalPort ?? "").trim();
  const todayIso = input.todayIso ?? new Date().toISOString().slice(0, 10);
  const destination = (input.destination ?? "").trim();
  const shippedAt = (input.shippedAt ?? "").trim().slice(0, 10);
  if (destination && destinationServesArrivalPort(destination, arrivalPort)) {
    return { arrived: false, arrivalDateIso: null };
  }
  const list = callsOnThisVoyage(cargoPortCalls(arrivalPort, input.portCalls ?? []), shippedAt);
  const pastArrivals = list
    .filter((call) => (call.kind === "ATA" || call.kind === "ATD") && call.dateIso.slice(0, 10) <= todayIso)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  if (pastArrivals[0]) return { arrived: true, arrivalDateIso: pastArrivals[0].dateIso };
  return { arrived: false, arrivalDateIso: null };
}

export function resolveArrivalEtaFromVoyage(input: {
  arrivalPort?: string | null;
  destination?: string | null;
  currentEtaIso?: string | null;
  portCalls?: VoyagePortCall[];
  shippedAt?: string | null;
  todayIso?: string;
}): string | null {
  const arrivalPort = (input.arrivalPort ?? "").trim();
  const destination = (input.destination ?? "").trim();
  const announcedEta = input.currentEtaIso?.trim() || null;
  const shippedAt = (input.shippedAt ?? "").trim().slice(0, 10);

  if (announcedEta && destination && destinationServesArrivalPort(destination, arrivalPort)) {
    return announcedEta;
  }
  if (announcedEta && !arrivalPort) return announcedEta;

  const cargoEtas = callsOnThisVoyage(cargoPortCalls(arrivalPort, input.portCalls ?? []), shippedAt)
    .filter((call) => call.kind === "ETA")
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  if (cargoEtas[0] && (!destination || destinationServesArrivalPort(destination, arrivalPort))) {
    return cargoEtas[0].dateIso;
  }

  return null;
}
