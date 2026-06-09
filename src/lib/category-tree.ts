import type { ProductCategory } from "@/lib/types";

/** Category id plus all descendant category ids (recursive). */
export function collectDescendantCategoryIds(categories: ProductCategory[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const row of categories) {
      if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }

  return ids;
}
