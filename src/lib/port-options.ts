import { PORT_OPTIONS } from "@/lib/data/world-ports";
import type { SearchableOption } from "@/components/searchable-select";

export const PORT_SELECT_OPTIONS: SearchableOption[] = PORT_OPTIONS.map((port) => ({
  value: port,
  label: port,
}));
