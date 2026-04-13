# shorts-dash

A local dashboard for analyzing YouTube Shorts and TikTok performance side by side. Built with Next.js 15, React 19, and SQLite.

![Stack](https://img.shields.io/badge/Next.js_15-black?logo=nextdotjs) ![Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black) ![Stack](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white) ![Stack](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)

## What it does

- **Overview** &mdash; career stats, metric sparklines, upload calendar, top/bottom leaderboards
- **Videos** &mdash; sortable/filterable table of every video with views, likes, comments, shares, engagement rate
- **Hooks** &mdash; ranks the opening words of every video against each other so you can see which openers perform best
- **Crossposts** &mdash; groups the same content across YouTube and TikTok and shows head-to-head performance

Everything runs locally. The dashboard opens a read-only connection to a SQLite database &mdash; no external APIs, no accounts, no telemetry.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Place your database
cp /path/to/your-database.db data/shorts.db

# 3. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Using an external database path

If you don't want to copy the database into the project, set the `SHORTS_DB_PATH` environment variable:

```bash
SHORTS_DB_PATH=/path/to/your-database.db pnpm dev
```

## Configuration

Edit `lib/config.ts` to customize branding:

```ts
export const APP_NAME = "shorts-dash";      // sidebar brand
export const APP_TAGLINE = "shorts intelligence"; // sidebar subtitle
export const PAGE_TITLE = `${APP_NAME} // ${APP_TAGLINE}`; // browser tab
export const SELF_LABEL = "My Channel";      // label for your own content
```

## Expected database schema

The dashboard expects a SQLite database with these tables:

| Table | Purpose |
|---|---|
| `creator` | Channels/profiles. `is_self=1` for your own, `0` for others you're studying. |
| `video` | One row per upload. `id` is prefixed (`yt:<id>` or `tt:<id>`). |
| `video_group` | Groups crossposted content (same video on both platforms). |
| `analytics_snapshot` | Time-series metrics &mdash; views, likes, comments, shares, retention, watch time. PK is `(video_id, snapshot_date, source)`. |
| `transcript` | Whisper transcriptions with `segments_json` for the hooks analysis. |
| `hashtag` | Tags extracted from titles/descriptions. |
| `video_fts` | FTS5 full-text search over title, description, and transcript. |

See the full schema in the project this was extracted from, or inspect your database with `sqlite3 data/shorts.db ".schema"`.

## Scripts

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm start      # serve production build
pnpm typecheck  # run tsc --noEmit
```

## License

MIT
