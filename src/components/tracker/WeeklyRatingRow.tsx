"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback } from "react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth";
import { DailyRating } from "@/lib/powersync/AppSchema";

export const RATINGS = [
  { score: 1, label: "Sad/Bad", color: "bg-orange-300", activeColor: "bg-orange-400 ring-2 ring-orange-500" },
  { score: 2, label: "Meh", color: "bg-yellow-300", activeColor: "bg-yellow-400 ring-2 ring-yellow-500" },
  { score: 3, label: "Okay", color: "bg-lime-300", activeColor: "bg-lime-400 ring-2 ring-lime-500" },
  { score: 4, label: "Awesome", color: "bg-emerald-400", activeColor: "bg-emerald-500 ring-2 ring-emerald-600" },
  { score: 5, label: "LifeMax", color: "bg-blue-500", activeColor: "bg-blue-600 ring-2 ring-blue-700" },
] as const;

interface WeeklyRatingRowProps {
  days: Date[];
}

export function WeeklyRatingRow({ days }: WeeklyRatingRowProps) {
  const db = usePowerSync();
  const dateStrs = days.map((d) => format(d, "yyyy-MM-dd"));
  const rangeStart = dateStrs[dateStrs.length - 1];
  const rangeEnd = dateStrs[0];

  const { data: ratings } = useQuery<DailyRating & { id: string }>(
    "SELECT * FROM daily_ratings WHERE rating_date >= ? AND rating_date <= ? ORDER BY rating_date ASC",
    [rangeStart, rangeEnd]
  );

  const ratingMap = new Map(ratings.map((r) => [r.rating_date, r]));

  const handleRate = useCallback(
    async (dateStr: string, score: number) => {
      const existing = ratingMap.get(dateStr);
      const userId = await getCurrentUserId();

      if (existing && existing.score === score) {
        await db.execute("DELETE FROM daily_ratings WHERE id = ?", [existing.id]);
        return;
      }

      if (existing?.id) {
        await db.execute("UPDATE daily_ratings SET score = ? WHERE id = ?", [score, existing.id]);
      } else {
        await db.execute(
          `INSERT INTO daily_ratings (id, user_id, rating_date, score, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          [uuidv4(), userId, dateStr, score]
        );
      }
    },
    [db, ratingMap]
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="border-collapse w-max min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold text-muted-foreground min-w-[90px]">
              Rating
            </th>
            {days.map((day) => (
              <th key={format(day, "yyyy-MM-dd")} className="px-2 py-2 text-center font-medium text-muted-foreground border-l border-border min-w-[120px]">
                {format(day, "EEE, MMM d")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
              Mood
            </td>
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const currentScore = ratingMap.get(dateStr)?.score ?? null;
              return (
                <td key={dateStr} className="border-l border-border px-2 py-2">
                  <div className="flex gap-1 justify-center">
                    {RATINGS.map((r) => (
                      <button
                        key={r.score}
                        onClick={() => handleRate(dateStr, r.score)}
                        title={`${r.label} – ${format(day, "EEE, MMM d")}`}
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
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
