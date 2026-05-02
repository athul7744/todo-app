"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useMemo } from "react";
import { format, startOfYear, endOfYear, eachDayOfInterval, getYear } from "date-fns";
import { cn } from "@/lib/utils";
import { ACTIVITY_CELL_CLASSES } from "@/lib/activities";
import { TimeLog, ActivityType } from "@/lib/powersync/AppSchema";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface YearActivityGridProps {
  year: number;
}

export function YearActivityGrid({ year }: YearActivityGridProps) {
  const db = usePowerSync();

  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'00:00:00'+00:00'");
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'23:59:59'+00:00'");

  const { data: activityTypes } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  const { data: logs } = useQuery<TimeLog & { id: string }>(
    `SELECT activity_name, start_timestamp FROM time_logs
     WHERE start_timestamp >= ? AND start_timestamp <= ?
     ORDER BY start_timestamp ASC`,
    [yearStart, yearEnd]
  );

  const colorMap = useMemo(
    () => Object.fromEntries(activityTypes.map((a) => [a.name, a.color ?? "teal"])),
    [activityTypes]
  );

  // Build lookup: "YYYY-MM-DD|HH" → activity color
  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of logs) {
      const ts = new Date(log.start_timestamp!);
      const dateKey = format(ts, "yyyy-MM-dd");
      const hourKey = String(ts.getUTCHours()).padStart(2, "0");
      const color = colorMap[log.activity_name ?? ""] ?? "teal";
      map.set(`${dateKey}|${hourKey}`, color);
    }
    return map;
  }, [logs, colorMap]);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) }),
    [year]
  );

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] rounded-lg border border-border">
      <table className="border-collapse text-[10px]">
        <thead className="sticky top-0 z-20">
          <tr className="bg-muted">
            <th className="sticky left-0 z-30 bg-muted px-1 py-1 text-left font-semibold text-muted-foreground min-w-[70px] text-[10px]">
              Date
            </th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="px-0 py-1 text-center font-medium text-muted-foreground min-w-[14px] w-[14px] border-l border-border"
              >
                {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const isFirstOfMonth = day.getDate() === 1;
            return (
              <tr key={dateKey} className={cn("border-t border-border", isFirstOfMonth && "border-t-2 border-t-foreground/20")}>
                <td className="sticky left-0 z-10 bg-muted px-1 py-0 font-medium text-muted-foreground whitespace-nowrap text-[10px]">
                  {isFirstOfMonth ? format(day, "MMM d") : format(day, "d")}
                </td>
                {HOURS.map((h) => {
                  const key = `${dateKey}|${String(h).padStart(2, "0")}`;
                  const color = cellMap.get(key);
                  const cellClasses = color ? ACTIVITY_CELL_CLASSES[color] : undefined;

                  return (
                    <td
                      key={h}
                      className={cn(
                        "border-l border-border/50 p-0",
                        "h-[14px] w-[14px] min-w-[14px]",
                        cellClasses ?? ""
                      )}
                      title={color ? `${dateKey} ${String(h).padStart(2, "0")}:00` : ""}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
