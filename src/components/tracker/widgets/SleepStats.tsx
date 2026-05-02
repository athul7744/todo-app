"use client";

import { useMemo } from "react";
import { format, isAfter, startOfDay } from "date-fns";
import { Moon } from "lucide-react";
import { WidgetProps } from "./types";

export function SleepStats({ days, data }: WidgetProps) {
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    // Count sleep hours per day — only up to today
    const dailySleep: { day: string; hours: number }[] = [];

    for (const day of days) {
      if (isAfter(startOfDay(day), today)) continue;
      const dateKey = format(day, "yyyy-MM-dd");
      let sleepHours = 0;
      for (let h = 0; h < 24; h++) {
        const key = `${dateKey}|${String(h).padStart(2, "0")}`;
        const cell = data.get(key);
        if (cell?.activityName?.toLowerCase() === "sleep") {
          sleepHours++;
        }
      }
      if (sleepHours > 0) {
        dailySleep.push({ day: format(day, "EEE"), hours: sleepHours });
      }
    }

    if (dailySleep.length === 0) return null;

    const totalHours = dailySleep.reduce((s, d) => s + d.hours, 0);
    const avg = Math.round((totalHours / dailySleep.length) * 10) / 10;
    const min = Math.min(...dailySleep.map((d) => d.hours));
    const max = Math.max(...dailySleep.map((d) => d.hours));

    return { dailySleep, totalHours, avg, min, max, daysTracked: dailySleep.length };
  }, [days, data]);

  if (!stats) {
    return (
      <div className="border border-border rounded-lg p-4 h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Track sleep to see stats</span>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Sleep</h3>
      </div>

      <div className="flex items-baseline gap-4 mb-3">
        <div>
          <span className="text-2xl font-bold text-foreground">{stats.avg}</span>
          <span className="text-xs text-muted-foreground ml-1">h avg</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {stats.min}–{stats.max}h range
        </div>
      </div>

      {/* Mini bar chart for daily sleep */}
      <div className="flex items-end gap-1.5 h-12">
        {stats.dailySleep.map((d) => {
          const barHeight = Math.max((d.hours / 12) * 100, 8);
          return (
            <div key={d.day} className="flex flex-col items-center gap-0.5 flex-1 h-full justify-end">
              <div
                className="w-full bg-indigo-500/60 rounded-sm"
                style={{ height: `${barHeight}%` }}
                title={`${d.day}: ${d.hours}h`}
              />
              <span className="text-[8px] text-muted-foreground">{d.day[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
