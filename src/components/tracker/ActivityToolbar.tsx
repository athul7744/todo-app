import { cn } from "@/lib/utils";
import { Eraser } from "lucide-react";
import { ActivityPillStrip } from "./ActivityPillStrip";

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
    <div className="flex items-start gap-2 [touch-action:pan-y]">
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

      <ActivityPillStrip
        items={activities.map((activity) => ({
          name: activity.name,
          colorKey: activity.color,
        }))}
        active={active}
        onSelect={onSelect}
      />
    </div>
  );
}
