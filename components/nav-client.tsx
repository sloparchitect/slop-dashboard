"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Film, Layers, Sparkles } from "lucide-react";
import type { CreatorOption } from "@/lib/queries";
import { APP_NAME, APP_TAGLINE, SELF_LABEL } from "@/lib/config";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: Film },
  { href: "/hooks", label: "Hooks", icon: Sparkles },
  { href: "/groups", label: "Crossposts", icon: Layers },
];

// The selection state lives entirely in the URL (`?creator=...`), so that
// bookmarks, server components, and refreshes all agree. This component
// reads it on every render and writes it via router.push() on change.
// There's no local `useState` to fall out of sync with the URL.
export function NavClient({ creators }: { creators: CreatorOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentValue = searchParams.get("creator") ?? "self";
  const currentOption = creators.find((c) => c.value === currentValue);

  // Build hrefs for the top-level nav links that carry the current scope
  // forward. Without this, clicking "Videos" from an external-creator view
  // would drop the filter and snap back to the default self scope.
  const buildHref = (href: string): string => {
    if (currentValue === "self") return href;
    const qs = new URLSearchParams({ creator: currentValue });
    return `${href}?${qs.toString()}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    const qs = new URLSearchParams();
    if (value !== "self") qs.set("creator", value);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    router.push(`${pathname}${suffix}`);
  };

  const mine = creators.filter((c) => c.kind === "self");
  const externals = creators.filter((c) => c.kind === "external");

  return (
    <nav className="shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 lg:w-56 lg:py-8">
      {/* Top row: brand + creator selector (horizontal on small, stacked on large) */}
      <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-0">
        <div className="lg:mb-8 lg:px-2">
          <div className="text-lg font-semibold tracking-tight leading-tight">
            {APP_NAME}
            <span className="text-[var(--color-accent)]"> //</span>
          </div>
          <div className="hidden lg:block text-xs text-[var(--color-muted)] mt-0.5">
            {APP_TAGLINE}
          </div>
        </div>

        {/* Creator scope selector */}
        <div className="lg:mb-6 lg:px-2">
          <label
            htmlFor="creator-select"
            className="hidden lg:block text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-1.5"
          >
            Creator
          </label>
          <select
            id="creator-select"
            value={currentValue}
            onChange={handleChange}
            className="text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-accent)] transition-colors lg:w-full"
          >
            <optgroup label="Mine">
              {mine.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
            {externals.length > 0 && (
              <optgroup label="Others">
                {externals.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {currentOption?.sub && (
            <div className="hidden lg:block mt-1.5 text-[11px] text-[var(--color-muted)] truncate">
              {currentOption.sub}
            </div>
          )}
        </div>

        {/* Spacer pushes nav links to the right on small screens */}
        <div className="flex-1 lg:hidden" />

        <ul className="flex items-center gap-1 lg:flex-col lg:items-stretch lg:space-y-1 lg:gap-0">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={buildHref(item.href)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 lg:px-3 lg:py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-[var(--color-border)]/60 text-[var(--color-fg)]"
                      : "hover:bg-[var(--color-border)]/40"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline lg:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
