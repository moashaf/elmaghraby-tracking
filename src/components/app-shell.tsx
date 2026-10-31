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
  if (href === "/shipments" && pathname.startsWith("/shipments/new")) return false;
  if (href === "/purchase-orders" && pathname.startsWith("/purchase-orders/new")) return false;
  if (href === "/products" && pathname.startsWith("/products/search")) return false;
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

  function navLink(item: NavItem, compact = false) {
    const Icon = item.icon;
    const active = isNavActive(pathname, item.href);
    if (compact) {
      return (
        <Link
          className={`top-nav-item ${active ? "top-nav-item-active" : ""}`}
          href={item.href}
          key={`${item.href}-${item.labelKey}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <Icon className="h-5 w-5" />
          <span className="max-w-[4.8rem] truncate text-[11px] font-semibold leading-tight">{t(item.labelKey)}</span>
        </Link>
      );
    }

    return (
      <Link
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
          active ? "bg-[var(--primary)] text-white shadow-sm" : "text-stone-700 hover:bg-stone-100"
        }`}
        href={item.href}
        key={`${item.href}-${item.labelKey}`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <Icon className="h-4 w-4" />
        {t(item.labelKey)}
      </Link>
    );
  }

  const toolbar = (
    <div className="hidden items-center gap-2 min-[900px]:flex">
      {groupedNav.map((group, index) => (
        <div className="flex items-center" key={group.section}>
          {index > 0 ? <div className="mx-1 h-9 w-px bg-stone-200" /> : null}
          {group.items.map((item) => navLink(item, true))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <AppWaveBackground />
      <header className="sticky top-0 z-30 print:hidden">
        <div className="flex h-14 items-center justify-between gap-3 bg-[var(--primary)] px-3 text-white min-[900px]:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 min-[900px]:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
              aria-label={ui("فتح القائمة")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link className="flex min-w-0 items-center gap-2.5" href="/">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
                <ShipWheel className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">{t("app.name")}</span>
                <span className="hidden truncate text-[11px] text-white/80 sm:block">{pageTitle}</span>
              </span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!loading && role ? (
              <span className="hidden rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white sm:inline">
                {getRoleLabel(role as UserRole, lang)}
              </span>
            ) : null}
            {role && !canWrite ? (
              <span className="hidden rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold sm:inline">
                {t("role.viewer")}
              </span>
            ) : null}
            <label className="sr-only" htmlFor="app-language">
              {ui("تغيير اللغة")}
            </label>
            <select
              className="h-9 max-w-[7.5rem] cursor-pointer appearance-none rounded-lg border border-white/20 bg-white/10 px-2 pe-7 text-sm font-semibold text-white"
              id="app-language"
              onChange={(event) => setLanguage(event.target.value as typeof lang)}
              title={ui("تغيير اللغة")}
              value={lang}
            >
              <option className="text-stone-900" value="ar">
                {t("lang.ar")}
              </option>
              <option className="text-stone-900" value="en">
                {t("lang.en")}
              </option>
              <option className="text-stone-900" value="zh">
                {t("lang.zh")}
              </option>
            </select>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold"
              onClick={signOut}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("auth.signOut")}</span>
            </button>
          </div>
        </div>
        <div className="app-shell-header hidden border-b min-[900px]:block">
          <div className="mx-auto flex max-w-[92rem] items-center overflow-x-auto px-3 py-1.5 min-[900px]:px-6">
            {toolbar}
          </div>
        </div>
      </header>

      <main className="app-main-content mx-auto max-w-7xl p-4 pb-24 min-[900px]:p-8 min-[900px]:pb-8">{children}</main>
      <footer className="app-shell-footer mx-auto max-w-7xl border-t px-4 py-3 text-center text-xs text-[var(--muted)] print:hidden">
        Powered by <span className="font-semibold text-[var(--foreground)]">{APP_CREDIT_NAME}</span>
      </footer>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-stone-950/40 min-[900px]:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="ms-auto flex h-full w-80 max-w-[86vw] flex-col bg-white p-4 text-[var(--foreground)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--primary)] text-white">
                  <ShipWheel className="h-4 w-4" />
                </span>
                {t("app.name")}
              </div>
              <button
                className="btn btn-secondary px-2"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
                aria-label={ui("إغلاق القائمة")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {groupedNav.map((group) => (
                <div key={group.section}>
                  <div className="nav-section-label">
                    {tr(
                      SECTION_LABELS[group.section].ar,
                      SECTION_LABELS[group.section].en,
                      SECTION_LABELS[group.section].zh
                    )}
                  </div>
                  {group.items.map((item) => navLink(item))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <nav className="app-shell-header fixed inset-x-0 bottom-0 z-30 border-t px-1 py-2 shadow-[0_-8px_24px_rgb(28_25_23_/_8%)] min-[900px]:hidden safe-area-pb print:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold leading-tight ${
                  active ? "bg-[var(--primary)] text-white shadow-sm" : "text-stone-600"
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
