"use client";

import { cn } from "@/lib/utils";
import { ACTIVITY_CELL_CLASSES } from "@/lib/activities";
import { format } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const RATINGS = [
  { score: 1, label: "Sad/Bad", color: "bg-orange-300", activeColor: "bg-orange-400 ring-2 ring-orange-500" },
  { score: 2, label: "Meh", color: "bg-yellow-300", activeColor: "bg-yellow-400 ring-2 ring-yellow-500" },
  { score: 3, label: "Okay", color: "bg-lime-300", activeColor: "bg-lime-400 ring-2 ring-lime-500" },
  { score: 4, label: "Awesome", color: "bg-emerald-400", activeColor: "bg-emerald-500 ring-2 ring-emerald-600" },
  { score: 5, label: "LifeMax", color: "bg-blue-500", activeColor: "bg-blue-600 ring-2 ring-blue-700" },
] as const;

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
  /** Map from "YYYY-MM-DD" → score (1-5) */
  ratings?: Map<string, number>;
  onRate?: (dateStr: string, score: number) => void;
}

export function TimeGrid({ days, data, colorMap, onCellClick, ratings, onRate }: TimeGridProps) {
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
            {ratings && (
              <th className="px-2 py-2 text-center font-semibold text-muted-foreground border-l border-border min-w-[130px]">
                Mood
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const currentScore = ratings?.get(dateKey) ?? null;
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
                {ratings && (
                  <td className="border-l border-border px-2 py-1">
                    <div className="flex gap-1 justify-center">
                      {RATINGS.map((r) => (
                        <button
                          key={r.score}
                          onClick={() => onRate?.(dateKey, r.score)}
                          title={r.label}
                          className={cn(
                            "h-6 w-6 rounded-full transition-all text-[9px] font-bold text-white/90",
                            currentScore === r.score ? r.activeColor : `${r.color} opacity-50 hover:opacity-100`
                          )}
                        >
                          {r.score}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
