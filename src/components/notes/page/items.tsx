"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/utils";
import { getTagColorClasses, getTagDotClass } from "@/lib/tasks/colors";

import {
  formatTimestampLabel,
  getDeterministicTagColor,
  parseProperties,
} from "./utils";
import { PageIcon } from "./ui";
import { type NormalizedNotePage, NOTE_OVERVIEW_ACCENT_CLASSES } from "./types";

export function NavigationPageLink({
  page,
  selectedPageId,
  onSelectPage,
  showTags = true,
  trailing,
  className,
}: {
  page: NormalizedNotePage;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  showTags?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  const isSelected = page.id === selectedPageId;

  return (
    <Link
      href={`/notes?page=${page.id}`}
      onClick={() => onSelectPage(page.id)}
      className={`block rounded-lg px-3 py-1.5 transition-smooth ${
        isSelected
          ? "text-amber-700 dark:text-amber-300"
          : "text-foreground hover:bg-accent/60"
      } ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-black text-white">
            <PageIcon
              emoji={page.emoji}
              className="h-3.5 w-3.5 shrink-0 text-sm leading-none"
              fallbackClassName="text-white"
            />
          </span>
          <div className="min-w-0">
            <p className={`truncate text-[12px] font-medium ${isSelected ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{page.title || "Untitled page"}</p>
            {page.summary ? (
              <p className={`mt-0.5 line-clamp-2 text-[11px] leading-4.5 ${isSelected ? "text-amber-700/80 dark:text-amber-300/80" : "text-muted-foreground"}`}>{page.summary}</p>
            ) : null}
          </div>
        </div>
        {trailing ?? null}
      </div>
      {showTags && page.tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {page.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isSelected ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function OverviewPageCard({
  page,
  onSelectPage,
  onToggleFavorite,
  showTags = true,
  showUpdated = false,
}: {
  page: NormalizedNotePage;
  onSelectPage: (pageId: string) => void;
  onToggleFavorite: (page: NormalizedNotePage) => void;
  showTags?: boolean;
  showUpdated?: boolean;
}) {
  const updatedLabel = formatTimestampLabel(page.updated_at)?.relative;
  const pageProperties = parseProperties(page.properties);
  const isFavorite = pageProperties.favorite === true;
  const accentColor = getDeterministicTagColor(page.tags[0]);
  const accentClasses = accentColor
    ? NOTE_OVERVIEW_ACCENT_CLASSES[accentColor] ?? NOTE_OVERVIEW_ACCENT_CLASSES.slate
    : null;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/65 bg-card/95 p-4 shadow-[0_12px_38px_-28px_rgba(0,0,0,0.45)] transition-smooth hover:-translate-y-0.5 hover:border-border hover:bg-accent/20",
        accentClasses?.border,
      )}
    >
      {accentClasses ? <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b", accentClasses.glow)} /> : null}
      <div className="relative flex h-full min-h-40 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/notes?page=${page.id}`}
            onClick={() => onSelectPage(page.id)}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white">
              <PageIcon emoji={page.emoji} className="h-4 w-4 text-base leading-none" />
            </span>
            <p className="min-w-0 flex-1 text-base font-semibold leading-6 text-foreground break-words">
              {page.title || "Untitled page"}
            </p>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(page)}
            className={cn(
              "size-8 shrink-0 rounded-full",
              isFavorite ? "text-amber-500 hover:text-amber-500" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={cn("h-4 w-4", isFavorite ? "fill-current" : null)} />
          </Button>
        </div>

        <Link
          href={`/notes?page=${page.id}`}
          onClick={() => onSelectPage(page.id)}
          className="block flex-1"
        >
          {page.summary ? (
            <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{page.summary}</p>
          ) : (
            <p className="line-clamp-4 text-sm leading-6 text-muted-foreground/70">Open this page to start writing notes.</p>
          )}
        </Link>

        <div className="mt-auto space-y-3">
          {showTags && page.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {page.tags.slice(0, 4).map((tag) => {
                const tagColor = getDeterministicTagColor(tag) ?? "slate";

                return (
                  <span
                    key={tag}
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", getTagColorClasses(tagColor))}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", getTagDotClass(tagColor))} />
                    #{tag}
                  </span>
                );
              })}
            </div>
          ) : null}

          {showUpdated && updatedLabel ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
              Updated {updatedLabel}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}