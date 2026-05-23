"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "اختر...",
  required,
  disabled,
  className = "",
  emptyMessage = "لا توجد نتائج",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, term]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        className="input flex items-center justify-between gap-2 text-right"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={selected ? "" : "text-[var(--muted)]"}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {required ? (
        <input
          className="pointer-events-none absolute inset-0 opacity-0"
          required
          tabIndex={-1}
          value={value}
          onChange={() => undefined}
        />
      ) : null}

      {open ? (
        <div
          className="absolute z-50 mt-1 max-h-72 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg"
          id={listId}
        >
          <div className="border-b border-[var(--border)] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[var(--muted)]" />
              <input
                autoFocus
                className="input pr-8 text-sm"
                placeholder="بحث..."
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {filtered.length ? (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    className={`w-full px-3 py-2 text-right hover:bg-slate-100 ${
                      option.value === value ? "bg-teal-50 font-semibold text-[var(--primary)]" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setTerm("");
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-[var(--muted)]">{emptyMessage}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
