import type { ProductCategory } from "@/lib/types";

export function buildCategorySelectOptions(categories: ProductCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));

  function pathFor(categoryId: string) {
    const category = byId.get(categoryId);
    if (!category) return "";

    const parent = category.parent_id ? byId.get(category.parent_id) : null;
    const grand = parent?.parent_id ? byId.get(parent.parent_id) : null;

    if (grand) return `${grand.name_ar} / ${parent!.name_ar} / ${category.name_ar}`;
    if (parent) return `${parent.name_ar} / ${category.name_ar}`;
    return category.name_ar;
  }

  return categories
    .map((category) => {
      const path = pathFor(category.id);
      return {
        value: category.id,
        label: `${category.code ? `${category.code} — ` : ""}${path}`,
        keywords: `${category.code ?? ""} ${category.name_ar} ${path}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

export function isMfkkCategory(category: Pick<ProductCategory, "code" | "name_ar">) {
  return category.code?.startsWith("MFKK") === true || category.name_ar === "مفكك";
}

export type CategoryListFilter = "all" | "commercial" | "roots" | "mfkk";

export function filterCategoryRows(rows: ProductCategory[], mode: CategoryListFilter) {
  if (mode === "all") return rows;
  if (mode === "roots") return rows.filter((row) => !row.parent_id);
  if (mode === "mfkk") return rows.filter((row) => row.code?.startsWith("MFKK") || row.name_ar === "مفكك");
  return rows.filter((row) => !row.code?.startsWith("MFKK") && row.name_ar !== "مفكك");
}
