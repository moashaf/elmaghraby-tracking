"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function AppModal({
  children,
  onBackdropClick,
}: {
  children: ReactNode;
  onBackdropClick?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/40 p-3 pb-[max(5.5rem,env(safe-area-inset-bottom))] min-[900px]:pb-4"
      onClick={onBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}
