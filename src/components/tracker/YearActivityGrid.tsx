"use client";

import { useQuery } from "@powersync/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfYear, endOfYear, eachDayOfInterval, getMonth, isEqual, startOfDay } from "date-fns";
import { Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActivityDotClass } from "@/lib/activities";
import { TimeLog, ActivityType } from "@/lib/powersync/AppSchema";
import { COLOR_HEX } from "./widgets/types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface YearActivityGridProps {
  year: number;
  onDayClick?: (date: Date) => void;
  /** Optional element rendered to the left of the activity filter toolbar */
  headerLeft?: React.ReactNode;
}

export function YearActivityGrid({ year, onDayClick, headerLeft }: YearActivityGridProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!selectedDay) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Don't close if clicking on a table row (row click handler manages toggle)
        const target = e.target as HTMLElement;
        if (target.closest("tr[data-date]")) return;
        setSelectedDay(null);
        setPopoverPos(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedDay]);

  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'00:00:00'+00:00'");
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'23:59:59'+00:00'");

  const { data: activityTypes, isLoading: loadingTypes } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  const { data: logs, isLoading: loadingLogs } = useQuery<TimeLog & { id: string }>(
    `SELECT activity_name, start_timestamp FROM time_logs
     WHERE start_timestamp >= ? AND start_timestamp <= ?
     ORDER BY start_timestamp ASC`,
    [yearStart, yearEnd]
  );

  const colorMap = useMemo(
    () => Object.fromEntries(activityTypes.map((a) => [a.name, a.color ?? "teal"])),
    [activityTypes]
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, { color: string; activity: string }>();
    for (const log of logs) {
      const ts = new Date(log.start_timestamp!);
      const dateKey = ts.toISOString().slice(0, 10);
      const hourKey = String(ts.getUTCHours()).padStart(2, "0");
      const color = colorMap[log.activity_name ?? ""] ?? "teal";
      map.set(`${dateKey}|${hourKey}`, { color, activity: log.activity_name ?? "" });
    }
    return map;
  }, [logs, colorMap]);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) }),
    [year]
  );

  // Build legend: unique activities that appear in data
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const { activity, color } of cellMap.values()) {
      if (activity && !seen.has(activity)) seen.set(activity, color);
    }
    return Array.from(seen.entries()).map(([name, colorKey]) => ({ name, colorKey, hex: COLOR_HEX[colorKey] || "#6b7280" }));
  }, [cellMap]);

  // Day summary for selected day
  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    const activities: Record<string, { count: number; hex: string }> = {};
    for (let h = 0; h < 24; h++) {
      const key = `${dateKey}|${String(h).padStart(2, "0")}`;
      const cell = cellMap.get(key);
      if (cell) {
        if (!activities[cell.activity]) {
          activities[cell.activity] = { count: 0, hex: COLOR_HEX[cell.color] || "#6b7280" };
        }
        activities[cell.activity].count++;
      }
    }
    const totalHours = Object.values(activities).reduce((s, a) => s + a.count, 0);
    return { dateKey, totalHours, activities };
  }, [selectedDay, cellMap]);

  if (loadingTypes || loadingLogs) {
    return (
      <div className="space-y-3">
        {/* Header skeleton: year selector + activity pills */}
        <div className="flex items-start gap-3">
          {headerLeft}
          <div className="overflow-x-auto flex-1">
            <div className="flex flex-col gap-1.5 py-1">
              <div className="flex items-center gap-1.5 w-max">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                ))}
              </div>
              <div className="flex items-center gap-1.5 w-max">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 w-18 rounded-full bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)] p-1">
            <table className="border-separate border-spacing-[1px] text-[10px] w-full table-fixed">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-card px-1 py-1.5 w-[40px]">
                    <div className="h-2.5 w-7 bg-muted rounded animate-pulse" />
                  </th>
                  {HOURS.map((h) => (
                    <th key={h} className="px-0 py-1.5 text-center font-medium text-muted-foreground/60 w-[14px]">
                      {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 28 }).map((_, row) => (
                  <tr key={row}>
                    <td className="sticky left-0 z-10 bg-card px-1 py-0 w-[40px]">
                      <div className="h-2.5 w-8 bg-muted rounded animate-pulse" />
                    </td>
                    {HOURS.map((_, h) => (
                      <td key={h} className="p-0">
                        <div className={cn(
                          "h-[12px] w-[12px] rounded-[3px]",
                          ((row * 24 + h) * 13 + row) % 6 === 0 ? "bg-muted animate-pulse" : "bg-muted/30"
                        )} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Grid3X3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No activity data for {year}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Activity filter toolbar - two rows like week view, with headerLeft */}
      <div className="flex items-start gap-3">
        {headerLeft}
        <div className="overflow-x-auto flex-1">
          <div className="flex flex-col gap-1.5 py-1">
            {[legend.slice(0, Math.ceil(legend.length / 2)), legend.slice(Math.ceil(legend.length / 2))].map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-1.5 w-max">
                {row.map((item) => {
                  const isActive = activeFilter === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveFilter(isActive ? null : item.name)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                        isActive
                          ? "shadow-sm ring-1 ring-foreground/20 text-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      style={isActive ? { backgroundColor: `color-mix(in srgb, ${item.hex} 25%, transparent)` } : undefined}
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", getActivityDotClass(item.colorKey))} />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS-based filter for instant highlighting (no per-cell re-render) */}
      <style>{`
        .activity-grid .activity-cell[data-activity]:hover {
          transform: scale(1.5);
          z-index: 10;
          box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 20%, transparent);
          border-radius: 2px;
          cursor: default;
        }
        ${activeFilter ? `
        .activity-grid .activity-cell[data-activity] {
          opacity: 0.15 !important;
        }
        .activity-grid .activity-cell[data-activity="${CSS.escape(activeFilter)}"] {
          opacity: 1 !important;
        }
        ` : ""}
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: none; }
        }
        ${selectedDay ? `
        .activity-grid tr[data-date="${format(selectedDay, "yyyy-MM-dd")}"] {
          background: color-mix(in srgb, var(--foreground) 8%, transparent);
        }
        .activity-grid tr[data-date="${format(selectedDay, "yyyy-MM-dd")}"] td:first-child {
          color: var(--foreground) !important;
          font-weight: 700 !important;
        }
        ` : ""}
      `}</style>

      {/* Day popover */}
      {daySummary && selectedDay && popoverPos && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[240px] rounded-lg border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            top: popoverPos.y,
            left: popoverPos.x,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-sm font-semibold text-foreground">{format(selectedDay, "EEE, MMM d")}</span>
            <button
              onClick={() => { setSelectedDay(null); setPopoverPos(null); }}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <div className="px-3 pb-1.5">
            <span className="text-xs text-muted-foreground">{daySummary.totalHours}h logged</span>
          </div>
          {/* Activity list */}
          <div className="px-3 max-h-[120px] overflow-y-auto space-y-1.5 pb-2">
            {Object.entries(daySummary.activities).map(([name, { count, hex }]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                <span className="text-foreground flex-1 truncate">{name}</span>
                <span className="text-muted-foreground font-medium">{count}h</span>
                <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ backgroundColor: hex, width: `${(count / 24) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {/* Edit button */}
          <div className="border-t border-border px-3 py-2">
            <button
              onClick={() => { onDayClick?.(selectedDay); setSelectedDay(null); setPopoverPos(null); }}
              className="w-full text-xs font-medium py-1.5 rounded bg-accent text-foreground hover:bg-accent/80 transition-colors"
            >
              Edit day
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="activity-grid rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)] p-1">
          <table className="border-separate border-spacing-[1px] text-[10px] w-full table-fixed">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-card px-1 py-1.5 text-left font-semibold text-muted-foreground/70 w-[40px]" />
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="px-0 py-1.5 text-center font-medium text-muted-foreground/60 w-[14px]"
                  >
                    {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allDays.map((day, rowIdx) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const isFirstOfMonth = day.getDate() === 1;
                const monthIdx = getMonth(day);

                const isSelected = selectedDay && isEqual(startOfDay(day), startOfDay(selectedDay));

                return (
                  <tr
                    key={dateKey}
                    data-date={dateKey}
                    className={cn(
                      "animate-[fadeInRow_0.3s_ease-out_both] cursor-pointer transition-colors",
                      isSelected && "rounded"
                    )}
                    style={{ animationDelay: `${Math.min(rowIdx * 3, 300)}ms` }}
                    onClick={(e) => {
                      if (isSelected) {
                        setSelectedDay(null);
                        setPopoverPos(null);
                      } else {
                        setSelectedDay(day);
                        // Position popover near click, clamped to viewport
                        const x = Math.min(e.clientX + 8, window.innerWidth - 256);
                        const y = Math.min(e.clientY - 20, window.innerHeight - 260);
                        setPopoverPos({ x: Math.max(8, x), y: Math.max(8, y) });
                      }
                    }}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 bg-card px-1 py-0 font-medium whitespace-nowrap w-[40px] transition-colors hover:text-foreground",
                        isFirstOfMonth ? "text-foreground text-[10px] font-bold" : "text-muted-foreground/60 text-[9px]"
                      )}
                    >
                      {isFirstOfMonth ? MONTH_NAMES[monthIdx] : format(day, "d")}
                    </td>
                    {HOURS.map((h) => {
                      const key = `${dateKey}|${String(h).padStart(2, "0")}`;
                      const cell = cellMap.get(key);
                      const hex = cell ? COLOR_HEX[cell.color] || "#6b7280" : undefined;

                      return (
                        <td key={h} className="p-0">
                          <div
                            className="activity-cell h-[12px] w-[12px] rounded-[3px] transition-all duration-200"
                            data-activity={cell?.activity || undefined}
                            style={{
                              backgroundColor: hex || undefined,
                              opacity: hex ? 1 : 0.1,
                            }}
                            title={cell ? `${cell.activity} · ${format(day, "MMM d")} ${String(h).padStart(2, "0")}:00` : ""}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
