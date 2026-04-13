"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/queries";

type MetricKey = "views" | "likes" | "comments" | "shares";

const METRIC_COLORS: Record<MetricKey, string> = {
  views: "oklch(0.72 0.18 150)",
  likes: "oklch(0.78 0.16 25)",
  comments: "oklch(0.78 0.16 260)",
  shares: "oklch(0.80 0.14 90)",
};

export function TimeSeriesChart({ data }: { data: TimeSeriesPoint[] }) {
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    views: true,
    likes: true,
    comments: false,
    shares: false,
  });

  // Collapse multiple sources per day into one row by taking the max
  // (API/CSV may disagree slightly; use the larger value).
  const chartData = useMemo(() => {
    const byDate = new Map<
      string,
      { date: string; views: number; likes: number; comments: number; shares: number }
    >();
    for (const p of data) {
      const existing = byDate.get(p.snapshot_date) ?? {
        date: p.snapshot_date,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
      existing.views = Math.max(existing.views, p.views ?? 0);
      existing.likes = Math.max(existing.likes, p.likes ?? 0);
      existing.comments = Math.max(existing.comments, p.comments ?? 0);
      existing.shares = Math.max(existing.shares, p.shares ?? 0);
      byDate.set(p.snapshot_date, existing);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="text-sm text-[var(--color-muted)] text-center py-12">
        No time-series data yet. Re-run the fetch scripts on different days to
        build a trend.
      </div>
    );
  }

  if (chartData.length === 1) {
    const p = chartData[0]!;
    return (
      <div className="text-sm text-[var(--color-muted)] text-center py-12">
        Only one snapshot ({p.date}) — the chart needs at least two days of
        data. Run <code className="text-[var(--color-fg)]">pnpm fetch:youtube</code>{" "}
        or <code className="text-[var(--color-fg)]">pnpm fetch:tiktok</code>{" "}
        again tomorrow.
      </div>
    );
  }

  const metrics: MetricKey[] = ["views", "likes", "comments", "shares"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() =>
              setVisible((v) => ({ ...v, [m]: !v[m] }))
            }
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              visible[m]
                ? "border-transparent"
                : "opacity-40 border-[var(--color-border)]"
            }`}
            style={
              visible[m]
                ? {
                    backgroundColor: `color-mix(in oklch, ${METRIC_COLORS[m]} 15%, transparent)`,
                    color: METRIC_COLORS[m],
                    borderColor: METRIC_COLORS[m],
                  }
                : undefined
            }
          >
            {m}
          </button>
        ))}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="oklch(0.28 0.014 260)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="oklch(0.68 0.02 260)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.68 0.02 260)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(v as number)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.19 0.014 260)",
                border: "1px solid oklch(0.28 0.014 260)",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: "oklch(0.97 0.005 260)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
            />
            {metrics
              .filter((m) => visible[m])
              .map((m) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={METRIC_COLORS[m]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
