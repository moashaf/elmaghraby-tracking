import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Inbox } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)] dark:text-[var(--foreground)]">
          {title}
        </h1>
        <div className="page-title-accent" />
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Alias for clearer page-level naming in redesigned screens. */
export function PageHero(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <PageHeader {...props} />;
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "amber" | "danger";
  href?: string;
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "border-[rgb(15_118_110_/_24%)] bg-[rgb(15_118_110_/_8%)]"
      : tone === "amber"
        ? "border-[rgb(194_65_12_/_28%)] bg-[var(--amber-soft)]"
        : tone === "danger"
          ? "border-red-200 bg-red-50"
          : "";

  const inner = (
    <>
      <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--navy)] dark:text-[var(--foreground)]">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link
        className={`card anim-rise block p-4 transition hover:-translate-y-0.5 hover:border-[var(--primary)] ${toneClass} ${className}`}
        href={href}
      >
        {inner}
      </Link>
    );
  }

  return <div className={`card anim-rise p-4 ${toneClass} ${className}`}>{inner}</div>;
}

export function FilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  children,
  onClick,
  count,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      className={`filter-chip ${active ? "filter-chip-active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] font-bold tabular-nums dark:bg-white/10">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card px-6 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[rgb(15_118_110_/_12%)] text-[var(--primary)]">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--navy)] dark:text-[var(--foreground)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function StatusPill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`status-badge ${className}`}>{children}</span>;
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="meta-item-label">{label}</div>
      <div className="meta-item-value">{value}</div>
    </div>
  );
}
