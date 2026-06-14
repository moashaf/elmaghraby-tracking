export function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Display date as DD/MM/YYYY in Arabic UI, keep ISO in exports when needed. */
export function formatDisplayDate(iso: string | null | undefined, lang: "ar" | "en" | "zh" = "ar") {
  if (!iso) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (!match) return iso;
  if (lang === "en") return `${match[3]}/${match[2]}/${match[1]}`;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
