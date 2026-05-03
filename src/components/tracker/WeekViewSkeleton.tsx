"use client";

import { cn } from "@/lib/utils";

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("bg-muted animate-pulse rounded", className)} style={style} />;
}

/** Skeleton for the ActivityToolbar row */
function ToolbarSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <Bone key={i} className="h-8 w-20 rounded-full shrink-0" />
      ))}
    </div>
  );
}

/** Skeleton for the TimeGrid table */
function TimeGridSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="border-separate border-spacing-0 w-max min-w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-muted px-1 py-2 w-[52px] border-r border-b border-border">
              <Bone className="h-3 w-8 mx-auto" />
            </th>
            <th className="sticky left-[52px] z-10 bg-muted px-3 py-2 min-w-[90px] border-r border-b border-border">
              <Bone className="h-3 w-10" />
            </th>
            {Array.from({ length: 24 }).map((_, h) => (
              <th key={h} className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[44px] border-l border-border">
                {String(h).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 7 }).map((_, row) => (
            <tr key={row} className="border-t border-border">
              <td className="sticky left-0 z-10 bg-muted px-1 py-1 border-r border-border w-[52px]">
                <Bone className="h-4 w-4 rounded-full mx-auto" />
              </td>
              <td className="sticky left-[52px] z-10 bg-muted px-3 py-2 border-r border-border">
                <Bone className="h-3 w-16" />
              </td>
              {Array.from({ length: 24 }).map((_, h) => (
                <td key={h} className="border-l border-border h-9 w-11">
                  {/* randomly fill ~20% of cells */}
                  {((row * 24 + h) * 7 + row) % 5 === 0 && (
                    <Bone className="h-full w-full rounded-none" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton for the widgets section */
function WidgetsSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Row 1: two small cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Bone className="h-3.5 w-3.5 rounded" />
            <Bone className="h-3 w-12" />
          </div>
          <div className="grid grid-cols-7 gap-1 items-end h-12">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bone key={i} className="rounded-sm" style={{ height: `${20 + ((i * 17) % 80)}%` }} />
            ))}
          </div>
          <div className="flex justify-between">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-10" />
          </div>
        </div>
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Bone className="h-3.5 w-3.5 rounded" />
            <Bone className="h-3 w-16" />
          </div>
          <div className="flex justify-center gap-2 py-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bone key={i} className="h-6 w-6 rounded-full" />
            ))}
          </div>
          <div className="flex justify-center">
            <Bone className="h-4 w-12" />
          </div>
        </div>
      </div>

      {/* Row 2: two medium cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Bone className="h-3.5 w-3.5 rounded" />
            <Bone className="h-3 w-14" />
          </div>
          <div className="flex justify-center py-2">
            <Bone className="h-52 w-52 rounded-full sm:h-60 sm:w-60" />
          </div>
        </div>
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Bone className="h-3.5 w-3.5 rounded" />
            <Bone className="h-3 w-10" />
          </div>
          <div className="grid grid-cols-7 gap-1 items-end h-36">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bone key={i} className="rounded-sm" style={{ height: `${30 + ((i * 23) % 70)}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: full-width card */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Bone className="h-3.5 w-3.5 rounded" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="h-7 w-full rounded-full" />
        <div className="flex gap-4">
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-14" />
          <Bone className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

export function WeekViewSkeleton() {
  return (
    <>
      <section>
        <ToolbarSkeleton />
      </section>
      <section>
        <TimeGridSkeleton />
      </section>
      <section className="mt-4">
        <WidgetsSkeleton />
      </section>
    </>
  );
}
