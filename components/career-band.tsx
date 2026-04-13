"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CareerPoint } from "@/lib/queries";
import { fmtCompact } from "./format";
import { Odometer } from "./odometer";

// The hero band on Overview. Full-width stacked area showing cumulative
// career views split YT vs TT, with a huge total number on the left and
// the 30-day delta on the right. This is the first thing the eye lands on
// when the page loads — size, color, and scale are all tuned for that.
export function CareerBand({ points }: { points: CareerPoint[] }) {
  const last = points[points.length - 1];
  const total = last ? last.youtube + last.tiktok : 0;

  // Find the cumulative total ~30 days ago to compute the delta. We walk
  // backwards from the end until we hit a point that's at least 30 days
  // older than the last point (or we fall off the start of the series).
  const delta = useMemo(() => {
    if (!last) return { abs: 0, pct: 0, windowDays: 0 };
    const lastTs = new Date(last.date).getTime();
    const cutoff = lastTs - 30 * 86_400_000;
    let past = points[0];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (!p) continue;
      if (new Date(p.date).getTime() <= cutoff) {
        past = p;
        break;
      }
    }
    if (!past) return { abs: 0, pct: 0, windowDays: 0 };
    const pastTotal = past.youtube + past.tiktok;
    const abs = total - pastTotal;
    const pct = pastTotal > 0 ? (100 * abs) / pastTotal : 0;
    const windowDays = Math.min(
      30,
      Math.round((lastTs - new Date(past.date).getTime()) / 86_400_000),
    );
    return { abs, pct, windowDays };
  }, [points, last, total]);

  if (points.length === 0) {
    return null;
  }

  const ytShare = total > 0 && last ? last.youtube / total : 0;
  const ttShare = total > 0 && last ? last.tiktok / total : 0;

  return (
    <div className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
      {/* The chart sits behind everything as a low-contrast backdrop. */}
      <div className="absolute inset-0 opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="yt-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-youtube)"
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-youtube)"
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient id="tt-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-tiktok)"
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-tiktok)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              cursor={{
                stroke: "var(--color-accent)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              contentStyle={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-muted)" }}
              formatter={(value: number, name: string) => [
                fmtCompact(value),
                name === "youtube" ? "YouTube" : "TikTok",
              ]}
            />
            <Area
              type="monotone"
              dataKey="tiktok"
              stackId="1"
              stroke="var(--color-tiktok)"
              strokeWidth={1.5}
              fill="url(#tt-fill)"
            />
            <Area
              type="monotone"
              dataKey="youtube"
              stackId="1"
              stroke="var(--color-youtube)"
              strokeWidth={1.5}
              fill="url(#yt-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Foreground: big number + label stack on the left, delta chip on
          the right. Flex column so it reflows on narrow widths. */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-6 min-h-[168px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1">
            Career views
          </div>
          <div className="text-5xl font-semibold tabular tracking-tight">
            <Odometer value={total} format="compact" />
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "var(--color-youtube)" }}
              />
              YouTube {fmtCompact(last?.youtube ?? 0)} ·{" "}
              {(ytShare * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: "var(--color-tiktok)" }}
              />
              TikTok {fmtCompact(last?.tiktok ?? 0)} ·{" "}
              {(ttShare * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="md:text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1">
            Last {delta.windowDays || 30} days
          </div>
          <div
            className={`text-2xl font-semibold tabular ${
              delta.abs >= 0
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {delta.abs >= 0 ? "+" : ""}
            {fmtCompact(delta.abs)}
          </div>
          <div className="text-xs text-[var(--color-muted)] tabular mt-0.5">
            {delta.pct >= 0 ? "↑" : "↓"} {Math.abs(delta.pct).toFixed(1)}% vs
            prior
          </div>
        </div>
      </div>
    </div>
  );
}
