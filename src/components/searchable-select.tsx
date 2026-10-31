"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  onAdvance?: () => void;
};

export const SearchableSelect = forwardRef<HTMLButtonElement, Props>(function SearchableSelect(
  {
    options,
    value,
    onChange,
    placeholder = "اختر...",
    required,
    disabled,
    className = "",
    emptyMessage = "لا توجد نتائج",
    onAdvance,
  },
  ref
) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

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

  useEffect(() => {
    if (!open) return;
    if (term.trim()) {
      setHighlighted(0);
      return;
    }
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    // Reset only when the list opens or the search text changes — not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, term]);

  useEffect(() => {
    if (!open) return;
    const el = rootRef.current?.querySelector(`[data-option-index="${highlighted}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function closeList() {
    setOpen(false);
    setTerm("");
  }

  function advance() {
    closeList();
    onAdvance?.();
  }

  function choose(option: SearchableOption | undefined) {
    if (!option) return;
    onChange(option.value);
    advance();
  }

  function moveHighlight(delta: number) {
    if (!filtered.length) return;
    setHighlighted((current) => {
      const next = current + delta;
      if (next < 0) return 0;
      if (next >= filtered.length) return filtered.length - 1;
      return next;
    });
  }

  function openList() {
    setOpen(true);
    queueMicrotask(() => searchRef.current?.focus());
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted] ?? filtered[0];
      choose(option);
    }
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="input flex items-center justify-between gap-2 text-right"
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            if (!open) {
              openList();
              return;
            }
            if (event.key === "Enter") {
              choose(filtered[highlighted] ?? filtered[0]);
            } else {
              moveHighlight(1);
            }
          }
        }}
        ref={buttonRef}
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
                ref={searchRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1 text-sm" role="listbox">
            {filtered.length ? (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    className={`w-full px-3 py-2 text-right hover:bg-slate-100 ${
                      index === highlighted ? "bg-red-50 font-semibold text-[var(--primary)]" : ""
                    }`}
                    data-option-index={index}
                    role="option"
                    aria-selected={index === highlighted}
                    tabIndex={-1}
                    type="button"
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(option)}
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
});
