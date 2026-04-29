# Tasks.

A modern, offline-first task manager built as a Progressive Web App (PWA). Manage your tasks with subtasks, priorities, tags, and due dates — all with a buttery smooth, optimistic UI that works seamlessly offline.

## Features

- **Offline-First Architecture**: Built on [PowerSync](https://powersync.co/) and SQLite for instant local-first reactivity with background cloud sync via Supabase.
- **PWA Ready**: Installable on any device, works fully offline with service worker caching via `@serwist/next`.
- **Optimistic UI**: All interactions — task creation, subtask additions, state changes, and deletions — update instantly with smooth transitions and zero jank.
- **Smart Filtering**: Flat, pill-based multi-select filters for State (Pending, Completed, Trashed), Priority (Low, Medium, High, Urgent), and Tags — all in a single horizontally scrollable row.
- **Masonry Layout**: Responsive multi-column CSS masonry grid that adapts from 1 to 3 columns based on screen width.
- **Subtasks**: Inline subtask creation with optimistic rendering. Completed subtasks stay visible with a strikethrough style.
- **Tagging System**: Create tags inline from task cards, assign random colors, and manage tag colors via a dedicated dialog with a visual palette picker.
- **Dynamic Due Dates**: Color-coded "Overdue", "Due Today", and countdown pills that update automatically.
- **Priorities**: Four priority levels with color-coded traffic-light indicators (Low → Blue, Medium → Amber, High → Orange, Urgent → Red).
- **Pagination**: 10 tasks per page with chevron-based navigation.
- **Dark/Light Mode**: Full theme support with matte-pastel color palette tuned for both modes.
- **Permanent Deletion**: Trashed tasks can be permanently deleted from the database.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database/Sync**: PowerSync (Local SQLite) + Supabase (Cloud Postgres)
- **Styling**: Tailwind CSS
- **Components**: Shadcn/UI & Lucide React Icons
- **PWA**: `@serwist/next`
- **Date Handling**: `date-fns`

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   NEXT_PUBLIC_POWERSYNC_URL=...
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm run start
   ```

## Project Structure

| Path | Description |
|------|-------------|
| `src/app/page.tsx` | Main dashboard with filters, pagination, and task grid |
| `src/app/layout.tsx` | Root layout with theme and PowerSync providers |
| `src/components/TaskCard.tsx` | Task card with inline editing, subtasks, tags, and optimistic state |
| `src/components/ManageTagsDialog.tsx` | Tag CRUD dialog with color palette picker |
| `src/lib/colors.ts` | Centralized color utilities for tags, priorities, and states |
| `src/lib/powersync/AppSchema.ts` | SQLite schema definitions for tasks and tags |
| `src/lib/powersync/db.ts` | PowerSync database initialization |
| `public/manifest.json` | PWA manifest |

## Schema

Tags and Tasks are defined in `src/lib/powersync/AppSchema.ts`. When connecting a Supabase backend, ensure your Postgres schema mirrors the local SQLite schema, including the `tags` table and proper Row Level Security (RLS) policies.
