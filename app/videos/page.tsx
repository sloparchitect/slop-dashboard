import { listVideos, parseScope } from "@/lib/queries";
import { VideoTable } from "@/components/video-table";

export const dynamic = "force-dynamic";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const sp = await searchParams;
  const scope = parseScope(sp);
  const videos = listVideos(scope);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Sortable + filterable view of every video. Click a title for detail.
        </p>
      </header>
      <VideoTable videos={videos} />
    </div>
  );
}
