"use client";

import { useEffect, useRef, useState } from "react";
import { fmtCompact, fmtNum, fmtPct } from "./format";

type OdometerFormat = "num" | "compact" | "pct";

// A simple number "odometer" — counts up from 0 to `value` over `durationMs`
// using an eased-out cubic. Purely cosmetic: shows the final value
// server-side (no hydration mismatch) then animates on mount. Reduced-motion
// users skip the animation entirely.
export function Odometer({
  value,
  format = "num",
  durationMs = 800,
}: {
  value: number;
  format?: OdometerFormat;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState<number>(value);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) {
      // On subsequent value changes we snap (no need to replay the intro).
      setDisplay(value);
      return;
    }
    mountedRef.current = true;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const to = value;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
      }
    };
    setDisplay(0);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <>{formatOdometer(display, format)}</>;
}

function formatOdometer(n: number, format: OdometerFormat): string {
  switch (format) {
    case "compact":
      return fmtCompact(Math.round(n));
    case "pct":
      return fmtPct(n);
    case "num":
    default:
      return fmtNum(Math.round(n));
  }
}
