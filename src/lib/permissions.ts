export type UserRole = "admin" | "manager" | "viewer";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "مدير النظام",
  manager: "مشرف",
  viewer: "مشاهدة فقط",
};

export function canWrite(role?: UserRole | string | null): boolean {
  return role === "admin" || role === "manager";
}

export function isAdmin(role?: UserRole | string | null): boolean {
  return role === "admin";
}
