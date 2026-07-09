export type UserRole = "admin" | "manager" | "viewer" | "supplier";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "مدير النظام",
  manager: "مشرف",
  viewer: "مشاهدة فقط",
  supplier: "مورد",
};

export function canWrite(role?: UserRole | string | null): boolean {
  return role === "admin" || role === "manager";
}

export function isAdmin(role?: UserRole | string | null): boolean {
  return role === "admin";
}

export function isSupplier(role?: UserRole | string | null): boolean {
  return role === "supplier";
}

export function isStaff(role?: UserRole | string | null): boolean {
  return role === "admin" || role === "manager" || role === "viewer";
}

/** Admin/manager can run supplier PO workflow (confirm items, receive batches) for testing/support. */
export function canActAsSupplier(role?: UserRole | string | null): boolean {
  return role === "admin" || role === "manager" || role === "supplier";
}

export function hasFullAccess(role?: UserRole | string | null): boolean {
  return role === "admin";
}
