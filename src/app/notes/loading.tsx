"use client";

import { AppHeader } from "@/components/AppHeader";
import { getApp } from "@/lib/apps";

const notesApp = getApp("notes");

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <AppHeader app={notesApp} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:pb-4 md:py-8 md:pb-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <div className="space-y-3 rounded-3xl border border-border bg-card/70 p-4">
              <Bone className="h-4 w-24" />
              <Bone className="h-10 w-full rounded-2xl" />
              <Bone className="h-10 w-5/6 rounded-2xl" />
              <Bone className="h-10 w-4/6 rounded-2xl" />
            </div>
            <div className="space-y-4 rounded-3xl border border-border bg-card/70 p-4">
              <Bone className="h-28 w-full rounded-2xl" />
              <Bone className="h-5 w-40" />
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-5/6" />
              <Bone className="h-4 w-3/4" />
            </div>
            <div className="hidden space-y-3 rounded-3xl border border-border bg-card/70 p-4 xl:block">
              <Bone className="h-4 w-32" />
              <Bone className="h-16 w-full rounded-2xl" />
              <Bone className="h-16 w-full rounded-2xl" />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}