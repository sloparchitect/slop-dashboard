import {
  getOverviewTotals,
  getTopVideos,
  getBottomVideos,
  getRecentVideos,
  getCareerSeries,
  getMetricSeries,
  getGroupLeaderboard,
  getUploadCalendar,
  parseScope,
  listCreatorOptions,
} from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { MetricCard } from "@/components/metric-card";
import { Card, CardHeader } from "@/components/card";
import { VideoListRow } from "@/components/video-list-row";
import { CareerBand } from "@/components/career-band";
import { CrosspostScoreboard } from "@/components/crosspost-scoreboard";
import { UploadCalendar } from "@/components/upload-calendar";
import { fmtNum, fmtCompact, fmtPct } from "@/components/format";
import { Eye, Heart, MessageCircle, Share2, Film, Flame } from "lucide-react";
import { SELF_LABEL } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  if (!hasDatabase()) {
    return (
      <div className="mt-24 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-semibold mb-3">No data yet</h1>
        <p className="text-[var(--color-muted)] mb-6">
          The dashboard reads from{" "}
          <code className="text-[var(--color-fg)]">data/shorts.db</code>, which
          doesn&apos;t exist yet. See the README for setup instructions.
        </p>
        <pre className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 text-left text-sm">
          cp /path/to/your.db data/shorts.db
        </pre>
      </div>
    );
  }

  const sp = await searchParams;
  const scope = parseScope(sp);
  const creatorOptions = listCreatorOptions();
  const current = creatorOptions.find(
    (c) =>
      c.value ===
      (scope.kind === "self" ? "self" : scope.handle.startsWith("@") ? scope.handle : `@${scope.handle}`),
  );
  const scopeLabel = current?.label ?? (scope.kind === "self" ? SELF_LABEL : scope.handle);

  const totals = getOverviewTotals(scope);
  const ytTotals = getOverviewTotals(scope, "youtube");
  const ttTotals = getOverviewTotals(scope, "tiktok");
  const top = getTopVideos(scope, 10);
  const bottom = getBottomVideos(scope, 10);
  const recent = getRecentVideos(scope, 10);
  const career = getCareerSeries(scope);
  const series = getMetricSeries(scope);
  const ytSeries = getMetricSeries(scope, "youtube");
  const ttSeries = getMetricSeries(scope, "tiktok");
  const groups = getGroupLeaderboard(scope, 1000);
  const uploadCalendar = getUploadCalendar(scope);

  // Head-to-head: groups where both platforms posted the same idea.
  // Mirrors the math on /groups so the Overview scoreboard and the
  // Crossposts metric cards stay in sync.
  let ytWins = 0;
  let ttWins = 0;
  for (const g of groups) {
    if (g.yt_count > 0 && g.tt_count > 0) {
      if (g.yt_views > g.tt_views) ytWins++;
      else if (g.tt_views > g.yt_views) ttWins++;
    }
  }

  // Metric-card series: cumulative running totals. The card computes
  // the delta and sparkline from these arrays.
  const viewsSeries = series.map((p) => p.views);
  const likesSeries = series.map((p) => p.likes);
  const commentsSeries = series.map((p) => p.comments);
  const sharesSeries = series.map((p) => p.shares);
  const videosSeries = series.map((p) => p.videos);

  // Per-platform equivalents. Same shape, just filtered upstream so each
  // card's sparkline tells the truth about its own platform's growth.
  const ytViewsSeries = ytSeries.map((p) => p.views);
  const ytLikesSeries = ytSeries.map((p) => p.likes);
  const ytCommentsSeries = ytSeries.map((p) => p.comments);
  const ytSharesSeries = ytSeries.map((p) => p.shares);
  const ytVideosSeries = ytSeries.map((p) => p.videos);

  const ttViewsSeries = ttSeries.map((p) => p.views);
  const ttLikesSeries = ttSeries.map((p) => p.likes);
  const ttCommentsSeries = ttSeries.map((p) => p.comments);
  const ttSharesSeries = ttSeries.map((p) => p.shares);
  const ttVideosSeries = ttSeries.map((p) => p.videos);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <span className="text-sm text-[var(--color-muted)]">· {scopeLabel}</span>
        </div>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {fmtNum(totals.total_videos)} videos · {totals.youtube_videos}{" "}
          YouTube · {totals.tiktok_videos} TikTok
        </p>
      </header>

      {/* Hero: full-width career-views area chart with big number + delta */}
      <CareerBand points={career} />

      {/* metric cards — three rows: combined + per-platform. The platform
          rows share the same 6-column grid so column alignment works; the
          row label above each platform section provides context without
          breaking alignment. Tinted cards use each platform's own median
          as the banger-rate baseline (see getOverviewTotals). */}
      <section className="space-y-5">
        {/* Row 1 — combined across both platforms */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Total videos"
            series={videosSeries}
            value={totals.total_videos}
            format="num"
            icon={<Film size={14} />}
            sub={`${totals.youtube_videos} YT · ${totals.tiktok_videos} TT`}
          />
          <MetricCard
            label="Total views"
            series={viewsSeries}
            value={totals.total_views}
            icon={<Eye size={14} />}
            sub={`median ${fmtCompact(totals.median_views)}/video`}
          />
          <MetricCard
            label="Total likes"
            series={likesSeries}
            value={totals.total_likes}
            icon={<Heart size={14} />}
          />
          <MetricCard
            label="Total comments"
            series={commentsSeries}
            value={totals.total_comments}
            icon={<MessageCircle size={14} />}
          />
          <MetricCard
            label="Total shares"
            series={sharesSeries}
            value={totals.total_shares}
            icon={<Share2 size={14} />}
          />
          <MetricCard
            label="Banger rate"
            value={fmtPct(totals.hook_hit_rate_pct)}
            icon={<Flame size={14} />}
            sub={`videos with ≥2× ${scope.kind === "self" ? "your" : "their"} median views`}
          />
        </div>

        {/* Row 2 — YouTube only */}
        <div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: "var(--color-youtube)" }}
          >
            YouTube
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              label="Videos"
              series={ytVideosSeries}
              value={ytTotals.total_videos}
              format="num"
              icon={<Film size={14} />}
              tint="var(--color-youtube)"
            />
            <MetricCard
              label="Views"
              series={ytViewsSeries}
              value={ytTotals.total_views}
              icon={<Eye size={14} />}
              sub={`median ${fmtCompact(ytTotals.median_views)}/video`}
              tint="var(--color-youtube)"
            />
            <MetricCard
              label="Likes"
              series={ytLikesSeries}
              value={ytTotals.total_likes}
              icon={<Heart size={14} />}
              tint="var(--color-youtube)"
            />
            <MetricCard
              label="Comments"
              series={ytCommentsSeries}
              value={ytTotals.total_comments}
              icon={<MessageCircle size={14} />}
              tint="var(--color-youtube)"
            />
            <MetricCard
              label="Shares"
              series={ytSharesSeries}
              value={ytTotals.total_shares}
              icon={<Share2 size={14} />}
              tint="var(--color-youtube)"
            />
            <MetricCard
              label="Banger rate"
              value={fmtPct(ytTotals.hook_hit_rate_pct)}
              icon={<Flame size={14} />}
              sub={`≥2× YT median (${fmtCompact(ytTotals.median_views)})`}
              tint="var(--color-youtube)"
            />
          </div>
        </div>

        {/* Row 3 — TikTok only */}
        <div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: "var(--color-tiktok)" }}
          >
            TikTok
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              label="Videos"
              series={ttVideosSeries}
              value={ttTotals.total_videos}
              format="num"
              icon={<Film size={14} />}
              tint="var(--color-tiktok)"
            />
            <MetricCard
              label="Views"
              series={ttViewsSeries}
              value={ttTotals.total_views}
              icon={<Eye size={14} />}
              sub={`median ${fmtCompact(ttTotals.median_views)}/video`}
              tint="var(--color-tiktok)"
            />
            <MetricCard
              label="Likes"
              series={ttLikesSeries}
              value={ttTotals.total_likes}
              icon={<Heart size={14} />}
              tint="var(--color-tiktok)"
            />
            <MetricCard
              label="Comments"
              series={ttCommentsSeries}
              value={ttTotals.total_comments}
              icon={<MessageCircle size={14} />}
              tint="var(--color-tiktok)"
            />
            <MetricCard
              label="Shares"
              series={ttSharesSeries}
              value={ttTotals.total_shares}
              icon={<Share2 size={14} />}
              tint="var(--color-tiktok)"
            />
            <MetricCard
              label="Banger rate"
              value={fmtPct(ttTotals.hook_hit_rate_pct)}
              icon={<Flame size={14} />}
              sub={`≥2× TT median (${fmtCompact(ttTotals.median_views)})`}
              tint="var(--color-tiktok)"
            />
          </div>
        </div>
      </section>

      {/* Upload calendar — 30-day consistency tracker, GitHub-style */}
      <UploadCalendar data={uploadCalendar} />

      {/* Head-to-head scoreboard — one tile, hero-sized text */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CrosspostScoreboard ytWins={ytWins} ttWins={ttWins} />
        <Card className="lg:col-span-2">
          <CardHeader
            title="Just shipped"
            subtitle="Most recently published videos"
          />
          <div>
            {recent.map((v) => (
              <VideoListRow key={v.id} video={v} />
            ))}
          </div>
        </Card>
      </section>

      {/* leaderboards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Bangers"
            subtitle="Highest-viewed videos across both platforms"
          />
          <div>
            {top.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-muted)]">
                No videos with views yet.
              </div>
            ) : (
              top.map((v, i) => (
                <VideoListRow key={v.id} video={v} rank={i + 1} />
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader
            title="The cemetery"
            subtitle="Lowest-viewed videos (published 14+ days ago)"
          />
          <div>
            {bottom.length === 0 ? (
              <div className="p-5 text-sm text-[var(--color-muted)]">
                No mature videos to rank yet.
              </div>
            ) : (
              bottom.map((v, i) => (
                <VideoListRow key={v.id} video={v} rank={i + 1} />
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
