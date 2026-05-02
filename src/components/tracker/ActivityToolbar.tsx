"use client";

import { cn } from "@/lib/utils";
import { getActivityDotClass } from "@/lib/activities";
import { Eraser } from "lucide-react";

export interface ActivityItem {
  name: string;
  color: string;
}

interface ActivityToolbarProps {
  activities: ActivityItem[];
  active: string | null;
  onSelect: (activity: string | null) => void;
}

export function ActivityToolbar({ activities, active, onSelect }: ActivityToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Eraser - fixed at start */}
      <button
        onClick={() => onSelect(active === "__eraser__" ? null : "__eraser__")}
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-full transition-all shrink-0",
          active === "__eraser__"
            ? "bg-foreground text-background shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Eraser className="h-3.5 w-3.5" />
      </button>

      {/* Activities - scrollable */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1.5 w-max py-1">
          {activities.map((a) => {
            const isActive = active === a.name;
            const dotColor = getActivityDotClass(a.color);
            return (
              <button
                key={a.name}
                onClick={() => onSelect(isActive ? null : a.name)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotColor)} />
                {a.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
