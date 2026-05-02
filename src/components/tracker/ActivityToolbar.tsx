"use client";

import { cn } from "@/lib/utils";
import { ACTIVITY_BUTTON_CLASSES } from "@/lib/activities";
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
    <div className="flex flex-wrap items-center gap-2">
      {activities.map((a) => {
        const cls = ACTIVITY_BUTTON_CLASSES[a.color] ?? ACTIVITY_BUTTON_CLASSES["teal"];
        const isActive = active === a.name;
        return (
          <button
            key={a.name}
            onClick={() => onSelect(isActive ? null : a.name)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
              isActive ? cls.active : cls.base
            )}
          >
            {a.name}
          </button>
        );
      })}

      {/* Eraser tool */}
      <button
        onClick={() => onSelect(active === "__eraser__" ? null : "__eraser__")}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors flex items-center gap-1.5",
          active === "__eraser__"
            ? "bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-500 dark:border-zinc-500"
            : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
        )}
      >
        <Eraser className="h-4 w-4" />
        Eraser
      </button>
    </div>
  );
}
