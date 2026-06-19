"use client";

import { cn } from "@/lib/cn";
import { useEffect } from "react";
import { CloseIcon } from "../icons";

/**
 * A mobile bottom sheet: slides up from the bottom, dims the page, traps scroll,
 * dismisses on backdrop tap or Escape. Used for session details and onboarding.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ animation: "fade-in 0.2s ease both" }}
      />
      <div
        // biome-ignore lint/a11y/useSemanticElements: custom animated bottom-sheet; native <dialog> top-layer conflicts with the slide-up + scrim design
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col",
          "rounded-t-[28px] border-t border-line bg-surface",
        )}
        style={{ animation: "sheet-up 0.32s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
        </div>
        {title && (
          <div className="flex items-start justify-between gap-3 px-5 pb-3">
            <div className="min-w-0 flex-1">{title}</div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition active:scale-90"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">{children}</div>
        {footer && (
          <div className="border-t border-line-soft px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
