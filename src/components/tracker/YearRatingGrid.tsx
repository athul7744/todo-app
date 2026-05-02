"use client";

import { useQuery } from "@powersync/react";
import { useMemo } from "react";
import {
  format,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  getMonth,
} from "date-fns";
import { cn } from "@/lib/utils";
import { DailyRating } from "@/lib/powersync/AppSchema";

const RATING_COLORS: Record<number, string> = {
  1: "bg-orange-300 dark:bg-orange-400",
  2: "bg-yellow-300 dark:bg-yellow-400",
  3: "bg-lime-300 dark:bg-lime-400",
  4: "bg-emerald-400 dark:bg-emerald-500",
  5: "bg-blue-500 dark:bg-blue-600",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface YearRatingGridProps {
  year: number;
  onDayClick?: (date: Date) => void;
}

export function YearRatingGrid({ year, onDayClick }: YearRatingGridProps) {
  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd");

  const { data: ratings } = useQuery<DailyRating & { id: string }>(
    "SELECT rating_date, score FROM daily_ratings WHERE rating_date >= ? AND rating_date <= ?",
    [yearStart, yearEnd]
  );

  const ratingMap = useMemo(
    () => new Map(ratings.map((r) => [r.rating_date, r.score])),
    [ratings]
  );

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthDate = new Date(year, m, 1);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });
      return { month: m, days };
    });
  }, [year]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map(({ month, days }) => (
        <div key={month} className="border border-border rounded-lg p-2">
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 text-center">
            {MONTH_NAMES[month]}
          </h3>
          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 gap-[2px] mb-0.5">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-[9px] text-muted-foreground/60 text-center font-medium">
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-[2px]">
            {/* Offset for first day of month (Monday = 0) */}
            {Array.from({ length: ((getDay(days[0]) + 6) % 7) }, (_, i) => (
              <div key={`pad-${i}`} className="h-3.5 w-3.5" />
            ))}
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const score = ratingMap.get(dateStr);
              const colorClass = score ? RATING_COLORS[score] : "";
              return (
                <button
                  key={dateStr}
                  onClick={() => onDayClick?.(day)}
                  className={cn(
                    "h-3.5 w-3.5 rounded-sm transition-colors",
                    colorClass || "bg-muted/50 hover:bg-muted",
                  )}
                  title={score ? `${dateStr}: ${score}/5` : dateStr}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
