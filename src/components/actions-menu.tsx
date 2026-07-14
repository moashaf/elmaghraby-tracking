"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

type ActionsMenuProps = {
  children: ReactNode;
  label?: string;
};

export function ActionsMenu({ children, label = "إجراءات" }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const padding = 8;
    const isRtl = document.documentElement.dir === "rtl";

    let left = isRtl ? rect.right - menuWidth : rect.left;
    left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));

    const estimatedHeight = menuRef.current?.offsetHeight || 220;
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - padding) {
      top = Math.max(padding, rect.top - estimatedHeight - 6);
    }

    setCoords({ top, left });
  }

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={label}
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setOpen((current) => !current);
          queueMicrotask(updatePosition);
        }}
        ref={buttonRef}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed z-[80] min-w-[180px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="flex flex-col gap-0.5" onClick={() => setOpen(false)}>
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
