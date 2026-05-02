"use client";

import { cn } from "@/lib/utils";
import { ACTIVITY_CELL_CLASSES } from "@/lib/activities";
import { format } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export interface GridCell {
  /** PowerSync row id, if a log exists for this cell */
  id?: string;
  activityName?: string;
}

/** Map key: "YYYY-MM-DD|HH" */
export type GridData = Map<string, GridCell>;

interface TimeGridProps {
  /** Ordered newest-first array of Date objects representing each row day */
  days: Date[];
  data: GridData;
  /** Map from activity name → color key */
  colorMap: Record<string, string>;
  onCellClick: (day: Date, hour: number, existing: GridCell | undefined) => void;
}

export function TimeGrid({ days, data, colorMap, onCellClick }: TimeGridProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="border-collapse w-max min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground min-w-[90px]">
              Day
            </th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[44px] border-l border-border"
              >
                {String(h).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            return (
              <tr key={dateKey} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  {format(day, "EEE, MMM d")}
                </td>
                {HOURS.map((h) => {
                  const key = `${dateKey}|${String(h).padStart(2, "0")}`;
                  const cell = data.get(key);
                  const color = cell?.activityName
                    ? colorMap[cell.activityName]
                    : undefined;
                  const cellClasses = color
                    ? ACTIVITY_CELL_CLASSES[color]
                    : undefined;

                  return (
                    <td
                      key={h}
                      onClick={() => onCellClick(day, h, cell)}
                      className={cn(
                        "border-l border-border cursor-pointer text-center select-none transition-colors",
                        "h-9 w-11",
                        "hover:ring-2 hover:ring-primary/40 hover:z-10",
                        cellClasses ?? "hover:bg-accent/50"
                      )}
                      title={
                        cell?.activityName
                          ? `${cell.activityName} – ${String(h).padStart(2, "0")}:00`
                          : `${format(day, "EEE")} ${String(h).padStart(2, "0")}:00 (empty)`
                      }
                    >
                      {cell?.activityName ? cell.activityName.charAt(0) : ""}
                    </td>
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
