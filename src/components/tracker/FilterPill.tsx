"use client";

import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  dotClass: string;
  /** Hex color used for the tinted active background */
  activeHex?: string;
  active: boolean;
  onClick: () => void;
}

export function FilterPill({ label, dotClass, activeHex, active, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
        active
          ? "shadow-sm ring-1 ring-foreground/20 text-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      style={active && activeHex ? { backgroundColor: `color-mix(in srgb, ${activeHex} 25%, transparent)` } : undefined}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} />
      {label}
    </button>
  );
}
