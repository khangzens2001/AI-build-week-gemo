"use client";

import { useEffect, useState } from "react";

/**
 * Pixels the on-screen keyboard currently covers at the bottom of the layout
 * viewport. Driven by `window.visualViewport` — the only reliable signal on iOS
 * Safari / standalone PWAs, where the layout viewport does NOT shrink for the
 * keyboard (unlike Android Chrome, which already resizes via
 * `interactive-widget=resizes-content`). On Android this returns ≈0, so applying
 * it as a translate causes no double-shift.
 *
 * Usage: translate the pinned composer up by this inset so it rides above the
 * keyboard: `style={{ transform: \`translateY(-${inset}px)\` }}`.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // Gap between the layout-viewport bottom and the visual-viewport bottom.
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
