import type { Platform } from "@/lib/queries";

export function PlatformBadge({ platform }: { platform: Platform }) {
  const config =
    platform === "youtube"
      ? { label: "YouTube", color: "var(--color-youtube)" }
      : { label: "TikTok", color: "var(--color-tiktok)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        borderColor: config.color,
        color: config.color,
        backgroundColor: `color-mix(in oklch, ${config.color} 12%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
