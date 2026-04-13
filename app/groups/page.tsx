import { getGroupLeaderboard, parseScope } from "@/lib/queries";
import { GroupsTable } from "@/components/groups-table";
import { MetricCard } from "@/components/metric-card";
import { fmtCompact, fmtNum, fmtPct } from "@/components/format";
import { Layers, Link2, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const sp = await searchParams;
  const scope = parseScope(sp);
  const groups = getGroupLeaderboard(scope, 1000);
  const linked = groups.filter((g) => g.member_count > 1);

  // Summary metrics to contextualize the table
  const totalGroups = groups.length;
  const linkedCount = linked.length;
  const crosspostViews = linked.reduce((sum, g) => sum + g.total_views, 0);
  const allViews = groups.reduce((sum, g) => sum + g.total_views, 0);
  const crosspostShare = allViews > 0 ? (100 * crosspostViews) / allViews : 0;

  // Who wins more head-to-head when both platforms posted the same idea?
  let ytWins = 0;
  let ttWins = 0;
  for (const g of linked) {
    if (g.yt_count > 0 && g.tt_count > 0) {
      if (g.yt_views > g.tt_views) ytWins++;
      else if (g.tt_views > g.yt_views) ttWins++;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Crossposts</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Content grouped by idea. Answers which <em>ideas</em> performed best
          across both platforms, not just which uploads.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Content groups"
          value={fmtNum(totalGroups)}
          sub={`${linkedCount} crossposted · ${totalGroups - linkedCount} single-platform`}
          icon={<Layers size={14} />}
        />
        <MetricCard
          label="Crosspost views"
          value={fmtCompact(crosspostViews)}
          sub={`${fmtPct(crosspostShare)} of all views`}
          icon={<Eye size={14} />}
        />
        <MetricCard
          label="YT head-to-head wins"
          value={fmtNum(ytWins)}
          sub="groups where YT > TT views"
          icon={<Link2 size={14} />}
        />
        <MetricCard
          label="TT head-to-head wins"
          value={fmtNum(ttWins)}
          sub="groups where TT > YT views"
          icon={<Link2 size={14} />}
        />
      </section>

      <GroupsTable groups={groups} />
    </div>
  );
}
