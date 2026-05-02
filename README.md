# Dash.

An offline-first productivity dashboard with **Task Management** and **Time Tracking**. Works fully offline with optimistic UI, syncing to the cloud in the background.

## Features

**Tasks** — Offline-first task manager with subtasks, tags, due dates, priorities, smart filters, trash/restore, and responsive masonry layout.

**Time Tracker** — 7-day × 24-hour paint grid for logging time blocks, inline daily mood ratings (1–5), year activity heatmap, and year rating calendar. User-defined activity types with a color palette.

**Week Widgets** — Activity breakdown donut chart, mood insights with sleep correlation, daily stacked bars, sleep stats (avg/range/per-night chart), and productivity ratio bar.

**General** — Installable PWA, cross-device sync via PowerSync ↔ Supabase, dark theme, sync status indicator, production-safe logging.

## Tech Stack

Next.js 16 · PowerSync · Supabase · Tailwind CSS v4 · Shadcn/UI · Serwist

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + PowerSync keys
npm run dev -- --webpack
```

> Full setup instructions (Supabase, PowerSync, deployment, project structure) are in [SETUP.md](SETUP.md).
