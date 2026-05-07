"use client";

import { AppHeader } from "@/components/AppHeader";
import { WeekViewSkeleton } from "@/components/tracker/WeekViewSkeleton";
import { getApp } from "@/lib/apps";

const trackerApp = getApp("tracker");

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <AppHeader app={trackerApp} />

      <div className="border-b border-border px-[var(--app-gutter-x)] py-3">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-hidden">
          <Bone className="h-9 w-20 rounded-full" />
          <Bone className="h-9 w-24 rounded-full" />
          <Bone className="h-9 w-20 rounded-full" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:pb-4 md:py-8 md:pb-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <WeekViewSkeleton />
        </div>
      </main>
    </div>
  );
}