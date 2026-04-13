"use client";

// Tiny inline sparkline for metric cards. Intentionally dependency-free
// (no recharts container overhead for a 40px tall element) — just plots
// a normalized polyline + gradient area fill into a fixed-viewbox SVG.
export function MetricSparkline({
  data,
  positive = true,
  height = 36,
  color: colorOverride,
}: {
  data: number[];
  positive?: boolean;
  height?: number;
  // Explicit color override. When passed (e.g. `var(--color-youtube)`),
  // the sparkline ignores the positive/danger split and uses this color
  // for both the line and the gradient. Used by tinted metric cards so
  // the YouTube row stays red even on a declining metric — color encodes
  // platform identity there, not trend direction.
  color?: string;
}) {
  if (data.length < 2) {
    return <div style={{ height }} />;
  }
  const W = 120;
  const H = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const color =
    colorOverride ?? (positive ? "var(--color-accent)" : "var(--color-danger)");
  // Stable gradient ID so multiple sparklines on the page don't collide.
  // Uses the first + last value as a light fingerprint — good enough at
  // this density, and avoids calling useId (which would force a client
  // boundary around the parent chain). Tinted sparklines get a distinct
  // prefix so the fingerprint doesn't collide across color groups.
  const prefix = colorOverride ? "t" : positive ? "p" : "n";
  const gradId = `spark-${prefix}-${(data[0] ?? 0).toString(36)}-${(data[data.length - 1] ?? 0).toString(36)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="block"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
