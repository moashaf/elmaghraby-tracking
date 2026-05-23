"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  Route,
  Search,
  Settings,
  ShipWheel,
  Tags,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { APP_CREDIT_NAME } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/permissions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: Home },
  { href: "/shipments", label: "الشحنات", icon: Boxes },
  { href: "/shipments/new", label: "شحنة جديدة", icon: Plus, writeOnly: true },
  { href: "/categories", label: "الفئات", icon: Tags, writeOnly: true },
  { href: "/products", label: "المنتجات", icon: Package },
  { href: "/products/search", label: "بحث المنتجات", icon: Search },
  { href: "/suppliers", label: "الموردين", icon: Users, writeOnly: true },
  { href: "/companies", label: "الشركات", icon: Building2, writeOnly: true },
  { href: "/shipping-routes", label: "مسارات الشحن", icon: Route, writeOnly: true },
  { href: "/reports", label: "التقارير", icon: FileText },
  { href: "/users", label: "المستخدمون", icon: UserCog, adminOnly: true },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const { role, canWrite, loading } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.adminOnly && role !== "admin") return false;
        if (item.writeOnly && !canWrite) return false;
        return true;
      }),
    [role, canWrite]
  );

  const mobileNavItems = visibleNavItems.filter((item) =>
    ["/", "/shipments", "/shipments/new", "/products/search", "/reports", "/settings"].includes(item.href)
  );

  async function signOut() {
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
    }
    router.push("/login");
  }

  if (isLogin) return <>{children}</>;

  const navList = (
    <>
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-white text-[#123c5a]" : "text-white/80 hover:bg-white/10"
            }`}
            href={item.href}
            key={item.href}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed right-0 top-0 z-10 hidden h-screen w-72 border-l border-[var(--border)] bg-[var(--navy)] text-white lg:block print:hidden">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#0f766e]">
            <ShipWheel className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">Elmaghraby Tracing</div>
            <div className="text-xs text-white/70">تتبع الشحنات والاستيراد</div>
          </div>
        </div>
        <nav className="space-y-1 p-4 pb-24">{navList}</nav>
        <div className="absolute bottom-4 right-4 left-4 space-y-2">
          <p className="text-center text-[10px] text-white/50">Powered by {APP_CREDIT_NAME}</p>
          {!loading && role ? (
            <div className="rounded-md bg-white/10 px-3 py-2 text-xs text-white/80">
              الدور: {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="lg:mr-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur lg:px-8 print:hidden dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="btn btn-secondary shrink-0 px-2 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] sm:flex">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="truncate">نظام عربي RTL</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role && !canWrite ? (
              <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 sm:inline">
                مشاهدة فقط
              </span>
            ) : null}
            <Link className="btn btn-secondary text-sm lg:hidden" href="/shipments">
              الشحنات
            </Link>
            <button className="btn btn-secondary flex items-center gap-2 text-sm" onClick={signOut} type="button">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 pb-24 lg:p-8 lg:pb-8">{children}</main>
        <footer className="mx-auto max-w-7xl border-t border-[var(--border)] px-4 py-3 text-center text-xs text-[var(--muted)] print:hidden lg:mr-72">
          Powered by <span className="font-semibold text-[var(--foreground)]">{APP_CREDIT_NAME}</span>
        </footer>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="ms-auto flex h-full w-80 max-w-[86vw] flex-col bg-[#123c5a] p-4 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="font-bold">Elmaghraby Tracing</div>
              <button
                className="btn btn-secondary px-2"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
                aria-label="إغلاق القائمة"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">{navList}</nav>
          </aside>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 px-1 py-2 shadow-[0_-8px_24px_rgb(15_23_42_/_10%)] backdrop-blur lg:hidden safe-area-pb print:hidden">
        <div className="grid grid-cols-6 gap-1">
          {mobileNavItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-semibold leading-tight ${
                  active ? "bg-[#123c5a] text-white" : "text-slate-600"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-full truncate text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
