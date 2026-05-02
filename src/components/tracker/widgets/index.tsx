"use client";

import { WidgetProps } from "./types";
import { ActivityBreakdown } from "./ActivityBreakdown";
import { MoodSummary } from "./MoodSummary";
import { SleepStats } from "./SleepStats";
import { DailyStacks } from "./DailyStacks";
import { ProductivityRatio } from "./ProductivityRatio";

export function WeekWidgets(props: WidgetProps) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Row 1: Sleep + Mood */}
      <div className="grid grid-cols-2 gap-3">
        <SleepStats {...props} />
        <MoodSummary {...props} />
      </div>

      {/* Row 2: Activity + Daily */}
      <div className="grid grid-cols-2 gap-3">
        <ActivityBreakdown {...props} />
        <DailyStacks {...props} />
      </div>

      {/* Productivity - same width as grid above */}
      <ProductivityRatio {...props} />
    </div>
  );
}
