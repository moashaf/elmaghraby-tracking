"use client";

import { useProfile } from "@/context/profile-context";
import { EmptyState } from "@/components/ui";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = useProfile();

  if (loading) {
    return <div className="card p-6 text-sm text-[var(--muted)]">جاري التحقق من الصلاحيات...</div>;
  }

  if (!isAdmin) {
    return (
      <EmptyState
        description="إدارة المستخدمين متاحة لحساب المدير فقط."
        title="غير مصرح"
      />
    );
  }

  return <>{children}</>;
}
