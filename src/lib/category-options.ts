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

export function getRootCategories(rows: ProductCategory[]) {
  return rows
    .filter((row) => !row.parent_id)
    .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
}

export function getDirectChildren(rows: ProductCategory[], parentId: string) {
  return rows
    .filter((row) => row.parent_id === parentId)
    .sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar"));
}

export function countDirectChildren(rows: ProductCategory[], parentId: string) {
  return rows.filter((row) => row.parent_id === parentId).length;
}

export function categoryHasChildren(rows: ProductCategory[], categoryId: string) {
  return rows.some((row) => row.parent_id === categoryId);
}

export function buildCategoryBreadcrumb(rows: ProductCategory[], categoryId: string) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const path: ProductCategory[] = [];
  let current = byId.get(categoryId);

  while (current) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path;
}
