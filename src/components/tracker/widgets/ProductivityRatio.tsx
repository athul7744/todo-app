"use client";

import { useMemo } from "react";
import { WidgetProps } from "./types";

/** Activities generally considered productive. Case-insensitive match. */
const PRODUCTIVE_KEYWORDS = ["coding", "deep work", "study", "reading", "writing", "work", "exercise", "learning", "design", "planning"];
const PASSIVE_KEYWORDS = ["sleep", "rest", "break", "social media", "tv", "gaming", "youtube", "netflix"];

export function ProductivityRatio({ data }: WidgetProps) {
  const stats = useMemo(() => {
    const counts = { productive: 0, passive: 0, other: 0 };

    for (const [, cell] of data) {
      if (!cell.activityName) continue;
      const name = cell.activityName.toLowerCase();

      if (PRODUCTIVE_KEYWORDS.some((k) => name.includes(k))) {
        counts.productive++;
      } else if (PASSIVE_KEYWORDS.some((k) => name.includes(k))) {
        counts.passive++;
      } else {
        counts.other++;
      }
    }

    const total = counts.productive + counts.passive + counts.other;
    if (total === 0) return null;

    return {
      productive: counts.productive,
      passive: counts.passive,
      other: counts.other,
      total,
      ratio: Math.round((counts.productive / total) * 100),
    };
  }, [data]);

  if (!stats) return null;

  const productivePct = (stats.productive / stats.total) * 100;
  const passivePct = (stats.passive / stats.total) * 100;
  const otherPct = (stats.other / stats.total) * 100;

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Productivity Ratio</h3>
        <span className="text-xs text-muted-foreground">{stats.total}h tracked</span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-2">
        {stats.productive > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${productivePct}%` }}
            title={`Productive: ${stats.productive}h`}
          />
        )}
        {stats.other > 0 && (
          <div
            className="bg-slate-500 transition-all"
            style={{ width: `${otherPct}%` }}
            title={`Other: ${stats.other}h`}
          />
        )}
        {stats.passive > 0 && (
          <div
            className="bg-orange-400 transition-all"
            style={{ width: `${passivePct}%` }}
            title={`Passive: ${stats.passive}h`}
          />
        )}
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Productive</span>
          <span className="font-medium text-foreground">{stats.productive}h ({stats.ratio}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-muted-foreground">Other</span>
          <span className="font-medium text-foreground">{stats.other}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-muted-foreground">Passive</span>
          <span className="font-medium text-foreground">{stats.passive}h</span>
        </div>
      </div>
    </div>
  );
}
