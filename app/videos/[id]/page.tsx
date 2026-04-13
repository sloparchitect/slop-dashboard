import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getVideo,
  getVideoTimeSeries,
  getVideoHashtags,
  getVideoTranscript,
  getCrosspostSiblings,
} from "@/lib/queries";
import { Card, CardHeader, CardBody } from "@/components/card";
import { MetricCard } from "@/components/metric-card";
import { PlatformBadge } from "@/components/platform-badge";
import { VideoListRow } from "@/components/video-list-row";
import { TimeSeriesChart } from "@/components/time-series-chart";
import {
  fmtNum,
  fmtCompact,
  fmtPct,
  fmtDuration,
  fmtDate,
  engagementRate,
} from "@/components/format";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const video = getVideo(id);
  if (!video) notFound();

  const series = getVideoTimeSeries(id);
  const hashtags = getVideoHashtags(id);
  const transcript = getVideoTranscript(id);
  const siblings = video.group_id
    ? getCrosspostSiblings(video.group_id, id)
    : [];

  const eng = engagementRate(
    video.likes,
    video.comments,
    video.shares,
    video.views,
  );

  return (
    <div className="space-y-8">
      {/* breadcrumb */}
      <Link
        href="/videos"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        ← All videos
      </Link>

      {/* header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={video.platform} />
          <span className="text-sm text-[var(--color-muted)] flex items-center gap-1">
            <Clock size={12} /> {fmtDate(video.published_at)}
          </span>
          <span className="text-sm text-[var(--color-muted)]">
            {fmtDuration(video.duration_sec)}
          </span>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
          >
            Open on {video.platform === "youtube" ? "YouTube" : "TikTok"}
            <ExternalLink size={12} />
          </a>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {video.title ?? "(untitled)"}
        </h1>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* metric cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Views"
          value={fmtCompact(video.views)}
          sub={fmtNum(video.views)}
          icon={<Eye size={14} />}
        />
        <MetricCard
          label="Likes"
          value={fmtCompact(video.likes)}
          icon={<Heart size={14} />}
        />
        <MetricCard
          label="Comments"
          value={fmtCompact(video.comments)}
          icon={<MessageCircle size={14} />}
        />
        <MetricCard
          label="Shares"
          value={fmtCompact(video.shares)}
          icon={<Share2 size={14} />}
        />
        <MetricCard label="Engagement" value={fmtPct(eng)} />
        <MetricCard
          label="Retention"
          value={fmtPct(video.retention_pct)}
          sub={
            video.avg_view_duration_sec != null
              ? `avg ${Math.round(video.avg_view_duration_sec)}s`
              : undefined
          }
        />
      </section>

      {/* time series */}
      <Card>
        <CardHeader
          title="Performance over time"
          subtitle="Daily snapshots from fetch scripts"
        />
        <CardBody>
          <TimeSeriesChart data={series} />
        </CardBody>
      </Card>

      {/* crossposts */}
      {siblings.length > 0 && (
        <Card>
          <CardHeader
            title="Crosspost siblings"
            subtitle={`Other videos in the same content group`}
          />
          <div>
            {siblings.map((v) => (
              <VideoListRow key={v.id} video={v} />
            ))}
          </div>
        </Card>
      )}

      {/* transcript */}
      {transcript && (
        <Card>
          <CardHeader title="Transcript" />
          <CardBody>
            <div className="max-h-96 overflow-y-auto scroll-thin text-sm text-[var(--color-muted)] whitespace-pre-wrap leading-relaxed">
              {transcript}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
