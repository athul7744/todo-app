"use client";

import { cn } from "@/lib/utils";
import { ACTIVITY_CELL_CLASSES } from "@/lib/activities";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const RATINGS = [
  { score: 1, label: "Sad/Bad", bg: "bg-orange-400", text: "text-orange-500" },
  { score: 2, label: "Meh", bg: "bg-yellow-400", text: "text-yellow-500" },
  { score: 3, label: "Okay", bg: "bg-lime-400", text: "text-lime-500" },
  { score: 4, label: "Awesome", bg: "bg-emerald-400", text: "text-emerald-500" },
  { score: 5, label: "LifeMax", bg: "bg-blue-500", text: "text-blue-500" },
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
            {ratings && (
              <th className="sticky left-0 z-10 bg-muted px-1 py-2 text-center font-semibold text-muted-foreground w-[52px]">
                Mood
              </th>
            )}
            <th className={cn("sticky z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground min-w-[90px]", ratings ? "left-[52px]" : "left-0")}>
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
            const currentScore = ratings?.get(dateKey) ?? null;
            const currentRating = RATINGS.find((r) => r.score === currentScore);
            return (
              <tr key={dateKey} className="border-t border-border">
                {ratings && (
                  <td className="sticky left-0 z-10 bg-muted px-1 py-1 border-r border-border w-[52px]">
                    <Select
                      value={currentScore != null ? currentScore : null}
                      onValueChange={(v: any) => onRate?.(dateKey, Number(v))}
                    >
                      <SelectTrigger size="sm" className="w-10 h-7 px-0 justify-center">
                        {currentRating ? (
                          <span className={cn("inline-block h-3.5 w-3.5 rounded-full", currentRating.bg)} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {RATINGS.map((r) => (
                          <SelectItem key={r.score} value={r.score}>
                            <span className="flex items-center gap-2">
                              <span className={cn("inline-block h-3 w-3 rounded-full", r.bg)} />
                              {r.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                )}
                <td className={cn("sticky z-10 bg-muted px-3 py-2 font-medium text-muted-foreground whitespace-nowrap", ratings ? "left-[52px]" : "left-0")}>
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
