"use client";

import { useEffect, useRef } from "react";

/**
 * Pointer drag-to-scroll for horizontal rails. Touch/trackpad already scroll
 * natively; this adds click-and-drag for mouse users (desktop) so the "Later
 * today" rail and quick chips can be swiped with a pointer too. Returns a ref to
 * attach to the scrollable element.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let down = false;
    let startX = 0;
    let startLeft = 0;
    let moved = false;

    const onPointerDown = (e: PointerEvent) => {
      // Only primary mouse button; let touch/pen use native scrolling.
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };

    const end = () => {
      down = false;
    };

    // Suppress the click that follows a drag so cards/links don't fire.
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
}
