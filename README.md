# Offline-First Todo App

A production-grade, offline-first Todo Progressive Web App (PWA) built with cutting-edge web technologies.

## Features

- **Offline-First Architecture**: Built on top of [PowerSync](https://powersync.co/) and SQLite, ensuring that all data mutations are perfectly handled offline and reactively synced.
- **PWA Ready**: Works offline, installable on mobile devices, and handles offline caching gracefully via `@serwist/next`.
- **Masonry Layout Engine**: A dynamic, multi-column CSS masonry layout that effortlessly adapts to any screen size without Javascript recalculations.
- **Advanced Task Metadata**: Support for Subtasks, dynamic "Due By" pill indicators, and custom priority levels (Low, Medium, High, Urgent).
- **Tagging System**: Predefined tagging system with dynamic coloring, fully managed via an embedded database-driven tag selector.
- **Sleek Theming**: First-class support for dark/light modes powered by Next-Themes and a custom Indigo/Violet Shadcn color scheme.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database/Sync**: PowerSync (Local SQLite Reactivity)
- **Styling**: Tailwind CSS
- **Components**: Shadcn/UI & Lucide React Icons
- **PWA Support**: `@serwist/next`
- **Date Handling**: `date-fns`

## Local Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file with the necessary Supabase and PowerSync keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_POWERSYNC_URL=...
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

4. **Production Build (PWA Service Worker Generation)**
   *Note: Next.js dev server does not robustly test PWA service workers. You must build to test caching.*
   ```bash
   npm run build
   npm run start
   ```

## Development Context

### Schema Setup
Tags and Tasks are defined logically in `src/lib/powersync/AppSchema.ts`. Note that when attaching the cloud Supabase backend to this project, you must ensure your Supabase schema mimics the local one, including the `tags` table and proper Row Level Security (RLS) policies.
