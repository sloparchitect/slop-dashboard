import Link from "next/link";
import type { VideoRow } from "@/lib/queries";
import { PlatformBadge } from "./platform-badge";
import { fmtCompact, fmtRelative, engagementRate, fmtPct } from "./format";

export function VideoListRow({
  video,
  rank,
}: {
  video: VideoRow;
  rank?: number;
}) {
  const eng = engagementRate(
    video.likes,
    video.comments,
    video.shares,
    video.views,
  );
  return (
    <Link
      href={`/videos/${encodeURIComponent(video.id)}`}
      className="group flex items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/20 transition-colors"
    >
      {rank != null && (
        <div className="w-6 text-right text-sm text-[var(--color-muted)] tabular">
          {rank}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium group-hover:text-[var(--color-accent)] transition-colors">
          {video.title ?? "(untitled)"}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <PlatformBadge platform={video.platform} />
          <span className="text-xs text-[var(--color-muted)]">
            {fmtRelative(video.published_at)}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold tabular">
          {fmtCompact(video.views)}
        </div>
        <div className="text-xs text-[var(--color-muted)] tabular">
          {fmtPct(eng)} eng
        </div>
      </div>
    </Link>
  );
}
