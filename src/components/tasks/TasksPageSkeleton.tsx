function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function TasksFilterRowSkeleton() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 -mx-1">
      <Bone className="h-4 w-4 shrink-0 rounded-full" />
      <Bone className="h-8 w-20 shrink-0 rounded-full" />
      <Bone className="h-8 w-24 shrink-0 rounded-full" />
      <Bone className="h-8 w-20 shrink-0 rounded-full" />
      <Bone className="h-8 w-24 shrink-0 rounded-full" />
      <Bone className="h-8 w-16 shrink-0 rounded-full" />
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Bone className="mt-1 h-5 w-5 rounded-md" />
        <div className="min-w-0 flex-1 space-y-3">
          <Bone className="h-4 w-2/3" />
          <Bone className="h-4 w-1/3" />
          <div className="flex flex-wrap gap-2">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-6 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TasksContentSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:pb-4 md:py-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </main>
  );
}

export function TasksPageSkeleton() {
  return <TasksContentSkeleton />;
}