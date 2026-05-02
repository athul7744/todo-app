# Setup Guide

## Architecture

```mermaid
graph LR
    User([User]) <--> UI[Next.js UI]
    UI <--> SQLite[(Local SQLite)]
    SQLite <--> PS[PowerSync Sync Engine]
    PS <--> SB[(Supabase / Postgres)]

    subgraph Browser
        UI
        SQLite
        PS
    end

    subgraph Cloud
        SB
    end
```

**How it works:**
1. The app reads/writes directly to a local SQLite database (via WASM in the browser)
2. PowerSync streams changes bidirectionally between local SQLite and Supabase Postgres
3. The service worker caches all app assets so the UI and database logic load without internet
4. CRUD uploads are throttled (2s debounce) to batch rapid edits into fewer network calls

---

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Note your **Project URL** and **Publishable API Key** from **Settings → API**
3. Run in **SQL Editor** (or apply the migrations from `supabase/migrations/`):

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

-- Time logs table (hourly time tracking blocks)
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  start_timestamp TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, start_timestamp)
);

-- Activity types table (user-defined activity categories)
CREATE TABLE public.activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own time_logs" ON public.time_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own activity_types" ON public.activity_types
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_time_logs_user_start ON time_logs (user_id, start_timestamp);

-- Publication for PowerSync replication
CREATE PUBLICATION powersync FOR TABLE public.tasks, public.tags, public.time_logs, public.activity_types;
```

4. Go to **Authentication → Users → Add User** to create your account

5. **Prevent WAL storage buildup** — cap replication slot WAL retention so a disconnected PowerSync client can't fill the disk. Requires the [Supabase CLI](https://supabase.com/docs/guides/resources/supabase-cli):

   ```bash
   supabase --experimental \
     --project-ref <your-project-ref> \
     postgres-config update --config max_slot_wal_keep_size=1GB

   supabase --experimental \
     --project-ref <your-project-ref> \
     postgres-config update --config max_wal_size=1GB
   ```

## 2. PowerSync

1. Sign up at [powersync.com](https://www.powersync.com/)
2. Create an instance and connect it to your Supabase database
3. Configure sync streams:

```yaml
config:
  edition: 3
streams:
  user_data:
    auto_subscribe: true
    queries:
      - SELECT * FROM tasks WHERE tasks.user_id = auth.user_id()
      - SELECT * FROM tags WHERE tags.user_id = auth.user_id()
      - SELECT * FROM time_logs WHERE time_logs.user_id = auth.user_id()
      - SELECT * FROM activity_types WHERE activity_types.user_id = auth.user_id()
```

4. Note your **PowerSync Instance URL**

## 3. Local Development

```bash
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...your-publishable-key
NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
```

```bash
npm run dev          # Development
npm run build && npm run start  # Production (tests PWA/service worker)
```

## 4. Deploy to Vercel

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com) → **Add New Project**
3. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_POWERSYNC_URL`
4. Deploy

> Set your Supabase **Authentication → URL Configuration → Site URL** to your Vercel URL.

---

## Project Structure

| Path | Description |
|------|-------------|
| **App Routes** | |
| `src/app/page.tsx` | Tasks dashboard with filters, pagination, and task grid |
| `src/app/tracker/page.tsx` | Time Tracker with 24-hour paint grid |
| `src/app/login/page.tsx` | Login page |
| `src/app/layout.tsx` | Root layout with theme and PowerSync providers |
| **Shared Components** | |
| `src/components/AppHeader.tsx` | Shared header with app switcher, theme toggle, sync, logout |
| `src/components/AppSwitcher.tsx` | Popover for switching between apps |
| `src/components/SyncIndicator.tsx` | Sync status indicator with reconnect/reset |
| **Task Components** | |
| `src/components/tasks/TaskCard.tsx` | Task card with inline editing, subtasks, tags, optimistic state |
| `src/components/tasks/ManageTagsDialog.tsx` | Tag CRUD dialog |
| **Tracker Components** | |
| `src/components/tracker/ActivityToolbar.tsx` | Activity selector toolbar with eraser |
| `src/components/tracker/TimeGrid.tsx` | 7-day × 24-hour grid matrix |
| `src/components/tracker/ManageActivitiesDialog.tsx` | Activity type CRUD dialog |
| **Lib** | |
| `src/lib/apps.ts` | App registry (id, name, route, icon, accent colors) |
| `src/lib/auth.ts` | `getCurrentUserId()` with session caching |
| `src/lib/activities.ts` | Activity color palettes and Tailwind class maps |
| `src/lib/colors.ts` | Tag color palettes and Tailwind class maps |
| `src/lib/tags.ts` | Shared `createTag()` helper |
| `src/lib/tasks.ts` | Priority definitions, due date helpers |
| `src/lib/debounced-update.ts` | Debounced DB writes (field merge + batch) |
| `src/lib/utils.ts` | `cn()`, `formatRelativeTime()`, `autoResizeTextarea()` |
| **PowerSync** | |
| `src/lib/powersync/AppSchema.ts` | Local SQLite schema (tasks, tags, time_logs, activity_types) |
| `src/lib/powersync/SupabaseConnector.ts` | PowerSync ↔ Supabase connector |
| `src/lib/powersync/db.ts` | Database init and connection config |
