import type { SearchableOption } from "@/components/searchable-select";

export function toEntityOptions<T extends { id: string }>(
  rows: T[],
  labelFn: (row: T) => string,
  keywordsFn?: (row: T) => string
): SearchableOption[] {
  return rows
    .map((row) => ({
      value: row.id,
      label: labelFn(row),
      keywords: keywordsFn?.(row) ?? labelFn(row),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
}
