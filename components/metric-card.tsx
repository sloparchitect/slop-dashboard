import type { ReactNode } from "react";
import { MetricSparkline } from "./metric-sparkline";
import { Odometer } from "./odometer";
import { fmtCompact } from "./format";

// Metric card props. When `series` is passed the card renders a 30-day
// delta + inline sparkline; when `value` (a pre-formatted string or number)
// is passed instead, it renders the old static layout. Both paths accept
// an optional icon and sub-label.
interface BaseProps {
  label: string;
  sub?: ReactNode;
  icon?: ReactNode;
  // Optional color override used by the per-platform metric rows. Pass a
  // CSS color string (e.g. `var(--color-youtube)`) to tint the label, the
  // delta text, and the sparkline. When set, the delta color no longer
  // flips to `--color-danger` on negative moves — color encodes platform
  // identity here, direction is carried by the ↑/↓ glyph and the sign.
  tint?: string;
}

interface SeriesProps extends BaseProps {
  // Array of running-total points; the last element is "now".
  series: number[];
  // Value to show in the big number slot. Defaults to the last series point.
  value?: number;
  format?: "num" | "compact";
  // If provided, overrides the computed delta label.
  deltaOverride?: ReactNode;
}

interface StaticProps extends BaseProps {
  value: ReactNode;
}

type Props = SeriesProps | StaticProps;

function isSeriesProps(p: Props): p is SeriesProps {
  return "series" in p && Array.isArray((p as SeriesProps).series);
}

export function MetricCard(props: Props) {
  const labelStyle = props.tint
    ? { color: props.tint, opacity: 0.85 }
    : undefined;

  if (!isSeriesProps(props)) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
        <div className="flex items-center justify-between mb-2">
          <div
            className={`text-[10px] uppercase tracking-wider ${
              props.tint ? "" : "text-[var(--color-muted)]"
            }`}
            style={labelStyle}
          >
            {props.label}
          </div>
          {props.icon ? (
            <div
              className={props.tint ? "" : "text-[var(--color-muted)]"}
              style={props.tint ? { color: props.tint } : undefined}
            >
              {props.icon}
            </div>
          ) : null}
        </div>
        <div className="text-3xl font-semibold tabular">{props.value}</div>
        {props.sub ? (
          <div className="mt-1 text-xs text-[var(--color-muted)]">
            {props.sub}
          </div>
        ) : null}
      </div>
    );
  }

  // Series mode: compute delta vs a point ~30 days back. We don't have
  // a real time axis here — each point represents one date with at least
  // one upload — so "30 days back" means "the point that was at least
  // floor(len/3) positions earlier," which works out to a useful baseline
  // for most real creator histories. If the series is short we just
  // compare to the first point.
  const series = props.series;
  const last = series[series.length - 1] ?? 0;
  const deltaIdx = Math.max(0, series.length - 1 - Math.floor(series.length / 3));
  const past = series[deltaIdx] ?? series[0] ?? 0;
  const delta = last - past;
  const deltaPct = past > 0 ? (100 * delta) / past : 0;
  const value = props.value ?? last;
  const positive = delta >= 0;

  const deltaColor = props.tint
    ? props.tint
    : positive
      ? "var(--color-accent)"
      : "var(--color-danger)";

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <div className="flex items-center justify-between mb-2">
        <div
          className={`text-[10px] uppercase tracking-wider ${
            props.tint ? "" : "text-[var(--color-muted)]"
          }`}
          style={labelStyle}
        >
          {props.label}
        </div>
        {props.icon ? (
          <div
            className={props.tint ? "" : "text-[var(--color-muted)]"}
            style={props.tint ? { color: props.tint } : undefined}
          >
            {props.icon}
          </div>
        ) : null}
      </div>
      <div className="text-3xl font-semibold tabular">
        <Odometer value={value} format={props.format ?? "compact"} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-xs tabular">
          {props.deltaOverride ?? (
            <span style={{ color: deltaColor }}>
              {positive ? "↑" : "↓"} {fmtCompact(Math.abs(delta))}
              <span className="text-[var(--color-muted)] ml-1">
                ({positive ? "+" : ""}
                {deltaPct.toFixed(1)}%)
              </span>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 max-w-[120px]">
          <MetricSparkline
            data={series}
            positive={positive}
            color={props.tint}
          />
        </div>
      </div>
      {props.sub ? (
        <div className="mt-1.5 text-[11px] text-[var(--color-muted)]">
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}
