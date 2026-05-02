"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";
import { WidgetProps, COLOR_HEX } from "./types";

export function ActivityBreakdown({ data, colorMap }: WidgetProps) {
  const [excludeSleep, setExcludeSleep] = useState(false);

  const activityHours = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [, cell] of data) {
      if (cell.activityName) {
        counts[cell.activityName] = (counts[cell.activityName] || 0) + 1;
      }
    }
    return counts;
  }, [data]);

  const slices = useMemo(() => {
    const entries = Object.entries(activityHours)
      .filter(([name]) => !excludeSleep || name.toLowerCase() !== "sleep")
      .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((sum, [, h]) => sum + h, 0);
    if (total === 0) return [];

    return entries.map(([name, hours]) => ({
      name,
      hours,
      color: COLOR_HEX[colorMap[name]] || "#6b7280",
      percentage: (hours / total) * 100,
    }));
  }, [activityHours, colorMap, excludeSleep]);

  const piePaths = useMemo(() => {
    if (slices.length === 0) return [];
    const paths: { d: string; color: string; name: string; hours: number }[] = [];
    let currentAngle = -90;

    for (const slice of slices) {
      const angle = (slice.percentage / 100) * 360;
      const endAngle = currentAngle + angle;
      const startRad = (currentAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;

      if (slices.length === 1) {
        paths.push({ d: `M 50 10 A 40 40 0 1 1 49.99 10 Z`, color: slice.color, name: slice.name, hours: slice.hours });
      } else {
        paths.push({ d: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`, color: slice.color, name: slice.name, hours: slice.hours });
      }
      currentAngle = endAngle;
    }
    return paths;
  }, [slices]);

  const totalTracked = Object.values(activityHours).reduce((a, b) => a + b, 0);
  const displayTotal = excludeSleep ? totalTracked - (activityHours["Sleep"] || 0) : totalTracked;

  if (totalTracked === 0) return null;

  return (
    <div className="border border-border rounded-lg p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Activity</h3>
        {activityHours["Sleep"] && (
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
            {excludeSleep ? "Hidden" : "Sleep"}
          </button>
        )}
      </div>

      {/* Pie chart - centered, larger */}
      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-44 w-44 sm:h-52 sm:w-52">
          {piePaths.map((path, i) => (
            <path key={i} d={path.d} fill={path.color} stroke="var(--background)" strokeWidth="0.5">
              <title>{path.name}: {path.hours}h</title>
            </path>
          ))}
          <circle cx="50" cy="50" r="22" fill="var(--background)" />
          <text x="50" y="48" textAnchor="middle" className="fill-foreground text-[8px] font-bold">
            {displayTotal}h
          </text>
          <text x="50" y="57" textAnchor="middle" className="fill-muted-foreground text-[5px]">
            total
          </text>
        </svg>
      </div>

      {/* Scrollable legend bar */}
      <div className="flex gap-2 overflow-x-auto pt-2 border-t border-border mt-2">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-1 shrink-0 text-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="text-foreground font-medium">{s.hours}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}
