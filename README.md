# Dash.

An offline-first productivity dashboard with **Task Management** and **Time Tracking**. It works offline, applies optimistic UI locally, and syncs to the cloud in the background when connectivity returns.

## Features

**Tasks** — Offline-first task manager with subtasks, tags, due dates, priorities, smart filters, trash/restore, responsive masonry layout, and direct save from the system share sheet.

**Time Tracker** — 7-day × 24-hour paint grid for logging time blocks, inline daily mood ratings (1–5), year activity heatmap, year rating calendar, and mobile-friendly week navigation with shared bottom FAB controls. User-defined activity types with a color palette.

**Week Widgets** — Activity breakdown donut chart, mood insights with sleep correlation, daily stacked bars, sleep stats (avg/range/per-night chart), and productivity ratio bar.

**General** — Installable PWA, web share target routed through `/share`, cross-device sync via PowerSync ↔ Supabase, sync status indicator, and production-safe logging.

## Tech Stack

Next.js 16 · PowerSync · Supabase · Tailwind CSS v4 · Shadcn/UI · Serwist

## Quick Start

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, then fill in your Supabase and PowerSync values.

Optional validation:

```bash
npm run lint
npx tsc --noEmit
```

> Full setup instructions (Supabase, PowerSync, deployment, project structure) are in [SETUP.md](SETUP.md).
