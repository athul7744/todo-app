"use client";

import { cn } from "@/lib/utils";
import { getActivityDotClass } from "@/lib/activities";
import { COLOR_HEX } from "./widgets/types";
import { FilterPill } from "./FilterPill";
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
  // Split activities into two rows
  const mid = Math.ceil(activities.length / 2);
  const row1 = activities.slice(0, mid);
  const row2 = activities.slice(mid);

  return (
    <div className="flex items-start gap-2">
      {/* Eraser - fixed at start */}
      <button
        onClick={() => onSelect(active === "__eraser__" ? null : "__eraser__")}
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-full transition-all shrink-0 mt-1",
          active === "__eraser__"
            ? "bg-foreground text-background shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Eraser className="h-3.5 w-3.5" />
      </button>

      {/* Activities - two rows */}
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-1.5 py-1">
          {[row1, row2].map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-1.5 w-max">
              {row.map((a) => (
                <FilterPill
                  key={a.name}
                  label={a.name}
                  dotClass={getActivityDotClass(a.color)}
                  activeHex={COLOR_HEX[a.color]}
                  active={active === a.name}
                  onClick={() => onSelect(active === a.name ? null : a.name)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
