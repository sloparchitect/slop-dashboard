import { db } from "./db";
import { SELF_LABEL } from "./config";

// ---------- types ----------

export type Platform = "youtube" | "tiktok";
export type SnapshotSource =
  | "yt_api"
  | "yt_csv"
  | "tt_api"
  | "tt_csv"
  | "yt_public"
  | "tt_public";

// Creator scoping. The dashboard can view "my own content" (the default when
// no ?creator= query param is present) or any external creator by normalized
// handle. Handle matching is case-insensitive and `@` is optional. One label
// can span multiple creator rows (e.g. two YouTube channels under one handle).
export type CreatorScope =
  | { kind: "self" }
  | { kind: "handle"; handle: string };

export const SELF_SCOPE: CreatorScope = { kind: "self" };

export function parseScope(
  params: { creator?: string | string[] } | undefined,
): CreatorScope {
  const raw = Array.isArray(params?.creator)
    ? params?.creator[0]
    : params?.creator;
  if (!raw) return SELF_SCOPE;
  return { kind: "handle", handle: raw };
}

export interface CreatorOption {
  // URL-safe value. "self" for the default, else the normalized @handle.
  value: string;
  // Human-readable label for the dropdown.
  label: string;
  // Sub-label showing video count + platforms present (e.g. "100 videos · YT").
  sub: string;
  // Discriminator for rendering: 'self' is grouped separately from externals.
  kind: "self" | "external";
}

export interface VideoRow {
  id: string;
  platform: Platform;
  platform_id: string;
  group_id: string | null;
  creator_id: string | null;
  creator_handle: string | null;
  creator_display_name: string | null;
  creator_is_self: number | null;
  url: string;
  title: string | null;
  description: string | null;
  duration_sec: number | null;
  published_at: string;
  // Latest merged metrics across sources (API > CSV > public).
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  avg_view_duration_sec: number | null;
  watch_time_min: number | null;
  retention_pct: number | null;
}

export interface HookRow {
  id: string;
  platform: Platform;
  url: string;
  title: string | null;
  published_at: string;
  duration_sec: number | null;
  // Raw Whisper segments JSON — parsed client-side to derive the hook
  // at a selected window size (3s / 5s / 10s). Shape is
  // `{ from, to, text }[]` where `from`/`to` are "HH:MM:SS,mmm" strings.
  segments_json: string;
  // Merged metrics (same semantics as VideoRow).
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export interface OverviewTotals {
  total_videos: number;
  youtube_videos: number;
  tiktok_videos: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  median_views: number;
  median_engagement_pct: number;
  // % of videos whose views exceed 2× the lifetime median. A "banger" rate —
  // how often you land a hit relative to your own baseline.
  hook_hit_rate_pct: number;
}

export interface MetricSeriesPoint {
  // Cumulative totals (views/likes/comments/shares) across every video
  // published on or before this date. Same shape as CareerPoint but
  // carries every metric so metric-card sparklines can share one query.
  date: string;
  videos: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TimeSeriesPoint {
  snapshot_date: string;
  source: SnapshotSource;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  retention_pct: number | null;
  watch_time_min: number | null;
}

export interface CareerPoint {
  // YYYY-MM-DD. One point per date that had at least one upload, with
  // cumulative career views (YT vs TT, running totals) at the end of that day.
  date: string;
  youtube: number;
  tiktok: number;
}

export interface GroupRow {
  group_id: string;
  canonical_title: string | null;
  member_count: number;
  yt_count: number;
  tt_count: number;
  yt_views: number;
  tt_views: number;
  yt_likes: number;
  tt_likes: number;
  yt_comments: number;
  tt_comments: number;
  yt_shares: number;
  tt_shares: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_engagement: number;
  best_video_id: string | null;
  best_video_platform: Platform | null;
  published_at: string | null;
}

// ---------- scope helpers ----------

interface ScopeClause {
  sql: string;
  params: unknown[];
}

// Translate a CreatorScope into a SQL predicate + bound params referencing
// the `creator` table aliased as `c`. The default `self` scope matches rows
// where the creator is the pipeline owner (is_self=1). An external `handle`
// scope normalizes both sides by lowercasing and stripping the leading `@`,
// so handles match regardless of how the user typed them. Rows with NULL
// `creator_id` — unlikely after the migration but
// possible if a fetch script somehow wrote one without setting creator_id —
// are intentionally excluded from both scopes.
function scopeClause(scope: CreatorScope): ScopeClause {
  if (scope.kind === "self") {
    return { sql: "c.is_self = 1", params: [] };
  }
  return {
    sql:
      "c.is_self = 0 AND " +
      "LOWER(REPLACE(COALESCE(c.handle, ''), '@', '')) = " +
      "LOWER(REPLACE(?, '@', ''))",
    params: [scope.handle],
  };
}

// Build the "latest metrics per video" CTE, optionally scoped to a creator.
// The CTE exposes a `merged` view with one row per video containing the most
// recent counters. For views/likes/comments we prefer the public counters
// (`pub > api > csv`) because the YouTube Analytics API lags 24-48h on
// freshly-uploaded videos — sometimes returning no row at all, sometimes a
// stale near-zero count — whereas `videos.list`'s public counter is always
// current. For owner-only metrics (shares/saves/retention/watch_time),
// which don't exist in the public tier, we keep `api > csv`.
//
// If `scope` is undefined the CTE is unscoped (useful for single-video
// lookups where the URL already names the row and any filter would just
// turn a valid lookup into a 404).
function buildMetricsCTE(scope?: CreatorScope): {
  sql: string;
  params: unknown[];
} {
  const where = scope ? scopeClause(scope) : null;
  const scopeWhere = where ? `WHERE ${where.sql}` : "";
  const scopeJoin = where ? "LEFT JOIN creator c ON c.id = v.creator_id" : "";
  const sql = /* sql */ `
    WITH latest_dates AS (
      SELECT video_id, MAX(snapshot_date) AS snapshot_date
        FROM analytics_snapshot
       GROUP BY video_id
    ),
    latest_metrics AS (
      SELECT
        v.id AS video_id,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.views END) AS api_views,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.views END) AS csv_views,
        MAX(CASE WHEN a.source IN ('yt_public','tt_public') THEN a.views END) AS pub_views,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.likes END) AS api_likes,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.likes END) AS csv_likes,
        MAX(CASE WHEN a.source IN ('yt_public','tt_public') THEN a.likes END) AS pub_likes,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.comments END) AS api_comments,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.comments END) AS csv_comments,
        MAX(CASE WHEN a.source IN ('yt_public','tt_public') THEN a.comments END) AS pub_comments,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.shares END) AS api_shares,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.shares END) AS csv_shares,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.saves END) AS api_saves,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.saves END) AS csv_saves,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.avg_view_duration_sec END) AS api_avd,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.avg_view_duration_sec END) AS csv_avd,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.watch_time_min END) AS api_wt,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.watch_time_min END) AS csv_wt,
        MAX(CASE WHEN a.source IN ('yt_api','tt_api')       THEN a.retention_pct END) AS api_ret,
        MAX(CASE WHEN a.source IN ('yt_csv','tt_csv')       THEN a.retention_pct END) AS csv_ret
      FROM video v
      LEFT JOIN latest_dates ld ON ld.video_id = v.id
      LEFT JOIN analytics_snapshot a
        ON a.video_id = v.id AND a.snapshot_date = ld.snapshot_date
      GROUP BY v.id
    ),
    merged AS (
      SELECT
        v.id, v.platform, v.platform_id, v.group_id, v.creator_id,
        c.handle        AS creator_handle,
        c.display_name  AS creator_display_name,
        c.is_self       AS creator_is_self,
        v.url, v.title, v.description, v.duration_sec, v.published_at,
        COALESCE(m.pub_views,    m.api_views,    m.csv_views)    AS views,
        COALESCE(m.pub_likes,    m.api_likes,    m.csv_likes)    AS likes,
        COALESCE(m.pub_comments, m.api_comments, m.csv_comments) AS comments,
        COALESCE(m.api_shares,   m.csv_shares)                   AS shares,
        COALESCE(m.api_saves,    m.csv_saves)                    AS saves,
        COALESCE(m.api_avd,      m.csv_avd)                      AS avg_view_duration_sec,
        COALESCE(m.api_wt,       m.csv_wt)                       AS watch_time_min,
        COALESCE(m.api_ret,      m.csv_ret)                      AS retention_pct
      FROM video v
      LEFT JOIN creator c ON c.id = v.creator_id
      LEFT JOIN latest_metrics m ON m.video_id = v.id
      ${scopeWhere}
    )
  `;
  return { sql, params: where?.params ?? [] };
}

// ---------- queries ----------

export function listCreatorOptions(): CreatorOption[] {
  // Distinct creators grouped by normalized handle so multiple channels
  // under the same handle collapse into one dropdown entry.
  interface ExternalRow {
    label: string;
    display_name: string | null;
    count: number;
    platforms: string; // comma-separated distinct platforms
  }
  const externals = db()
    .prepare(
      `SELECT
         LOWER(REPLACE(c.handle, '@', ''))                             AS label,
         MIN(c.display_name)                                           AS display_name,
         COUNT(v.id)                                                   AS count,
         GROUP_CONCAT(DISTINCT v.platform)                             AS platforms
         FROM creator c
         LEFT JOIN video v ON v.creator_id = c.id
         WHERE c.is_self = 0 AND c.handle IS NOT NULL AND c.handle != ''
         GROUP BY LOWER(REPLACE(c.handle, '@', ''))
         HAVING count > 0
         ORDER BY count DESC, display_name ASC`,
    )
    .all() as ExternalRow[];

  // Self stats for the owner entry.
  interface SelfRow { count: number; platforms: string | null }
  const selfRow = db()
    .prepare(
      `SELECT COUNT(v.id) AS count,
              GROUP_CONCAT(DISTINCT v.platform) AS platforms
         FROM creator c
         LEFT JOIN video v ON v.creator_id = c.id
         WHERE c.is_self = 1`,
    )
    .get() as SelfRow;

  const platformBadge = (platforms: string | null): string => {
    if (!platforms) return "";
    const parts = platforms.split(",").filter(Boolean);
    return parts.map((p) => (p === "youtube" ? "YT" : "TT")).join(" · ");
  };

  const out: CreatorOption[] = [
    {
      value: "self",
      label: SELF_LABEL,
      sub: `${selfRow.count} videos${selfRow.platforms ? " · " + platformBadge(selfRow.platforms) : ""}`,
      kind: "self",
    },
  ];
  for (const e of externals) {
    out.push({
      value: `@${e.label}`,
      label: e.display_name ?? `@${e.label}`,
      sub: `${e.count} videos · ${platformBadge(e.platforms)}`,
      kind: "external",
    });
  }
  return out;
}

export function listVideos(scope: CreatorScope): VideoRow[] {
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT * FROM merged ORDER BY published_at DESC`;
  return db().prepare(sql).all(...cte.params) as VideoRow[];
}

// List every transcribed video with its raw segments_json, joined against
// the same merged-metrics CTE the rest of the dashboard uses. The inner
// JOIN (not LEFT JOIN) is intentional: videos without a transcript are
// excluded because the hooks view only makes sense for spoken openings.
export function listHooks(scope: CreatorScope): HookRow[] {
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT
      merged.id, merged.platform, merged.url, merged.title,
      merged.published_at, merged.duration_sec,
      t.segments_json,
      merged.views, merged.likes, merged.comments, merged.shares
      FROM merged
      JOIN transcript t ON t.video_id = merged.id
     ORDER BY merged.published_at DESC`;
  return db().prepare(sql).all(...cte.params) as HookRow[];
}

export function getTopVideos(scope: CreatorScope, limit = 10): VideoRow[] {
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT * FROM merged
     WHERE views IS NOT NULL
     ORDER BY views DESC
     LIMIT ?`;
  return db()
    .prepare(sql)
    .all(...cte.params, limit) as VideoRow[];
}

export function getBottomVideos(
  scope: CreatorScope,
  limit = 10,
  minAgeDays = 14,
): VideoRow[] {
  // Filter to videos at least `minAgeDays` old so freshly-posted videos don't
  // dominate the "worst" list simply because they haven't accumulated views.
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT * FROM merged
     WHERE views IS NOT NULL
       AND julianday('now') - julianday(published_at) >= ?
     ORDER BY views ASC
     LIMIT ?`;
  return db()
    .prepare(sql)
    .all(...cte.params, minAgeDays, limit) as VideoRow[];
}

export function getRecentVideos(scope: CreatorScope, limit = 10): VideoRow[] {
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT * FROM merged
     ORDER BY published_at DESC
     LIMIT ?`;
  return db()
    .prepare(sql)
    .all(...cte.params, limit) as VideoRow[];
}

export function getOverviewTotals(
  scope: CreatorScope,
  platform?: Platform,
): OverviewTotals {
  const cte = buildMetricsCTE(scope);
  // Optional platform filter lets the overview page reuse this for the
  // YouTube-only and TikTok-only metric rows without a second function.
  // Per-platform banger rate falls out for free: the median is computed
  // over the filtered set, so each platform gets its own baseline.
  const platformWhere = platform ? "WHERE platform = ?" : "";
  const platformAnd = platform ? "AND platform = ?" : "";
  const platformParams = platform ? [platform] : [];

  const base = db()
    .prepare(
      `${cte.sql}
       SELECT
         COUNT(*)                                                 AS total_videos,
         SUM(CASE WHEN platform = 'youtube' THEN 1 ELSE 0 END)    AS youtube_videos,
         SUM(CASE WHEN platform = 'tiktok'  THEN 1 ELSE 0 END)    AS tiktok_videos,
         COALESCE(SUM(views),    0)                               AS total_views,
         COALESCE(SUM(likes),    0)                               AS total_likes,
         COALESCE(SUM(comments), 0)                               AS total_comments,
         COALESCE(SUM(shares),   0)                               AS total_shares
         FROM merged
         ${platformWhere}`,
    )
    .get(...cte.params, ...platformParams) as Omit<
    OverviewTotals,
    "median_views" | "median_engagement_pct"
  >;

  // Medians: pull views + engagement into JS and sort. At ~hundreds of videos
  // this is trivially fast and keeps the SQL simple.
  const rows = db()
    .prepare(
      `${cte.sql}
       SELECT views,
              CASE WHEN views > 0
                   THEN 100.0 * (COALESCE(likes,0) + COALESCE(comments,0) + COALESCE(shares,0)) / views
                   ELSE NULL END AS engagement_pct
         FROM merged
        WHERE views IS NOT NULL
        ${platformAnd}`,
    )
    .all(...cte.params, ...platformParams) as { views: number | null; engagement_pct: number | null }[];

  const median = (xs: number[]): number => {
    if (xs.length === 0) return 0;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  };

  const views = rows
    .map((r) => r.views)
    .filter((v): v is number => v !== null);
  const engagements = rows
    .map((r) => r.engagement_pct)
    .filter((v): v is number => v !== null);

  const med = median(views);
  // "Banger" rate — what fraction of your videos beat 2× your own median
  // views. This is a creator-native way to talk about "how often do I land
  // a hit," which reads better on camera than the more statistician-y
  // median engagement metric it replaces.
  const hits = med > 0 ? views.filter((v) => v >= 2 * med).length : 0;
  const hookHitRate =
    views.length > 0 ? Number(((100 * hits) / views.length).toFixed(1)) : 0;

  return {
    ...base,
    median_views: Math.round(med),
    median_engagement_pct: Number(median(engagements).toFixed(2)),
    hook_hit_rate_pct: hookHitRate,
  };
}

// Per-date cumulative totals for views/likes/comments/shares/videos. Same
// anchor-on-end-state trick as getCareerSeries — old videos don't get
// back-dated snapshots, but the shape and final value are what drive the
// sparklines and 30-day deltas on the metric cards.
export function getMetricSeries(
  scope: CreatorScope,
  platform?: Platform,
): MetricSeriesPoint[] {
  const cte = buildMetricsCTE(scope);
  const platformAnd = platform ? "AND platform = ?" : "";
  const platformParams = platform ? [platform] : [];
  const rows = db()
    .prepare(
      `${cte.sql}
       SELECT DATE(published_at) AS date,
              COALESCE(views, 0)    AS views,
              COALESCE(likes, 0)    AS likes,
              COALESCE(comments, 0) AS comments,
              COALESCE(shares, 0)   AS shares
         FROM merged
        WHERE published_at IS NOT NULL
        ${platformAnd}
        ORDER BY DATE(published_at) ASC`,
    )
    .all(...cte.params, ...platformParams) as {
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];

  const points: MetricSeriesPoint[] = [];
  let videos = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let lastDate: string | null = null;
  for (const r of rows) {
    videos += 1;
    views += r.views;
    likes += r.likes;
    comments += r.comments;
    shares += r.shares;
    if (r.date === lastDate) {
      const last = points[points.length - 1];
      if (last) {
        last.videos = videos;
        last.views = views;
        last.likes = likes;
        last.comments = comments;
        last.shares = shares;
      }
    } else {
      points.push({ date: r.date, videos, views, likes, comments, shares });
      lastDate = r.date;
    }
  }
  return points;
}

// "Career" view: the cumulative sum of lifetime views across every video
// published on or before each date, split by platform. This is the hero
// chart on Overview — it doesn't reconstruct the actual historical view
// counts (we'd need a snapshot per video per day for that), but it does
// show the shape of career growth in a way that anchors on end-state
// totals (the last point sums to the same number the metric cards show).
export function getCareerSeries(scope: CreatorScope): CareerPoint[] {
  const cte = buildMetricsCTE(scope);
  const rows = db()
    .prepare(
      `${cte.sql}
       SELECT DATE(published_at) AS date, platform, COALESCE(views, 0) AS views
         FROM merged
        WHERE published_at IS NOT NULL
        ORDER BY DATE(published_at) ASC`,
    )
    .all(...cte.params) as {
    date: string;
    platform: Platform;
    views: number;
  }[];

  // Roll up per-date into running cumulative totals. Multiple videos on the
  // same day collapse into one point with both increments applied.
  const points: CareerPoint[] = [];
  let yt = 0;
  let tt = 0;
  let lastDate: string | null = null;
  for (const r of rows) {
    if (r.platform === "youtube") yt += r.views;
    else tt += r.views;
    if (r.date === lastDate) {
      const last = points[points.length - 1];
      if (last) {
        last.youtube = yt;
        last.tiktok = tt;
      }
    } else {
      points.push({ date: r.date, youtube: yt, tiktok: tt });
      lastDate = r.date;
    }
  }
  return points;
}

export interface UploadCalendarDay {
  // YYYY-MM-DD in the viewer's local timezone. Used as a React key and
  // also surfaced in hover tooltips.
  date: string;
  count: number;
  yt: number;
  tt: number;
  // False for grid cells that exist only to align the 30-day window to a
  // clean 5-week × 7-day box. These cells render as empty outlines and
  // are excluded from every stat.
  inWindow: boolean;
  // True only for grid cells dated strictly after today (possible when the
  // current week isn't full yet). Rendered fully blank.
  isFuture: boolean;
  isToday: boolean;
}

export interface UploadCalendarStats {
  windowDays: number;
  // Number of distinct days inside the window that had ≥1 upload.
  activeDays: number;
  // Total uploads across the window (sum of per-day counts).
  totalUploads: number;
  // Consecutive days with ≥1 upload, counted backwards from today. If
  // today has no upload yet we start counting from yesterday — otherwise
  // the number resets to 0 at midnight, which is unhelpful feedback.
  currentStreak: number;
  // Longest run of consecutive upload days observed inside the window.
  longestStreak: number;
  // null only if the creator has never uploaded; otherwise an integer
  // number of days (0 = today).
  daysSinceLastUpload: number | null;
  // Posts/week averaged over the trailing 4 weeks (NOT the full window).
  // At a 365-day window the yearly average gets dragged down by any quiet
  // period before the channel ramped up, so a trailing-4-week number is a
  // better "am I currently consistent" signal than a 365-day mean.
  recentPostsPerWeek: number;
}

export interface UploadCalendar {
  // Exactly `UPLOAD_CALENDAR_GRID_WEEKS * 7` cells, ordered chronologically
  // (days[0] = oldest Sun, last entry = most recent Sat). The component
  // uses CSS `grid-auto-flow: column` to render this as N week-columns × 7
  // day-rows without needing to reshape the array.
  days: UploadCalendarDay[];
  stats: UploadCalendarStats;
}

const UPLOAD_CALENDAR_WINDOW_DAYS = 365;
// 53 weeks gives us a little room on either side of the 365-day window so
// the grid aligns cleanly to week boundaries (matching GitHub's year grid).
const UPLOAD_CALENDAR_GRID_WEEKS = 53;
// Posts/week is averaged over this much shorter window so new channels
// see a meaningful cadence number from day one.
const RECENT_CADENCE_WINDOW_DAYS = 28;

// Format a Date as YYYY-MM-DD using its local-timezone components. We avoid
// `toISOString()` here because that would shift the date for anyone east of
// UTC — a TikTok posted at 11pm local would land on the wrong day.
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getUploadCalendar(scope: CreatorScope): UploadCalendar {
  const cte = buildMetricsCTE(scope);
  const rows = db()
    .prepare(
      `${cte.sql}
       SELECT published_at, platform
         FROM merged
        WHERE published_at IS NOT NULL`,
    )
    .all(...cte.params) as { published_at: string; platform: Platform }[];

  // Anchor the grid on "today" at local midnight. The grid spans from the
  // Sunday (UPLOAD_CALENDAR_GRID_WEEKS - 1) weeks before the Sunday of the
  // current week, through the Saturday of the current week — always
  // exactly UPLOAD_CALENDAR_GRID_WEEKS × 7 days, Sunday-first (GitHub style).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentSunday = new Date(today);
  currentSunday.setDate(today.getDate() - today.getDay());
  const gridStart = new Date(currentSunday);
  gridStart.setDate(
    currentSunday.getDate() - (UPLOAD_CALENDAR_GRID_WEEKS - 1) * 7,
  );

  // Window is the trailing 30 days inclusive of today. Anything in the
  // grid but before this start is a layout filler cell (inWindow=false).
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - (UPLOAD_CALENDAR_WINDOW_DAYS - 1));

  // Bucket uploads by local-date key. One pass over the raw rows; JS Date
  // handles the ISO → local conversion so weekend-boundary posts land on
  // the right day for the viewer.
  interface Bucket {
    count: number;
    yt: number;
    tt: number;
  }
  const byDate = new Map<string, Bucket>();
  for (const r of rows) {
    const d = new Date(r.published_at);
    if (Number.isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const key = toLocalDateKey(d);
    const b = byDate.get(key) ?? { count: 0, yt: 0, tt: 0 };
    b.count += 1;
    if (r.platform === "youtube") b.yt += 1;
    else if (r.platform === "tiktok") b.tt += 1;
    byDate.set(key, b);
  }

  const todayKey = toLocalDateKey(today);
  const windowStartTime = windowStart.getTime();
  const todayTime = today.getTime();

  const days: UploadCalendarDay[] = [];
  const totalCells = UPLOAD_CALENDAR_GRID_WEEKS * 7;
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const key = toLocalDateKey(cellDate);
    const cellTime = cellDate.getTime();
    const bucket = byDate.get(key) ?? { count: 0, yt: 0, tt: 0 };
    days.push({
      date: key,
      count: bucket.count,
      yt: bucket.yt,
      tt: bucket.tt,
      inWindow: cellTime >= windowStartTime && cellTime <= todayTime,
      isFuture: cellTime > todayTime,
      isToday: key === todayKey,
    });
  }

  // Stats only consider the 30 in-window cells, so layout fillers never
  // drag the activity numbers down.
  const windowDays = days.filter((d) => d.inWindow);
  const activeDays = windowDays.filter((d) => d.count > 0).length;
  const totalUploads = windowDays.reduce((sum, d) => sum + d.count, 0);

  // Longest run of consecutive ≥1-upload days anywhere in the window.
  let longestStreak = 0;
  let run = 0;
  for (const d of windowDays) {
    if (d.count > 0) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  // Current streak — walk backwards from today. If today hasn't shipped
  // yet we give grace and start counting from yesterday instead of
  // zeroing out at midnight; that's the difference between "useful
  // feedback" and "brittle number."
  let currentStreak = 0;
  const reversed = [...windowDays].reverse();
  let started = false;
  for (const d of reversed) {
    if (!started) {
      if (d.isToday && d.count === 0) continue; // grace day
      started = true;
    }
    if (d.count > 0) currentStreak += 1;
    else break;
  }

  // Days since the most recent upload, considering uploads OUTSIDE the
  // window too — if the creator went quiet 45 days ago we still want to
  // surface that, not claim "no uploads" because the window is empty.
  let daysSinceLastUpload: number | null = null;
  if (byDate.size > 0) {
    const latestKey = [...byDate.keys()].sort().at(-1);
    if (latestKey) {
      const [y, m, d] = latestKey.split("-").map(Number);
      const latest = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
      daysSinceLastUpload = Math.max(
        0,
        Math.round((todayTime - latest.getTime()) / 86_400_000),
      );
    }
  }

  // Cadence is computed over the trailing 4 weeks only — a fresh channel
  // would otherwise show a near-zero weekly average for the whole year.
  const recentStart = new Date(today);
  recentStart.setDate(today.getDate() - (RECENT_CADENCE_WINDOW_DAYS - 1));
  const recentStartTime = recentStart.getTime();
  const recentUploads = windowDays
    .filter((d) => {
      const [y, m, dd] = d.date.split("-").map(Number);
      return (
        new Date(y ?? 0, (m ?? 1) - 1, dd ?? 1).getTime() >= recentStartTime
      );
    })
    .reduce((sum, d) => sum + d.count, 0);
  const recentPostsPerWeek =
    Math.round(((recentUploads * 7) / RECENT_CADENCE_WINDOW_DAYS) * 10) / 10;

  return {
    days,
    stats: {
      windowDays: UPLOAD_CALENDAR_WINDOW_DAYS,
      activeDays,
      totalUploads,
      currentStreak,
      longestStreak,
      daysSinceLastUpload,
      recentPostsPerWeek,
    },
  };
}

export function getVideo(id: string): VideoRow | null {
  // Single-video lookup: unscoped because the URL already names the creator
  // and any filter here would turn a legitimate cross-creator link into 404.
  const cte = buildMetricsCTE();
  const sql = `${cte.sql}
    SELECT * FROM merged WHERE id = ?`;
  const row = db().prepare(sql).get(...cte.params, id) as VideoRow | undefined;
  return row ?? null;
}

export function getVideoTimeSeries(id: string): TimeSeriesPoint[] {
  return db()
    .prepare(
      `SELECT snapshot_date, source, views, likes, comments, shares,
              retention_pct, watch_time_min
         FROM analytics_snapshot
        WHERE video_id = ?
        ORDER BY snapshot_date ASC, source ASC`,
    )
    .all(id) as TimeSeriesPoint[];
}

export function getVideoHashtags(id: string): string[] {
  const rows = db()
    .prepare(`SELECT tag FROM hashtag WHERE video_id = ? ORDER BY tag`)
    .all(id) as { tag: string }[];
  return rows.map((r) => r.tag);
}

export function getVideoTranscript(id: string): string | null {
  const row = db()
    .prepare(`SELECT text FROM transcript WHERE video_id = ?`)
    .get(id) as { text: string } | undefined;
  return row?.text ?? null;
}

export function getCrosspostSiblings(
  groupId: string,
  excludeId: string,
): VideoRow[] {
  // Unscoped: the video detail page already names a specific video; its
  // siblings come from the same `video_group`, which after the sameSide()
  // fix in link-crossposts.ts is already scoped to same-creator.
  const cte = buildMetricsCTE();
  const sql = `${cte.sql}
    SELECT * FROM merged
     WHERE group_id = ? AND id != ?
     ORDER BY views DESC NULLS LAST`;
  return db()
    .prepare(sql)
    .all(...cte.params, groupId, excludeId) as VideoRow[];
}

export function getGroupLeaderboard(
  scope: CreatorScope,
  limit = 500,
): GroupRow[] {
  // For each group, sum views/likes/comments/shares per platform and find the
  // best-performing video for the detail-page deeplink. Singletons are
  // included so one table can show everything. Groups whose members all
  // fall outside the current scope are dropped via HAVING.
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql},
    group_agg AS (
      SELECT
        g.id AS group_id,
        g.canonical_title,
        COUNT(m.id)                                                         AS member_count,
        COALESCE(SUM(CASE WHEN m.platform='youtube' THEN 1 ELSE 0 END), 0)  AS yt_count,
        COALESCE(SUM(CASE WHEN m.platform='tiktok'  THEN 1 ELSE 0 END), 0)  AS tt_count,
        COALESCE(SUM(CASE WHEN m.platform='youtube' THEN m.views ELSE 0 END), 0)    AS yt_views,
        COALESCE(SUM(CASE WHEN m.platform='tiktok'  THEN m.views ELSE 0 END), 0)    AS tt_views,
        COALESCE(SUM(CASE WHEN m.platform='youtube' THEN m.likes ELSE 0 END), 0)    AS yt_likes,
        COALESCE(SUM(CASE WHEN m.platform='tiktok'  THEN m.likes ELSE 0 END), 0)    AS tt_likes,
        COALESCE(SUM(CASE WHEN m.platform='youtube' THEN m.comments ELSE 0 END), 0) AS yt_comments,
        COALESCE(SUM(CASE WHEN m.platform='tiktok'  THEN m.comments ELSE 0 END), 0) AS tt_comments,
        COALESCE(SUM(CASE WHEN m.platform='youtube' THEN m.shares ELSE 0 END), 0)   AS yt_shares,
        COALESCE(SUM(CASE WHEN m.platform='tiktok'  THEN m.shares ELSE 0 END), 0)   AS tt_shares,
        COALESCE(SUM(m.views),    0) AS total_views,
        COALESCE(SUM(m.likes),    0) AS total_likes,
        COALESCE(SUM(m.comments), 0) AS total_comments,
        COALESCE(SUM(m.shares),   0) AS total_shares,
        COALESCE(SUM(COALESCE(m.likes,0) + COALESCE(m.comments,0) + COALESCE(m.shares,0)), 0) AS total_engagement,
        MAX(m.published_at) AS published_at
      FROM video_group g
      INNER JOIN merged m ON m.group_id = g.id
      GROUP BY g.id
      HAVING COUNT(m.id) > 0
    ),
    best AS (
      SELECT group_id, id AS best_video_id, platform AS best_video_platform,
             ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY views DESC NULLS LAST) AS rn
        FROM merged
       WHERE group_id IS NOT NULL
    )
    SELECT ga.*, b.best_video_id, b.best_video_platform
      FROM group_agg ga
      LEFT JOIN best b ON b.group_id = ga.group_id AND b.rn = 1
     ORDER BY ga.total_views DESC
     LIMIT ?`;
  return db()
    .prepare(sql)
    // CTE params appear twice because `merged` is referenced in both
    // group_agg and best. better-sqlite3 re-evaluates the CTE per subquery
    // reference but the bound params are positional, so we pass them both
    // times. Actually SQLite resolves CTEs once per query; the param
    // placeholders in the CTE are evaluated once. Passing scope params
    // twice would be wrong — we pass them just once, before limit.
    .all(...cte.params, limit) as GroupRow[];
}

export function searchVideos(
  scope: CreatorScope,
  q: string,
  limit = 50,
): VideoRow[] {
  // FTS5 MATCH — quote the query to handle user-entered punctuation safely.
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ""))
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(" ");
  if (!tokens) return [];
  const cte = buildMetricsCTE(scope);
  const sql = `${cte.sql}
    SELECT merged.* FROM merged
    JOIN video_fts ON video_fts.video_id = merged.id
    WHERE video_fts MATCH ?
    ORDER BY rank
    LIMIT ?`;
  return db()
    .prepare(sql)
    .all(...cte.params, tokens, limit) as VideoRow[];
}
