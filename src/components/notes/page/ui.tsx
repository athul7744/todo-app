"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, FileText, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/shared/utils";

export function DetailsSection({
  title,
  icon: Icon,
  accentClassName,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  accentClassName: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = useId();

  return (
    <section className="space-y-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:text-foreground"
      >
        <span className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accentClassName}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-[13px] font-medium text-foreground">{title}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
      </button>

      <div
        id={contentId}
        className={`grid overflow-hidden transition-all duration-200 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0" inert={!isOpen}>
          <div
            className={`pl-8 transition-all duration-200 ease-out ${isOpen ? "translate-y-0" : "-translate-y-1"}`}
            aria-hidden={!isOpen}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function DetailsRailCardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-xl bg-muted/95 px-3 py-2.5">
      <Bone className="h-3 w-28" />
      <div className="mt-2 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Bone key={index} className={`h-3 ${index === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export function PageIcon({ emoji, className, fallbackClassName }: { emoji?: string | null; className?: string; fallbackClassName?: string }) {
  if (emoji) {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", className)} aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return <FileText className={cn(className, fallbackClassName)} aria-hidden="true" />;
}