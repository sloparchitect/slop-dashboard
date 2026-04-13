"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GroupRow } from "@/lib/queries";
import {
  fmtCompact,
  fmtNum,
  fmtPct,
  fmtDate,
  engagementRate,
} from "./format";
import { ArrowDown, ArrowUp, Search, Youtube, Music2 } from "lucide-react";

type SortKey =
  | "title"
  | "published_at"
  | "member_count"
  | "yt_views"
  | "tt_views"
  | "total_views"
  | "yt_likes"
  | "tt_likes"
  | "total_likes"
  | "total_comments"
  | "total_shares"
  | "engagement";
type SortDir = "asc" | "desc";

type Filter = "all" | "linked" | "singletons";

interface Enriched extends GroupRow {
  _engagement: number | null;
}

export function GroupsTable({ groups }: { groups: GroupRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("total_views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const enriched = useMemo<Enriched[]>(
    () =>
      groups.map((g) => ({
        ...g,
        _engagement: engagementRate(
          g.total_likes,
          g.total_comments,
          g.total_shares,
          g.total_views,
        ),
      })),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((g) => {
      if (filter === "linked" && g.member_count < 2) return false;
      if (filter === "singletons" && g.member_count >= 2) return false;
      if (!q) return true;
      return (g.canonical_title ?? "").toLowerCase().includes(q);
    });
  }, [enriched, filter, query]);

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
      setSortDir(key === "title" || key === "published_at" ? "asc" : "desc");
    }
  }

  const linkedCount = enriched.filter((g) => g.member_count >= 2).length;
  const singletonCount = enriched.length - linkedCount;

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
            placeholder="Search canonical title…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1">
          {(
            [
              ["all", `All (${enriched.length})`],
              ["linked", `Linked (${linkedCount})`],
              ["singletons", `Singletons (${singletonCount})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === value
                  ? "bg-[var(--color-border)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-[var(--color-muted)] tabular">
          {fmtNum(sorted.length)} shown
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
                  label="Posts"
                  k="member_count"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Published"
                  k="published_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                />
                <Th
                  label={<YtLabel>Views</YtLabel>}
                  k="yt_views"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label={<TtLabel>Views</TtLabel>}
                  k="tt_views"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Total Views"
                  k="total_views"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label={<YtLabel>Likes</YtLabel>}
                  k="yt_likes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label={<TtLabel>Likes</TtLabel>}
                  k="tt_likes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Total Likes"
                  k="total_likes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Comm"
                  k="total_comments"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onClick={toggleSort}
                  right
                />
                <Th
                  label="Shares"
                  k="total_shares"
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
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => {
                const href = g.best_video_id
                  ? `/videos/${encodeURIComponent(g.best_video_id)}`
                  : null;
                // Highlight the winning platform for quick scanning
                const ytWins = g.yt_views > g.tt_views && g.yt_views > 0;
                const ttWins = g.tt_views > g.yt_views && g.tt_views > 0;
                return (
                  <tr
                    key={g.group_id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/20 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[360px]">
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium hover:text-[var(--color-accent)] transition-colors block truncate"
                        >
                          {g.canonical_title ?? "(untitled)"}
                        </Link>
                      ) : (
                        <span className="block truncate text-[var(--color-muted)]">
                          {g.canonical_title ?? "(untitled)"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      <PostBadges
                        yt={g.yt_count}
                        tt={g.tt_count}
                        total={g.member_count}
                      />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                      {fmtDate(g.published_at)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular ${
                        ytWins ? "text-[var(--color-youtube)] font-semibold" : ""
                      }`}
                    >
                      {g.yt_count > 0 ? fmtCompact(g.yt_views) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular ${
                        ttWins ? "text-[var(--color-tiktok)] font-semibold" : ""
                      }`}
                    >
                      {g.tt_count > 0 ? fmtCompact(g.tt_views) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular font-semibold">
                      {fmtCompact(g.total_views)}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                      {g.yt_count > 0 ? fmtCompact(g.yt_likes) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                      {g.tt_count > 0 ? fmtCompact(g.tt_likes) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {fmtCompact(g.total_likes)}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                      {fmtCompact(g.total_comments)}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-[var(--color-muted)]">
                      {fmtCompact(g.total_shares)}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {fmtPct(g._engagement)}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No groups match the current filters.
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
  label: React.ReactNode;
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
        } transition-colors ${right ? "justify-end" : ""}`}
      >
        {label}
        {active &&
          (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
}

function YtLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Youtube size={11} style={{ color: "var(--color-youtube)" }} />
      {children}
    </span>
  );
}

function TtLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Music2 size={11} style={{ color: "var(--color-tiktok)" }} />
      {children}
    </span>
  );
}

function PostBadges({
  yt,
  tt,
  total,
}: {
  yt: number;
  tt: number;
  total: number;
}) {
  // Show a compact visual of how a group's uploads split between platforms.
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${yt} YouTube · ${tt} TikTok`}
    >
      <span className="text-xs text-[var(--color-muted)]">{total}</span>
      <span className="inline-flex items-center gap-0.5 ml-1">
        {yt > 0 && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-youtube)" }}
          />
        )}
        {tt > 0 && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-tiktok)" }}
          />
        )}
      </span>
    </span>
  );
}

function getSortValue(g: Enriched, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return g.canonical_title?.toLowerCase() ?? "";
    case "published_at":
      return g.published_at;
    case "member_count":
      return g.member_count;
    case "yt_views":
      return g.yt_views;
    case "tt_views":
      return g.tt_views;
    case "total_views":
      return g.total_views;
    case "yt_likes":
      return g.yt_likes;
    case "tt_likes":
      return g.tt_likes;
    case "total_likes":
      return g.total_likes;
    case "total_comments":
      return g.total_comments;
    case "total_shares":
      return g.total_shares;
    case "engagement":
      return g._engagement;
  }
}
