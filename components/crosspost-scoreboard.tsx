import Link from "next/link";
import { Layers } from "lucide-react";
import { Odometer } from "./odometer";

// "YouTube vs TikTok head-to-head" scoreboard tile. Shows two big numbers
// — wins for each platform on matched crosspost groups — with a tiny
// split bar underneath. Links into the Crossposts page for the full
// leaderboard.
export function CrosspostScoreboard({
  ytWins,
  ttWins,
  href = "/groups",
}: {
  ytWins: number;
  ttWins: number;
  href?: string;
}) {
  const total = ytWins + ttWins;
  const ytPct = total > 0 ? (ytWins / total) * 100 : 50;
  const winner =
    ytWins > ttWins ? "youtube" : ttWins > ytWins ? "tiktok" : null;

  return (
    <Link
      href={href}
      className="group block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 hover:border-[var(--color-accent)]/60 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Head-to-head
        </div>
        <Layers size={14} className="text-[var(--color-muted)]" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div
            className={`text-4xl font-semibold tabular leading-none ${
              winner === "youtube"
                ? "text-[var(--color-youtube)]"
                : "text-[var(--color-fg)]"
            }`}
          >
            <Odometer value={ytWins} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mt-1.5">
            YouTube
          </div>
        </div>
        <div className="text-xl font-medium text-[var(--color-muted)] pb-1">
          vs
        </div>
        <div className="text-right">
          <div
            className={`text-4xl font-semibold tabular leading-none ${
              winner === "tiktok"
                ? "text-[var(--color-tiktok)]"
                : "text-[var(--color-fg)]"
            }`}
          >
            <Odometer value={ttWins} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mt-1.5">
            TikTok
          </div>
        </div>
      </div>

      {/* Win-share bar */}
      <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-[var(--color-border)]/50">
        <div className="h-full flex">
          <div
            className="h-full bg-[var(--color-youtube)]"
            style={{ width: `${ytPct}%` }}
          />
          <div
            className="h-full bg-[var(--color-tiktok)]"
            style={{ width: `${100 - ytPct}%` }}
          />
        </div>
      </div>
      <div className="mt-2 text-[11px] text-[var(--color-muted)]">
        same ideas, different platforms · {total} head-to-head matchups
      </div>
    </Link>
  );
}
