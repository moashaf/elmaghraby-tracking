"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
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
import { useLanguage } from "@/context/language-context";
import { APP_CREDIT_NAME } from "@/lib/constants";
import { getRoleLabel } from "@/lib/i18n";
import type { UserRole } from "@/lib/permissions";
import { AppWaveBackground } from "@/components/decor/app-wave-background";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const staffNavItems = [
  { href: "/", labelKey: "nav.dashboard", icon: Home },
  { href: "/shipments", labelKey: "nav.shipments", icon: Boxes },
  { href: "/shipments/new", labelKey: "nav.newShipment", icon: Plus, writeOnly: true },
  { href: "/purchase-orders", labelKey: "nav.purchaseOrders", icon: ClipboardList },
  { href: "/purchase-orders/new", labelKey: "nav.newPurchaseOrder", icon: Plus, writeOnly: true },
  { href: "/categories", labelKey: "nav.categories", icon: Tags, writeOnly: true },
  { href: "/products", labelKey: "nav.products", icon: Package },
  { href: "/products/search", labelKey: "nav.productsSearch", icon: Search },
  { href: "/suppliers", labelKey: "nav.suppliers", icon: Users, writeOnly: true },
  { href: "/companies", labelKey: "nav.companies", icon: Building2, writeOnly: true },
  { href: "/shipping-routes", labelKey: "nav.routes", icon: Route, writeOnly: true },
  { href: "/reports", labelKey: "nav.reports", icon: FileText },
  { href: "/users", labelKey: "nav.users", icon: UserCog, adminOnly: true },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const supplierNavItems = [
  { href: "/supplier", labelKey: "nav.supplierPortal", icon: Home },
  { href: "/supplier/purchase-orders", labelKey: "nav.purchaseOrders", icon: ClipboardList },
  { href: "/supplier/awaiting-receipt", labelKey: "nav.awaitingReceipt", icon: ClipboardList },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const { role, canWrite, loading, isSupplier, isAdmin } = useProfile();
  const { t, setLanguage, lang, ui } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo(() => {
    if (isSupplier) return supplierNavItems;
    if (isAdmin) {
      return [
        ...staffNavItems,
        { href: "/supplier/purchase-orders", labelKey: "nav.supplierPortal", icon: ClipboardList },
      ];
    }
    return staffNavItems;
  }, [isAdmin, isSupplier]);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if ("adminOnly" in item && item.adminOnly && role !== "admin") return false;
        if ("writeOnly" in item && item.writeOnly && !canWrite) return false;
        return true;
      }),
    [navItems, role, canWrite]
  );

  const mobileNavItems = isSupplier
    ? visibleNavItems
    : visibleNavItems.filter((item) =>
        ["/", "/shipments", "/purchase-orders", "/products/search", "/reports", "/settings"].includes(item.href)
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
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-[#0f766e] text-white shadow-sm" : "text-white/78 hover:bg-white/10"
            }`}
            href={item.href}
            key={item.href}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <AppWaveBackground />
      <aside className="fixed right-0 top-0 z-10 hidden h-screen w-72 border-l border-white/10 bg-gradient-to-b from-[#123c5a] to-[#0c3149] text-white shadow-[inset_1px_0_0_rgb(255_255_255_/_6%)] lg:block print:hidden">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#0f766e]">
            <ShipWheel className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">{t("app.name")}</div>
            <div className="text-xs text-white/70">{t("app.tagline")}</div>
          </div>
        </div>
        <nav className="space-y-1 p-4 pb-24">{navList}</nav>
        <div className="absolute bottom-4 right-4 left-4 space-y-2">
          <p className="text-center text-[10px] text-white/50">Powered by {APP_CREDIT_NAME}</p>
          {!loading && role ? (
            <div className="rounded-md bg-white/10 px-3 py-2 text-xs text-white/80">
              {ui("الدور:")} {role ? getRoleLabel(role as UserRole, lang) : role}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="lg:mr-72 print:mr-0">
        <header className="app-shell-header sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 lg:px-8 print:hidden dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="btn btn-secondary shrink-0 px-2 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
              aria-label={ui("فتح القائمة")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] sm:flex">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("app.rtlBadge")}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role && !canWrite ? (
              <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 sm:inline">
                {t("role.viewer")}
              </span>
            ) : null}
            <label className="sr-only" htmlFor="app-language">
              {ui("تغيير اللغة")}
            </label>
            <select
              className="btn btn-secondary max-w-[7.5rem] cursor-pointer appearance-none truncate pe-7 text-sm"
              id="app-language"
              onChange={(event) => setLanguage(event.target.value as typeof lang)}
              title={ui("تغيير اللغة")}
              value={lang}
            >
              <option value="ar">{t("lang.ar")}</option>
              <option value="en">{t("lang.en")}</option>
              <option value="zh">{t("lang.zh")}</option>
            </select>
            <button className="btn btn-secondary flex items-center gap-2 text-sm" onClick={signOut} type="button">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("auth.signOut")}</span>
            </button>
          </div>
        </header>
        <main className="app-main-content mx-auto max-w-7xl p-4 pb-24 lg:p-8 lg:pb-8">{children}</main>
        <footer className="app-shell-footer mx-auto max-w-7xl border-t px-4 py-3 text-center text-xs text-[var(--muted)] print:hidden lg:mr-72">
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
              <div className="font-bold">{t("app.name")}</div>
              <button
                className="btn btn-secondary px-2"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
                aria-label={ui("إغلاق القائمة")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">{navList}</nav>
          </aside>
        </div>
      ) : null}

      <nav className="app-shell-header fixed inset-x-0 bottom-0 z-30 border-t px-1 py-2 shadow-[0_-8px_24px_rgb(15_23_42_/_8%)] lg:hidden safe-area-pb print:hidden">
        <div className="grid grid-cols-6 gap-1">
          {mobileNavItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold leading-tight ${
                  active ? "bg-[#0f766e] text-white shadow-sm" : "text-slate-600"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-full truncate text-center">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
