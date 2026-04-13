# CLAUDE.md

Instructions for Claude Code when working in this repository.

## What this project is

A local-first Next.js dashboard for analyzing YouTube Shorts and TikTok
performance side by side. It reads from a SQLite database (read-only) and
renders career stats, video tables, crosspost comparisons, and hook
analysis. There is no backend API layer — pages query SQLite directly via
Next.js Server Components.

## Commands

```bash
pnpm dev        # start dev server at localhost:3000
pnpm build      # production build
pnpm start      # serve production build
pnpm typecheck  # tsc --noEmit — the only automated check
```

No test framework is installed. `pnpm typecheck` is the single
correctness signal. Run it after every change.

## Project structure

```
app/                  # Next.js App Router pages
  page.tsx            # Overview — stats, sparklines, leaderboards, calendar
  videos/page.tsx     # Sortable/filterable video table
  videos/[id]/page.tsx # Video detail — time series, transcript, hashtags
  hooks/page.tsx      # Opening-words analysis
  groups/page.tsx     # Crosspost head-to-head comparison
  layout.tsx          # Root layout with sidebar nav
  globals.css         # Tailwind v4 theme + CSS variables

components/           # React components (mix of server and client)
  nav.tsx             # Server wrapper — loads creator options from DB
  nav-client.tsx      # Client nav — sidebar, creator dropdown, links
  video-table.tsx     # Client — sortable video list with filters
  groups-table.tsx    # Client — crosspost group table
  hooks-table.tsx     # Client — hook ranking table with category insights
  career-band.tsx     # Client — cumulative views area chart (recharts)
  time-series-chart.tsx # Client — per-video metric line chart
  upload-calendar.tsx # Client — GitHub-style upload heatmap
  metric-card.tsx     # Server — stat card with sparkline
  metric-sparkline.tsx # Client — tiny inline sparkline
  crosspost-scoreboard.tsx # Server — YT vs TT win counter
  video-list-row.tsx  # Server — single video row
  platform-badge.tsx  # Server — YT/TT badge
  card.tsx            # Server — generic card wrapper
  odometer.tsx        # Client — animated number counter
  format.ts           # Pure functions — number/date/duration formatting

lib/                  # Shared utilities
  config.ts           # Branding constants (APP_NAME, SELF_LABEL, etc.)
  db.ts               # SQLite connection (read-only, singleton)
  queries.ts          # All data-fetching functions (~900 lines)
  hooks-util.ts       # Whisper transcript segment parsing for hooks
```

## Key conventions

- **TypeScript with `strict` + `noUncheckedIndexedAccess`.** Array and
  object index access needs explicit narrowing.
- **`@/*` path alias** maps to the project root (not a `src/` subdirectory).
- **Tailwind CSS v4** with `@tailwindcss/postcss`. Theme uses CSS custom
  properties defined in `globals.css` (e.g. `var(--color-bg)`). Platform
  colors: `--color-yt` for YouTube red, `--color-tt` for TikTok teal.
- **No `.env` file is required.** The only env var is the optional
  `SHORTS_DB_PATH` override in `lib/db.ts`. Everything else is in
  `lib/config.ts`.
- **Server Components by default.** Only add `"use client"` when the
  component needs interactivity (useState, useEffect, event handlers).
  Client components are: nav-client, video-table, groups-table,
  hooks-table, career-band, time-series-chart, upload-calendar,
  metric-sparkline, odometer.

## Database

The dashboard opens a **read-only** SQLite connection via better-sqlite3.
It never writes. The database path resolves in this order:

1. `SHORTS_DB_PATH` env var (if set)
2. `data/shorts.db` relative to cwd

### Schema the dashboard expects

- **`creator`** — channels/profiles. `is_self=1` marks the owner's
  channels; `is_self=0` marks external creators. The `handle` column
  (e.g. `@foo`) drives the creator-scope dropdown.
- **`video`** — one row per upload. `id` is prefixed: `yt:<platformId>`
  or `tt:<platformId>`. Has `creator_id` FK, `group_id` FK, `title`,
  `description`, `duration_sec`, `published_at`, `raw_json`.
- **`video_group`** — groups crossposted content. Every video has a
  `group_id`, including singletons.
- **`analytics_snapshot`** — time-series metrics. PK is
  `(video_id, snapshot_date, source)`. Columns: views, likes, comments,
  shares, saves, avg_view_duration_sec, watch_time_min, retention_pct.
- **`transcript`** — Whisper transcriptions. `segments_json` contains
  timestamped segments used by the hooks analysis.
- **`hashtag`** — `(video_id, tag)` pairs.
- **`video_fts`** — FTS5 table over title, description, transcript.

### Query patterns

All database queries live in `lib/queries.ts`. Every query function
accepts a `CreatorScope` to filter by owner (`is_self=1`) or external
handle. The scope flows from the `?creator=` URL search param, parsed by
`parseScope()`.

Metrics are merged from multiple snapshot sources (API vs CSV, owner vs
public) using `CASE WHEN source = ... THEN ...` logic inside the CTE at
the top of the queries file. Don't deduplicate `analytics_snapshot` rows
— the multi-source design is intentional.

## Branding / configuration

All user-facing brand strings live in `lib/config.ts`:

- `APP_NAME` — sidebar title
- `APP_TAGLINE` — sidebar subtitle
- `PAGE_TITLE` — browser tab title
- `SELF_LABEL` — label for the owner's content in the creator dropdown

If you need to add a new configurable string, put it in `config.ts` and
import it where needed. Don't hardcode display names in components.

## Adding a new page

1. Create `app/<route>/page.tsx` as a Server Component.
2. Accept `searchParams` and call `parseScope(sp)` to get the creator scope.
3. Query data via functions in `lib/queries.ts`.
4. Add a nav entry in the `items` array in `components/nav-client.tsx`.
5. If the page needs client interactivity, extract the interactive part
   into a separate `components/<name>.tsx` with `"use client"`.

## Adding a new query

Add the function to `lib/queries.ts`. Follow the existing pattern:
accept `CreatorScope` as the first argument, call `scopeClause(scope)`
to get the WHERE predicate + params, and use the `latestMetricsCTE()`
helper if you need merged analytics.
