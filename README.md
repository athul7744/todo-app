# Tasks.

An offline-first productivity PWA with **Task Management** and **Time Tracking**. Works fully offline with optimistic UI, syncing to the cloud in the background.

## Features

**Tasks** — Offline-first task manager with subtasks, tags, due dates, priorities, smart filters, trash/restore, and responsive masonry layout.

**Time Tracker** — 7-day × 24-hour paint grid for logging time blocks. User-defined activity types with a 10-color palette.

**General** — Installable PWA, cross-device sync via PowerSync ↔ Supabase, dark/light mode, sync status indicator.

## Tech Stack

Next.js 16 · PowerSync · Supabase · Tailwind CSS · Shadcn/UI · Serwist

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + PowerSync keys
npm run dev
```

> Full setup instructions (Supabase, PowerSync, deployment, project structure) are in [SETUP.md](SETUP.md).
