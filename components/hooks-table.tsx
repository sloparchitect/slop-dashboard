"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HookRow, Platform } from "@/lib/queries";
import { extractHook } from "@/lib/hooks-util";
import { PlatformBadge } from "./platform-badge";
import {
  fmtCompact,
  fmtNum,
  fmtPct,
  fmtDate,
  engagementRate,
} from "./format";
import { ArrowDown, ArrowUp, Check, Copy, Search, Sparkles } from "lucide-react";

type SortKey =
  | "hook"
  | "platform"
  | "published_at"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagement";
type SortDir = "asc" | "desc";
type PlatformFilter = "all" | Platform;
type WindowSec = 3 | 5 | 10;

interface Enriched extends HookRow {
  _hook: string;
  _engagement: number | null;
  // 0..1 percentile rank of this row's views among all rows in the list
  // (higher = better). Used to color rows by how they performed relative
  // to the creator's own body of work.
  _percentile: number;
}

// Categorize a hook string into one of a few loose "opener archetypes."
// These are client-side heuristics, not NLP — the point is to surface
// patterns a creator can see at a glance and make a decision from.
function classifyHook(hook: string): string[] {
  const out: string[] = [];
  const lower = hook.toLowerCase().trim();
  if (!lower) return out;
  if (/^\s*(what|why|how|when|where|who|which|are|is|do|does|did|can|should|would|could)\b/i.test(lower) || lower.includes("?"))
    out.push("question");
  if (/^\s*[\$]?\d/.test(lower)) out.push("number");
  if (/\b(you|your|you're|youre|you've)\b/i.test(lower)) out.push("you");
  if (/\b(secret|nobody|everyone|never|always|actually|truth|stop|warning|mistake)\b/i.test(lower))
    out.push("pattern-break");
  return out;
}

const CATEGORY_META: Record<
  string,
  { label: string; description: string }
> = {
  question: { label: "Questions", description: "starts with a question word or ends with ?" },
  number: { label: "Numbers", description: "starts with a digit or dollar amount" },
  you: { label: "Direct address", description: 'uses "you" / "your"' },
  "pattern-break": { label: "Pattern breaks", description: '"nobody", "never", "secret"…' },
};

export function HooksTable({
  rows,
  isSelf = true,
  scopeLabel = "My Channel",
}: {
  rows: HookRow[];
  isSelf?: boolean;
  scopeLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [windowSec, setWindowSec] = useState<WindowSec>(3);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const enriched = useMemo<Enriched[]>(() => {
    const withHooks = rows.map((r) => ({
      ...r,
      _hook: extractHook(r.segments_json, windowSec),
      _engagement: engagementRate(r.likes, r.comments, r.shares, r.views),
    }));
    // Percentile rank by views across rows that have a views count.
    // Rows without views get percentile 0 so they don't mis-rank visually.
    const ranked = [...withHooks]
      .filter((r) => r.views != null)
      .sort((a, b) => (a.views ?? 0) - (b.views ?? 0));
    const rankMap = new Map<string, number>();
    ranked.forEach((r, i) => {
      rankMap.set(r.id, ranked.length > 1 ? i / (ranked.length - 1) : 1);
    });
    return withHooks.map((r) => ({
      ...r,
      _percentile: rankMap.get(r.id) ?? 0,
    }));
  }, [rows, windowSec]);

  // Compute per-category aggregates for the insight panel. We compare the
  // *median* views of each category against the overall median so one
  // mega-viral outlier doesn't distort the signal.
  const insights = useMemo(() => {
    const viewsByRow = enriched
      .filter((r) => r.views != null)
      .map((r) => r.views as number);
    if (viewsByRow.length === 0) return null;
    const baselineMedian = median(viewsByRow);

    const buckets = new Map<string, number[]>();
    for (const r of enriched) {
      if (r.views == null) continue;
      const cats = classifyHook(r._hook);
      for (const c of cats) {
        const arr = buckets.get(c) ?? [];
        arr.push(r.views);
        buckets.set(c, arr);
      }
    }
    const entries = Array.from(buckets.entries())
      .map(([key, views]) => {
        const med = median(views);
        const lift = baselineMedian > 0 ? med / baselineMedian : 0;
        return {
          key,
          count: views.length,
          medianViews: Math.round(med),
          lift,
        };
      })
      // Only show categories with a reasonable sample and non-trivial lift
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.lift - a.lift);

    return { baselineMedian: Math.round(baselineMedian), entries };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((r) => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (!q) return true;
      return r._hook.toLowerCase().includes(q);
    });
  }, [enriched, platform, query]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(
        key === "hook" || key === "platform" || key === "published_at"
          ? "asc"
          : "desc",
      );
    }
  }

  async function copyHook(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    } catch {
      // Clipboard API requires a secure context; silently no-op on failure
      // so the dashboard doesn't throw during screen recordings.
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-12 text-center text-sm text-[var(--color-muted)]">
        No transcripts available for this creator. Run{" "}
        <code className="px-1.5 py-0.5 rounded bg-[var(--color-border)]/40 text-[var(--color-fg)]">
          pnpm transcribe
        </code>{" "}
        to populate.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Insight panel — surfaces which hook archetypes over- and under-
          perform the creator's own median. This is the "screenshot this"
          piece of the page; it lives on top of the table on purpose. */}
      {insights && insights.entries.length > 0 && (
        <InsightPanel
          baselineMedian={insights.baselineMedian}
          entries={insights.entries}
          isSelf={isSelf}
          scopeLabel={scopeLabel}
        />
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] sm:min-w-[260px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hook text…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <SegmentedControl<WindowSec>
          options={[3, 5, 10]}
          value={windowSec}
          onChange={setWindowSec}
          format={(w) => `${w}s`}
          label="window"
        />
        <SegmentedControl<PlatformFilter>
          options={["all", "youtube", "tiktok"]}
          value={platform}
          onChange={setPlatform}
          format={(p) =>
            p === "all" ? "All" : p === "youtube" ? "YouTube" : "TikTok"
          }
        />
        <div className="text-xs text-[var(--color-muted)] tabular">
          {fmtNum(sorted.length)} / {fmtNum(rows.length)} hooks
        </div>
      </div>

      {/* table */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Th
                  label={`Hook (first ${windowSec}s)`}
                  k="hook"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
                <Th
                  label="Platform"
                  k="platform"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  className="hidden md:table-cell"
                />
                <Th
                  label="Published"
                  k="published_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  className="hidden lg:table-cell"
                />
                <Th
                  label="Views"
                  k="views"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Likes"
                  k="likes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                  className="hidden sm:table-cell"
                />
                <Th
                  label="Comm"
                  k="comments"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                  className="hidden lg:table-cell"
                />
                <Th
                  label="Shares"
                  k="shares"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                  className="hidden lg:table-cell"
                />
                <Th
                  label="Eng %"
                  k="engagement"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                  className="hidden sm:table-cell"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const tier = percentileTier(r._percentile, r.views);
                return (
                  <tr
                    key={r.id}
                    className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/20 transition-colors align-top"
                  >
                    <td className="px-4 py-3 max-w-[280px] sm:max-w-[400px] lg:max-w-[520px] relative">
                      <div className="flex items-start gap-2">
                        {/* Percentile tier strip — a tiny colored bar on the left edge */}
                        <span
                          className="mt-1 w-0.5 self-stretch rounded-full shrink-0"
                          style={{ background: tier.color }}
                          aria-hidden
                        />
                        <Link
                          href={`/videos/${encodeURIComponent(r.id)}`}
                          className="flex-1 block hover:text-[var(--color-accent)] transition-colors"
                        >
                          {r._hook ? (
                            <span
                              className="leading-snug"
                              style={{ color: tier.textColor }}
                            >
                              {r._hook}
                            </span>
                          ) : (
                            <span className="italic text-[var(--color-muted)]">
                              (no speech in first {windowSec}s)
                            </span>
                          )}
                          {r.title && (
                            <div className="mt-1 text-xs text-[var(--color-muted)] truncate">
                              {r.title}
                            </div>
                          )}
                        </Link>
                        {r._hook && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyHook(r.id, r._hook);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-opacity"
                            aria-label="Copy hook"
                            title="Copy hook"
                          >
                            {copiedId === r.id ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <PlatformBadge platform={r.platform} />
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                      {fmtDate(r.published_at)}
                    </td>
                    <td className="px-4 py-3 text-right tabular font-medium">
                      {fmtCompact(r.views)}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right tabular">
                      {fmtCompact(r.likes)}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right tabular">
                      {fmtCompact(r.comments)}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-right tabular">
                      {fmtCompact(r.shares)}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right tabular">
                      {fmtPct(r._engagement)}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No hooks match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({
  baselineMedian,
  entries,
  isSelf,
  scopeLabel,
}: {
  baselineMedian: number;
  entries: {
    key: string;
    count: number;
    medianViews: number;
    lift: number;
  }[];
  isSelf: boolean;
  scopeLabel: string;
}) {
  // Phrase the panel relative to who we're looking at. "You" for self,
  // the creator's display label for externals — so the sentence reads
  // naturally regardless of scope ("What opens crush for you" vs
  // "What opens crush for Jane Doe"). We split the title into
  // parts so the name can get an emphasized accent-colored treatment
  // and the rest of the sentence stays muted-weight.
  const medianLabel = isSelf ? "your median" : "their median";
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--color-accent)]" />
          <h2 className="text-sm font-semibold">
            What opens crush for{" "}
            {isSelf ? (
              "you"
            ) : (
              <span className="text-[var(--color-accent)] font-semibold border-b border-[var(--color-accent)]/40">
                {scopeLabel}
              </span>
            )}
          </h2>
        </div>
        <div className="text-xs text-[var(--color-muted)] tabular">
          {medianLabel}: {fmtCompact(baselineMedian)} views
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {entries.map((e) => {
          const meta = CATEGORY_META[e.key];
          if (!meta) return null;
          const positive = e.lift >= 1;
          const liftStr =
            e.lift >= 1
              ? `${e.lift.toFixed(1)}×`
              : `${(e.lift * 100).toFixed(0)}%`;
          return (
            <div
              key={e.key}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg)]">
                  {meta.label}
                </div>
                <div
                  className={`text-lg font-semibold tabular ${
                    positive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  {liftStr}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-muted)] leading-snug">
                {meta.description}
              </div>
              <div className="mt-2 text-[11px] text-[var(--color-muted)] tabular">
                {e.count} videos · median {fmtCompact(e.medianViews)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  format,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1">
        {options.map((o) => (
          <button
            key={String(o)}
            onClick={() => onChange(o)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              value === o
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/40"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  right = false,
  className = "",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  right?: boolean;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th
      className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"} ${className}`}
    >
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active
            ? "text-[var(--color-fg)]"
            : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        } transition-colors`}
      >
        {label}
        {active &&
          (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
}

function getSortValue(r: Enriched, key: SortKey): string | number | null {
  switch (key) {
    case "hook":
      return r._hook.toLowerCase();
    case "platform":
      return r.platform;
    case "published_at":
      return r.published_at;
    case "views":
      return r.views;
    case "likes":
      return r.likes;
    case "comments":
      return r.comments;
    case "shares":
      return r.shares;
    case "engagement":
      return r._engagement;
  }
}

// Bucket a percentile into a color tier. Top 20% glow accent green, bottom
// 20% are muted, middle is the default foreground. Rows with no views at
// all get the muted treatment too.
function percentileTier(
  percentile: number,
  views: number | null,
): { color: string; textColor: string } {
  if (views == null || views === 0) {
    return {
      color: "transparent",
      textColor: "var(--color-muted)",
    };
  }
  if (percentile >= 0.8) {
    return {
      color: "var(--color-accent)",
      textColor: "var(--color-accent)",
    };
  }
  if (percentile <= 0.2) {
    return {
      color: "var(--color-border)",
      textColor: "var(--color-muted)",
    };
  }
  return {
    color: "var(--color-border)",
    textColor: "var(--color-fg)",
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
