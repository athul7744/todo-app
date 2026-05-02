"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback } from "react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth";
import { DailyRating } from "@/lib/powersync/AppSchema";

const RATINGS = [
  { score: 1, label: "Sad/Bad", color: "bg-orange-300", activeColor: "bg-orange-400 ring-2 ring-orange-500" },
  { score: 2, label: "Meh", color: "bg-yellow-300", activeColor: "bg-yellow-400 ring-2 ring-yellow-500" },
  { score: 3, label: "Okay", color: "bg-lime-300", activeColor: "bg-lime-400 ring-2 ring-lime-500" },
  { score: 4, label: "Awesome", color: "bg-emerald-400", activeColor: "bg-emerald-500 ring-2 ring-emerald-600" },
  { score: 5, label: "LifeMax", color: "bg-blue-500", activeColor: "bg-blue-600 ring-2 ring-blue-700" },
] as const;

interface DailyRatingBarProps {
  date: Date;
}

export function DailyRatingBar({ date }: DailyRatingBarProps) {
  const db = usePowerSync();
  const dateStr = format(date, "yyyy-MM-dd");

  const { data } = useQuery<DailyRating & { id: string }>(
    "SELECT * FROM daily_ratings WHERE rating_date = ? LIMIT 1",
    [dateStr]
  );

  const currentScore = data.length > 0 ? data[0].score : null;

  const handleRate = useCallback(
    async (score: number) => {
      const userId = await getCurrentUserId();

      if (currentScore === score) {
        // Deselect — delete the rating
        if (data[0]?.id) {
          await db.execute("DELETE FROM daily_ratings WHERE id = ?", [data[0].id]);
        }
        return;
      }

      if (data.length > 0 && data[0]?.id) {
        // Update existing
        await db.execute("UPDATE daily_ratings SET score = ? WHERE id = ?", [score, data[0].id]);
      } else {
        // Insert new
        await db.execute(
          `INSERT INTO daily_ratings (id, user_id, rating_date, score, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          [uuidv4(), userId, dateStr, score]
        );
      }
    },
    [db, dateStr, currentScore, data]
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium shrink-0">Today:</span>
      <div className="flex gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r.score}
            onClick={() => handleRate(r.score)}
            title={r.label}
            className={cn(
              "h-7 w-7 rounded-full transition-all text-[10px] font-bold text-white/90",
              currentScore === r.score ? r.activeColor : `${r.color} opacity-60 hover:opacity-100`
            )}
          >
            {r.score}
          </button>
        ))}
      </div>
      {currentScore && (
        <span className="text-xs text-muted-foreground ml-1">
          {RATINGS.find((r) => r.score === currentScore)?.label}
        </span>
      )}
    </div>
  );
}
