import type { UploadCalendar, UploadCalendarDay } from "@/lib/queries";
import { Card, CardHeader } from "@/components/card";

// Sunday-first matches the GitHub contribution calendar. At the 53-week
// full-year scale we label only Mon/Wed/Fri to save vertical space,
// exactly like GitHub does.
const DAY_ROW_LABELS: Record<number, string> = {
  1: "Mon",
  3: "Wed",
  5: "Fri",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Binary fill: posted or didn't. We deliberately drop the GitHub-style
// shade ramp because the question this calendar answers is "am I
// consistent?", not "how intense was today?" — and a single strong green
// makes gaps jump out instantly, which is the whole point.
function bucketFill(count: number): number {
  return count > 0 ? 1 : 0;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function droughtLabel(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

// Compute month labels for each week-column. A label appears only when
// the week's Sunday lands in a different month than the previous week's
// Sunday — so each month gets one label at the week it starts in. An
// edge-case guard skips labeling the very first column when the month
// would visually crash into the following month's label.
function computeMonthLabels(days: UploadCalendarDay[]): (string | null)[] {
  const weekCount = days.length / 7;
  const labels: (string | null)[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const sunday = days[w * 7];
    if (!sunday) {
      labels.push(null);
      continue;
    }
    const [, mStr] = sunday.date.split("-");
    const month = Number(mStr) - 1;
    if (month !== prevMonth && w !== 0) {
      labels.push(MONTH_LABELS[month] ?? null);
    } else if (w === 0) {
      // Reserve the first column's label slot for the next month's
      // label to avoid crowding; GitHub does the same.
      labels.push(null);
    } else {
      labels.push(null);
    }
    prevMonth = month;
  }
  return labels;
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex-1 min-w-[120px] px-4 py-3 border-r border-[var(--color-border)] last:border-r-0">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
      {sub ? (
        <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function UploadCalendar({ data }: { data: UploadCalendar }) {
  const { days, stats } = data;
  const weekCount = days.length / 7;
  const monthLabels = computeMonthLabels(days);
  const subtitle = `Trailing 365 days · ≈ ${stats.recentPostsPerWeek} posts/week (last 4 weeks)`;

  return (
    <Card>
      <CardHeader title="Upload consistency" subtitle={subtitle} />

      {/* Stat strip — 4 tiles, each separated by a subtle divider. */}
      <div className="flex flex-wrap border-b border-[var(--color-border)]">
        <StatTile
          label="Active days"
          value={`${stats.activeDays}/${stats.windowDays}`}
          sub={`${stats.totalUploads} total upload${stats.totalUploads === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Current streak"
          value={`${stats.currentStreak}d`}
          sub={
            stats.currentStreak === 0
              ? "post today to start one"
              : "consecutive posting days"
          }
        />
        <StatTile
          label="Longest streak"
          value={`${stats.longestStreak}d`}
          sub="in last 12 months"
        />
        <StatTile
          label="Last upload"
          value={droughtLabel(stats.daysSinceLastUpload)}
        />
      </div>

      {/* Fluid layout: the grid fills whatever width the card gives it.
          Cells stay square because the outer grid carries `aspect-ratio:
          weekCount / 7` — this is slightly off-square due to gap-count
          asymmetry (52 column gaps vs 6 row gaps) but the deviation is
          well under 2% and not visually detectable. A min-width on the
          scroll wrapper guarantees cells stay legible on narrow
          viewports, where overflow-x-auto kicks in. */}
      <div className="p-5 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Month-label row — mirrors the main grid's column structure so
              each label sits over the week where the new month starts.
              The first column is a fixed-width spacer matching the day
              axis width. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `24px repeat(${weekCount}, minmax(0, 1fr))`,
              columnGap: "3px",
              marginBottom: "6px",
            }}
          >
            <div />
            {monthLabels.map((label, i) => (
              <div
                key={`m-${i}`}
                className="text-[10px] text-[var(--color-muted)] leading-none"
                // Labels are allowed to overflow their single-cell slot to
                // the right so "Mar" doesn't get clipped to "M".
                style={{ whiteSpace: "nowrap" }}
              >
                {label ?? ""}
              </div>
            ))}
          </div>

          <div className="flex gap-[3px] items-stretch">
            {/* Day-of-week axis — fixed width, height auto-stretches to
                match the main grid via `align-items: stretch`. The 7 row
                slots distribute evenly within whatever height the main
                grid ends up with. */}
            <div
              className="grid text-[10px] text-[var(--color-muted)] shrink-0"
              style={{
                width: "21px",
                gridTemplateRows: "repeat(7, minmax(0, 1fr))",
                rowGap: "3px",
              }}
            >
              {Array.from({ length: 7 }, (_, row) => (
                <div
                  key={`day-${row}`}
                  className="leading-none flex items-center"
                >
                  {DAY_ROW_LABELS[row] ?? ""}
                </div>
              ))}
            </div>

            {/* The grid itself: weekCount × 7, fully fluid. `flex: 1`
                claims all remaining horizontal space; `aspect-ratio`
                derives height from that width so cells stay roughly
                square. `grid-auto-flow: column` keeps the data array in
                chronological order while children flow top-to-bottom
                then left-to-right. */}
            <div
              className="grid flex-1 min-w-0"
              style={{
                gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))`,
                gridTemplateRows: "repeat(7, minmax(0, 1fr))",
                gridAutoFlow: "column",
                aspectRatio: `${weekCount} / 7`,
                gap: "3px",
              }}
            >
              {days.map((d) => {
                if (d.isFuture) {
                  return (
                    <div key={d.date} aria-hidden="true" />
                  );
                }
                if (!d.inWindow) {
                  return (
                    <div
                      key={d.date}
                      title={`${formatDate(d.date)} · outside window`}
                      className="rounded-[2px] border border-dashed border-[var(--color-border)]/50"
                    />
                  );
                }
                const fill = bucketFill(d.count);
                const title =
                  d.count === 0
                    ? `${formatDate(d.date)} · no uploads`
                    : `${formatDate(d.date)} · ${d.count} upload${
                        d.count === 1 ? "" : "s"
                      }${d.yt ? ` · ${d.yt} YT` : ""}${d.tt ? ` · ${d.tt} TT` : ""}`;
                return (
                  <div
                    key={d.date}
                    title={title}
                    className={`rounded-[2px] ${
                      d.count === 0 ? "border border-[var(--color-border)]" : ""
                    } ${d.isToday ? "ring-1 ring-[var(--color-fg)]/60" : ""}`}
                    style={
                      fill > 0
                        ? {
                            backgroundColor: `color-mix(in oklch, var(--color-accent) ${
                              fill * 100
                            }%, transparent)`,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
