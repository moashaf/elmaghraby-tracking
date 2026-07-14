"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof Home;
  writeOnly?: boolean;
  adminOnly?: boolean;
  section?: "ops" | "catalog" | "reports" | "admin";
};

const staffNavItems: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: Home, section: "ops" },
  { href: "/shipments", labelKey: "nav.shipments", icon: Boxes, section: "ops" },
  { href: "/shipments/new", labelKey: "nav.newShipment", icon: Plus, writeOnly: true, section: "ops" },
  { href: "/purchase-orders", labelKey: "nav.purchaseOrders", icon: ClipboardList, section: "ops" },
  { href: "/purchase-orders/new", labelKey: "nav.newPurchaseOrder", icon: Plus, writeOnly: true, section: "ops" },
  { href: "/shipping-routes", labelKey: "nav.routes", icon: Route, writeOnly: true, section: "ops" },
  { href: "/categories", labelKey: "nav.categories", icon: Tags, writeOnly: true, section: "catalog" },
  { href: "/products", labelKey: "nav.products", icon: Package, section: "catalog" },
  { href: "/products/search", labelKey: "nav.productsSearch", icon: Search, section: "catalog" },
  { href: "/suppliers", labelKey: "nav.suppliers", icon: Users, writeOnly: true, section: "catalog" },
  { href: "/companies", labelKey: "nav.companies", icon: Building2, writeOnly: true, section: "catalog" },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, section: "reports" },
  { href: "/users", labelKey: "nav.users", icon: UserCog, adminOnly: true, section: "admin" },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, section: "admin" },
];

const supplierNavItems: NavItem[] = [
  { href: "/supplier", labelKey: "nav.supplierPortal", icon: Home, section: "ops" },
  { href: "/supplier/purchase-orders", labelKey: "nav.purchaseOrders", icon: ClipboardList, section: "ops" },
  { href: "/supplier/awaiting-receipt", labelKey: "nav.awaitingReceipt", icon: ClipboardList, section: "ops" },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, section: "admin" },
];

const SECTION_ORDER = ["ops", "catalog", "reports", "admin"] as const;

const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], { ar: string; en: string; zh: string }> = {
  ops: { ar: "تشغيل", en: "Operations", zh: "运营" },
  catalog: { ar: "كتالوج", en: "Catalog", zh: "目录" },
  reports: { ar: "تقارير", en: "Reports", zh: "报告" },
  admin: { ar: "إدارة", en: "Admin", zh: "管理" },
};

const TITLE_BY_PREFIX: Array<{ match: (path: string) => boolean; labelKey: string }> = [
  { match: (p) => p === "/", labelKey: "nav.dashboard" },
  { match: (p) => p.startsWith("/shipments/new"), labelKey: "nav.newShipment" },
  { match: (p) => p.startsWith("/shipments"), labelKey: "nav.shipments" },
  { match: (p) => p.startsWith("/purchase-orders/new"), labelKey: "nav.newPurchaseOrder" },
  { match: (p) => p.startsWith("/purchase-orders"), labelKey: "nav.purchaseOrders" },
  { match: (p) => p.startsWith("/products/search"), labelKey: "nav.productsSearch" },
  { match: (p) => p.startsWith("/products"), labelKey: "nav.products" },
  { match: (p) => p.startsWith("/categories"), labelKey: "nav.categories" },
  { match: (p) => p.startsWith("/suppliers"), labelKey: "nav.suppliers" },
  { match: (p) => p.startsWith("/companies"), labelKey: "nav.companies" },
  { match: (p) => p.startsWith("/shipping-routes"), labelKey: "nav.routes" },
  { match: (p) => p.startsWith("/reports"), labelKey: "nav.reports" },
  { match: (p) => p.startsWith("/users"), labelKey: "nav.users" },
  { match: (p) => p.startsWith("/settings"), labelKey: "nav.settings" },
  { match: (p) => p.startsWith("/supplier"), labelKey: "nav.supplierPortal" },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/supplier") return pathname === "/supplier";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const { role, canWrite, loading, isSupplier, isAdmin } = useProfile();
  const { t, setLanguage, lang, ui, tr } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo(() => {
    if (isSupplier) return supplierNavItems;
    if (isAdmin) {
      return [
        ...staffNavItems,
        {
          href: "/supplier/purchase-orders",
          labelKey: "nav.supplierPortal",
          icon: ClipboardList,
          section: "ops" as const,
        },
      ];
    }
    return staffNavItems;
  }, [isAdmin, isSupplier]);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.adminOnly && role !== "admin") return false;
        if (item.writeOnly && !canWrite) return false;
        return true;
      }),
    [navItems, role, canWrite]
  );

  const groupedNav = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      section,
      items: visibleNavItems.filter((item) => (item.section ?? "ops") === section),
    })).filter((group) => group.items.length > 0);
  }, [visibleNavItems]);

  const mobileNavItems = useMemo(() => {
    if (isSupplier) return visibleNavItems.slice(0, 5);
    const preferred = ["/", "/shipments", "/purchase-orders", "/reports", "/settings"];
    return preferred
      .map((href) => visibleNavItems.find((item) => item.href === href))
      .filter(Boolean) as NavItem[];
  }, [isSupplier, visibleNavItems]);

  const pageTitle = useMemo(() => {
    const hit = TITLE_BY_PREFIX.find((entry) => entry.match(pathname));
    return hit ? t(hit.labelKey) : t("app.name");
  }, [pathname, t]);

  async function signOut() {
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
    }
    router.push("/login");
  }

  if (isLogin) return <>{children}</>;

  const navList = (
    <>
      {groupedNav.map((group) => (
        <div key={group.section}>
          <div className="nav-section-label">
            {tr(
              SECTION_LABELS[group.section].ar,
              SECTION_LABELS[group.section].en,
              SECTION_LABELS[group.section].zh
            )}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-[var(--primary)] text-white shadow-sm" : "text-white/78 hover:bg-white/10"
                }`}
                href={item.href}
                key={`${item.href}-${item.labelKey}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <AppWaveBackground />
      <aside className="fixed right-0 top-0 z-10 hidden h-screen w-72 border-l border-white/10 bg-gradient-to-b from-[var(--navy)] to-[#071f31] text-white shadow-[inset_1px_0_0_rgb(255_255_255_/_6%)] lg:block print:hidden">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--primary)]">
            <ShipWheel className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">{t("app.name")}</div>
            <div className="text-xs text-white/70">{t("app.tagline")}</div>
          </div>
        </div>
        <nav className="space-y-1 overflow-y-auto p-3 pb-28">{navList}</nav>
        <div className="absolute bottom-4 right-4 left-4 space-y-2">
          <p className="text-center text-[10px] text-white/50">Powered by {APP_CREDIT_NAME}</p>
          {!loading && role ? (
            <div className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/85">
              {ui("الدور:")} {getRoleLabel(role as UserRole, lang)}
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
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[var(--navy)] dark:text-[var(--foreground)]">
                {pageTitle}
              </div>
              <div className="hidden text-xs text-[var(--muted)] sm:block">{t("app.tagline")}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role && !canWrite ? (
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline dark:bg-slate-800 dark:text-slate-300">
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
        <footer className="app-shell-footer mx-auto max-w-7xl border-t px-4 py-3 text-center text-xs text-[var(--muted)] print:hidden">
          Powered by <span className="font-semibold text-[var(--foreground)]">{APP_CREDIT_NAME}</span>
        </footer>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="ms-auto flex h-full w-80 max-w-[86vw] flex-col bg-[var(--navy)] p-4 text-white shadow-2xl"
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
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold leading-tight ${
                  active ? "bg-[var(--primary)] text-white shadow-sm" : "text-slate-600"
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
