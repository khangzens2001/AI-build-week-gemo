"use client";

import { useEffect, useState } from "react";

/**
 * A ticking "now" for live countdowns on the real wall clock.
 *
 * SSR-safety: the first render seeds with `Date.now()` in the useState
 * initializer; a post-mount effect then ticks it forward on an interval.
 */
export function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
