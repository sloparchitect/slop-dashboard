"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { VideoRow, Platform } from "@/lib/queries";
import { PlatformBadge } from "./platform-badge";
import {
  fmtCompact,
  fmtNum,
  fmtPct,
  fmtDate,
  fmtDuration,
  engagementRate,
} from "./format";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

type SortKey =
  | "title"
  | "platform"
  | "published_at"
  | "duration_sec"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagement"
  | "retention_pct";
type SortDir = "asc" | "desc";

type PlatformFilter = "all" | Platform;

interface Enriched extends VideoRow {
  _engagement: number | null;
}

export function VideoTable({ videos }: { videos: VideoRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [query, setQuery] = useState("");

  const enriched = useMemo<Enriched[]>(
    () =>
      videos.map((v) => ({
        ...v,
        _engagement: engagementRate(v.likes, v.comments, v.shares, v.views),
      })),
    [videos],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((v) => {
      if (platform !== "all" && v.platform !== platform) return false;
      if (!q) return true;
      return (
        (v.title ?? "").toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [enriched, platform, query]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(
        key === "title" || key === "platform" || key === "published_at"
          ? "asc"
          : "desc",
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or description…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1">
          {(["all", "youtube", "tiktok"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                platform === p
                  ? "bg-[var(--color-border)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {p === "all" ? "All" : p === "youtube" ? "YouTube" : "TikTok"}
            </button>
          ))}
        </div>
        <div className="text-xs text-[var(--color-muted)] tabular">
          {fmtNum(sorted.length)} / {fmtNum(videos.length)} videos
        </div>
      </div>

      {/* table */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Th
                  label="Title"
                  k="title"
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
                />
                <Th
                  label="Published"
                  k="published_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
                <Th
                  label="Dur"
                  k="duration_sec"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
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
                />
                <Th
                  label="Comm"
                  k="comments"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Shares"
                  k="shares"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Eng %"
                  k="engagement"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Ret %"
                  k="retention_pct"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/20 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[360px]">
                    <Link
                      href={`/videos/${encodeURIComponent(v.id)}`}
                      className="font-medium hover:text-[var(--color-accent)] transition-colors block truncate"
                    >
                      {v.title ?? "(untitled)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={v.platform} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                    {fmtDate(v.published_at)}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                    {fmtDuration(v.duration_sec)}
                  </td>
                  <td className="px-4 py-3 text-right tabular font-medium">
                    {fmtCompact(v.views)}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {fmtCompact(v.likes)}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {fmtCompact(v.comments)}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {fmtCompact(v.shares)}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {fmtPct(v._engagement)}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                    {fmtPct(v.retention_pct)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No videos match the current filters.
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

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  right = false,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th
      className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`}
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

function getSortValue(v: Enriched, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return v.title?.toLowerCase() ?? "";
    case "platform":
      return v.platform;
    case "published_at":
      return v.published_at;
    case "duration_sec":
      return v.duration_sec;
    case "views":
      return v.views;
    case "likes":
      return v.likes;
    case "comments":
      return v.comments;
    case "shares":
      return v.shares;
    case "engagement":
      return v._engagement;
    case "retention_pct":
      return v.retention_pct;
  }
}
