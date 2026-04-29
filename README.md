# Tasks.

A modern, offline-first task manager built as a Progressive Web App (PWA). Manage your tasks with subtasks, priorities, tags, and due dates — all with a buttery smooth, optimistic UI that works seamlessly offline.

## Features

- **Offline-First Architecture**: Built on [PowerSync](https://powersync.co/) and SQLite for instant local-first reactivity with background cloud sync via Supabase.
- **PWA Ready**: Installable on any device, works fully offline with service worker caching via `@serwist/next`.
- **Optimistic UI**: All interactions — task creation, subtask additions, state changes, and deletions — update instantly with smooth transitions and zero jank.
- **Smart Filtering**: Flat, pill-based multi-select filters for State (Pending, Completed, Trashed), Priority (Low, Medium, High, Urgent), and Tags.
- **Masonry Layout**: Responsive multi-column CSS masonry grid that adapts from 1 to 3 columns based on screen width.
- **Subtasks**: Inline subtask creation with optimistic rendering. Completed subtasks stay visible with a strikethrough style.
- **Tagging System**: Create tags inline from task cards, assign random colors, and manage tag colors via a dedicated dialog with a visual palette picker.
- **Dynamic Due Dates**: Color-coded "Overdue", "Due Today", and countdown pills that update automatically.
- **Priorities**: Four priority levels with color-coded traffic-light indicators (Low → Blue, Medium → Amber, High → Orange, Urgent → Red).
- **Pagination**: 10 tasks per page with chevron-based navigation.
- **Sync Indicator**: Real-time sync status light — green (synced), orange (syncing), red (offline).
- **Trash & Restore**: Trashed tasks are locked from editing with a subtle rose tint. Restore or permanently delete.
- **Auth Gate**: Supabase email/password authentication protects the app on public deployments.
- **Dark/Light Mode**: Full theme support with matte-pastel color palette tuned for both modes.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database/Sync**: PowerSync (Local SQLite) + Supabase (Cloud Postgres)
- **Auth**: Supabase Auth (email/password)
- **Styling**: Tailwind CSS
- **Components**: Shadcn/UI & Lucide React Icons
- **PWA**: `@serwist/next`
- **Date Handling**: `date-fns`

---

## Setup Guide

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and note your **Project URL** and **Publishable API Key**
3. Go to **SQL Editor** and run:

```sql
-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT,
  due_date TEXT,
  tags TEXT DEFAULT '[]',
  priority TEXT DEFAULT 'medium',
  state TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'slate',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Publication for PowerSync
CREATE PUBLICATION powersync FOR TABLE public.tasks, public.tags;
```

4. Go to **Authentication → Users → Add User** to create your account

### 2. PowerSync Cloud

1. Sign up at [powersync.com](https://www.powersync.com/)
2. Create a new instance and connect it to your Supabase project (use your Supabase **Database Connection String** from **Settings → Database**)
3. Set sync streams in the PowerSync dashboard:

```yaml
config:
  edition: 3
streams:
  user_data:
    auto_subscribe: true
    queries:
      - SELECT * FROM tasks WHERE tasks.user_id = auth.user_id()
      - SELECT * FROM tags WHERE tags.user_id = auth.user_id()
```

4. Note your **PowerSync Instance URL**

### 3. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...your-publishable-key
   NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Production build (for testing PWA/service worker):
   ```bash
   npm run build
   npm run start
   ```

### 4. Deploy to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Add the three environment variables under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_POWERSYNC_URL`
4. Deploy — Vercel auto-detects Next.js and builds it
5. Your app is now live behind the Supabase auth gate

> **Note**: Make sure your Supabase project's **Authentication → URL Configuration → Site URL** is set to your Vercel deployment URL (e.g., `https://your-app.vercel.app`).

---

## Project Structure

| Path | Description |
|------|-------------|
| `src/app/page.tsx` | Main dashboard with filters, pagination, and task grid |
| `src/app/login/page.tsx` | Login page with Supabase auth |
| `src/app/layout.tsx` | Root layout with theme and PowerSync providers |
| `src/middleware.ts` | Auth middleware protecting all routes |
| `src/components/TaskCard.tsx` | Task card with inline editing, subtasks, tags, and optimistic state |
| `src/components/ManageTagsDialog.tsx` | Tag CRUD dialog with color palette picker |
| `src/components/SyncIndicator.tsx` | Real-time sync status indicator |
| `src/lib/tasks.ts` | Shared utilities (auth, priority colors, date logic) |
| `src/lib/colors.ts` | Centralized color utilities for tags |
| `src/lib/powersync/AppSchema.ts` | SQLite schema definitions for tasks and tags |
| `src/lib/powersync/SupabaseConnector.ts` | PowerSync ↔ Supabase sync connector |
| `public/manifest.json` | PWA manifest |

## Schema

Tasks and Tags are defined in `src/lib/powersync/AppSchema.ts`. When connecting a Supabase backend, ensure your Postgres schema mirrors the local SQLite schema, including the `tags` table and proper Row Level Security (RLS) policies.
