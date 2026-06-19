"use client";

import { clientNow, clockSeed } from "@/lib/now";
import { useEffect, useState } from "react";

/**
 * A ticking "now" for live countdowns, driven by the demo clock so it agrees
 * with the server AND keeps running across page refreshes.
 *
 * SSR-safety: the first render uses {@link clockSeed} (the un-advanced demo
 * start, no localStorage) so server and client hydrate identically. Right after
 * mount we switch to {@link clientNow} (the anchored, real-elapsed-advanced
 * value) and tick from there — so a refresh resumes the countdown instead of
 * resetting it.
 */
export function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => clockSeed());

  useEffect(() => {
    // Jump to the anchored running time immediately post-mount, then tick.
    setNow(clientNow());
    const id = setInterval(() => setNow(clientNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
