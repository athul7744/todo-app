"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetProps, COLOR_HEX } from "./types";

export function DailyStacks({ days, data, colorMap }: WidgetProps) {
  const [excludeSleep, setExcludeSleep] = useState(false);

  const dailyData = useMemo(() => {
    return days.map((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const activities: Record<string, number> = {};
      let total = 0;

      for (let h = 0; h < 24; h++) {
        const key = `${dateKey}|${String(h).padStart(2, "0")}`;
        const cell = data.get(key);
        if (cell?.activityName) {
          if (excludeSleep && cell.activityName.toLowerCase() === "sleep") continue;
          activities[cell.activityName] = (activities[cell.activityName] || 0) + 1;
          total++;
        }
      }

      // Sort by hours descending for consistent stacking
      const segments = Object.entries(activities)
        .sort((a, b) => b[1] - a[1])
        .map(([name, hours]) => ({
          name,
          hours,
          color: COLOR_HEX[colorMap[name]] || "#6b7280",
          percentage: total > 0 ? (hours / 24) * 100 : 0,
        }));

      return { day: format(day, "EEE"), letter: format(day, "EEEEE"), segments, total };
    });
  }, [days, data, colorMap, excludeSleep]);

  const hasData = dailyData.some((d) => d.total > 0);
  if (!hasData) return null;

  return (
    <div className="border border-border rounded-lg p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Daily</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExcludeSleep(!excludeSleep)}
            className={cn(
              "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full transition-colors",
              excludeSleep
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-2.5 w-2.5" />
          </button>
          <span className="text-[10px] text-muted-foreground">{dailyData.reduce((s, d) => s + d.total, 0)}h</span>
        </div>
      </div>

      <div className="flex-1 flex items-end gap-1.5 min-h-[80px]">
        {dailyData.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-0.5 flex-1 h-full justify-end">
            {/* Stacked bar */}
            <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: `${(d.total / 24) * 100}%`, minHeight: d.total > 0 ? "6px" : "0" }}>
              {d.segments.map((seg, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: seg.color, height: `${(seg.hours / d.total) * 100}%` }}
                  title={`${seg.name}: ${seg.hours}h`}
                />
              ))}
            </div>
            {/* Hours label */}
            {d.total > 0 && <span className="text-[8px] text-foreground font-medium">{d.total}</span>}
            {/* Day label */}
            <span className="text-[8px] text-muted-foreground">{d.letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
