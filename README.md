# Dash.

An offline-first productivity dashboard with **Task Management**, **Time Tracking**, and a local-first **Notes** module. It works offline, applies optimistic UI locally, and syncs to the cloud in the background when connectivity returns.

## Docs

- [SETUP.md](SETUP.md) — environment setup, Supabase, PowerSync, and deployment
- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) — architecture, app structure, component map, and implementation notes for future contributors or coding agents

## Features

**Tasks** — Offline-first task manager with subtasks, tags, due dates, priorities, smart filters, trash/restore, responsive masonry layout, and direct save from the system share sheet.

**Time Tracker** — 7-day × 24-hour paint grid for logging time blocks, inline daily mood ratings (1–5), year activity heatmap, year rating calendar, and mobile-friendly week navigation with shared bottom FAB controls. User-defined activity types with a color palette.

**Notes** — Local-first PKM outliner with page and block editing, nested blocks, LexoRank ordering, inline `[[page]]` and `#tag` references, backlinks, and owned attachments routed through the shared shell.

**Week Widgets** — Activity breakdown donut chart, mood insights with sleep correlation, daily stacked bars, sleep stats (avg/range/per-night chart), and productivity ratio bar.

**General** — Installable PWA, web share target routed through `/share`, cross-device sync via PowerSync ↔ Supabase, sync status indicator, and production-safe logging.

## Tech Stack

Next.js 16 · PowerSync · Supabase · Tailwind CSS v4 · Shadcn/UI · Tiptap · Vitest · Serwist

## Quick Start

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, then fill in your Supabase and PowerSync values.

Optional validation:

```bash
npm run lint
npm test
npx tsc --noEmit
```

## Testing

Vitest is configured for fast logic-level coverage.

- `tests/notes/` contains notes-specific tests.
- `tests/tasks/` is reserved for task-specific tests.
- `tests/tracker/` is reserved for tracker-specific tests.
- `tests/shared/` contains reusable fixtures, builders, and assertions shared across app groups.

## How The Project Is Organized

- `src/app/` contains the App Router routes for launcher, tasks, tracker, notes, login, and share-target flows.
- `src/components/` contains shared shell UI plus app-specific task, tracker, and notes components.
- `src/lib/shared/`, `src/lib/tasks/`, `src/lib/tracker/`, and `src/lib/notes/` group shared and app-owned helpers by responsibility.
- `src/lib/powersync/` contains the local SQLite schema, database bootstrap, and sync connector.
- `tests/` contains Vitest suites grouped by app plus shared test helpers.
- `SETUP.md` contains the SQL you need to create the hosted Supabase schema and PowerSync stream configuration.

> For a deeper map of how tasks, tracker, share capture, optimistic updates, route loading, and PowerSync fit together, read [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).
> For environment setup and deployment, read [SETUP.md](SETUP.md).
