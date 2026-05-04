"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Check, LayoutDashboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { APPS, type AppConfig } from "@/lib/apps";

interface AppSwitcherProps {
  current: AppConfig;
  /** "sm" for mobile (smaller text), "md" for desktop */
  size?: "sm" | "md";
}

export function AppSwitcher({ current, size = "md" }: AppSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const Icon = current.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors hover:bg-accent focus:outline-none",
          size === "md" ? "px-2.5 py-1.5" : "px-2 py-1"
        )}
      >
        <div className={cn("rounded-lg", current.accent.iconBg, size === "md" ? "p-2" : "p-1.5")}>
          <Icon className={cn(current.accent.iconText, size === "md" ? "h-6 w-6" : "h-5 w-5")} />
        </div>
        <h1 className={cn("font-bold tracking-tight", size === "md" ? "text-2xl" : "text-xl")}>
          {current.name}
          <span className={current.accent.iconText}>.</span>
        </h1>
        <ChevronDown className={cn(
          "text-muted-foreground transition-transform",
          open && "rotate-180",
          size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
        )} />
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-56 p-1.5">
        <div className="mb-0.5 flex items-center justify-between px-2 py-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Switch app
          </div>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Open launcher"
            title="Open launcher"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
          </Link>
        </div>
        {APPS.map((app) => {
          const AppIcon = app.icon;
          const isActive = app.id === current.id;
          return (
            <Link
              key={app.id}
              href={app.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent font-medium"
                  : "hover:bg-accent/50"
              )}
            >
              <div className={cn("rounded-md p-1.5", app.accent.iconBg)}>
                <AppIcon className={cn("h-4 w-4", app.accent.iconText)} />
              </div>
              <span className="flex-1 font-semibold tracking-tight">
                {app.name}<span className={app.accent.iconText}>.</span>
              </span>
              {isActive && <Check className="h-4 w-4 text-muted-foreground" />}
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
