"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { WidgetProps, RATING_COLORS, RATING_LABELS, COLOR_HEX } from "./types";

export function MoodSummary({ days, data, colorMap, ratings }: WidgetProps) {
  const insights = useMemo(() => {
    if (!ratings || ratings.size === 0) return null;
    const scores = Array.from(ratings.values());
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Best day: find highest-rated day and its top activity
    let bestDate: string | null = null;
    let bestScore = 0;
    for (const [dateStr, score] of ratings) {
      if (score > bestScore) { bestScore = score; bestDate = dateStr; }
    }

    let bestDayActivity: { name: string; hours: number; color: string } | null = null;
    if (bestDate) {
      const counts: Record<string, number> = {};
      for (let h = 0; h < 24; h++) {
        const key = `${bestDate}|${String(h).padStart(2, "0")}`;
        const cell = data.get(key);
        if (cell?.activityName && cell.activityName.toLowerCase() !== "sleep") {
          counts[cell.activityName] = (counts[cell.activityName] || 0) + 1;
        }
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        bestDayActivity = { name: top[0], hours: top[1], color: COLOR_HEX[colorMap[top[0]]] || "#6b7280" };
      }
    }

    // Streak: consecutive days rated 3+
    let streak = 0, maxStreak = 0;
    for (const day of days) {
      const score = ratings.get(format(day, "yyyy-MM-dd"));
      if (score && score >= 3) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else { streak = 0; }
    }

    // Sleep on good vs bad days
    let goodSleep = 0, goodCount = 0, badSleep = 0, badCount = 0;
    for (const [dateStr, score] of ratings) {
      let sleep = 0;
      for (let h = 0; h < 24; h++) {
        const key = `${dateStr}|${String(h).padStart(2, "0")}`;
        if (data.get(key)?.activityName?.toLowerCase() === "sleep") sleep++;
      }
      if (sleep > 0) {
        if (score >= 4) { goodSleep += sleep; goodCount++; }
        else if (score <= 2) { badSleep += sleep; badCount++; }
      }
    }

    return {
      avg: Math.round(avg * 10) / 10,
      count: scores.length,
      bestDayActivity,
      bestScore,
      streak: maxStreak,
      sleepGood: goodCount > 0 ? Math.round((goodSleep / goodCount) * 10) / 10 : null,
      sleepBad: badCount > 0 ? Math.round((badSleep / badCount) * 10) / 10 : null,
    };
  }, [ratings, data, days, colorMap]);

  if (!insights || !ratings) {
    return (
      <div className="border border-border rounded-lg p-4 h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Rate days to see mood stats</span>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Week Mood</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">{insights.avg}</span>
          <span className="text-[9px] text-muted-foreground">({insights.count}/7)</span>
        </div>
      </div>

      {/* Mood dots grid */}
      <div className="grid grid-cols-7 gap-1 place-items-center mb-3">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const score = ratings.get(dateKey);
          return (
            <div key={dateKey} className="flex flex-col items-center gap-0.5">
              <div
                className="h-6 w-6 sm:h-5 sm:w-5 rounded-full"
                style={{ backgroundColor: score ? RATING_COLORS[score] : "var(--muted)" }}
                title={score ? `${format(day, "EEE")}: ${RATING_LABELS[score]}` : format(day, "EEE")}
              />
              <span className="text-[8px] text-muted-foreground">{format(day, "EEEEE")}</span>
            </div>
          );
        })}
      </div>

      {/* Insights row */}
      <div className="mt-auto border-t border-border pt-2 space-y-1">
        {insights.bestDayActivity && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: insights.bestDayActivity.color }} />
            <span className="text-muted-foreground">Best day:</span>
            <span className="text-foreground font-medium">{insights.bestDayActivity.name} ({insights.bestDayActivity.hours}h)</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {insights.streak > 0 && (
            <span>🔥 {insights.streak}d streak (3+)</span>
          )}
          {insights.sleepGood !== null && insights.sleepBad !== null && (
            <span>😴 Good days {insights.sleepGood}h vs bad {insights.sleepBad}h sleep</span>
          )}
          {insights.sleepGood !== null && insights.sleepBad === null && (
            <span>😴 {insights.sleepGood}h sleep on good days</span>
          )}
        </div>
      </div>
    </div>
  );
}
