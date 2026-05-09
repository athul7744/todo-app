"use client";

import type { RefObject } from "react";
import { Plus } from "lucide-react";

import { CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { SearchPopup } from "@/components/ui/search-popup";

import type { NormalizedNotePage } from "./types";
import { PageIcon } from "./ui";

export function NotesPageSearchPopup({
  open,
  query,
  titleToCreate,
  filteredPages,
  canCreatePage,
  isCreatingPage,
  anchorRef,
  onOpenChange,
  onQueryChange,
  onSelectPage,
  onCreatePage,
}: {
  open: boolean;
  query: string;
  titleToCreate: string;
  filteredPages: NormalizedNotePage[];
  canCreatePage: boolean;
  isCreatingPage: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (title: string) => void | Promise<void>;
}) {
  return (
    <SearchPopup
      open={open}
      onOpenChange={onOpenChange}
      title="Find or create page"
      description="Search all note pages by title, summary, or tags."
      placeholder="Search pages or type a new title..."
      query={query}
      onQueryChange={onQueryChange}
      anchorRef={anchorRef}
    >
      <CommandEmpty>
        {canCreatePage ? (
          <div className="px-2 py-2 text-left text-sm text-muted-foreground">
            No matching pages. Create <span className="font-medium text-foreground">{titleToCreate}</span>.
          </div>
        ) : "No pages found."}
      </CommandEmpty>
      <CommandGroup heading="Pages">
        {filteredPages.map((page) => (
          <CommandItem
            key={page.id}
            value={page.id}
            onSelect={() => onSelectPage(page.id)}
            className="items-start gap-3 rounded-lg px-3 py-2"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black text-white">
              <PageIcon emoji={page.emoji} className="h-4 w-4 text-base leading-none" fallbackClassName="text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{page.title || "Untitled page"}</div>
              {page.summary ? <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{page.summary}</div> : null}
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
      {canCreatePage ? (
        <>
          <CommandSeparator />
          <CommandGroup heading="Create">
            <CommandItem
              value={`create:${titleToCreate}`}
              onSelect={() => {
                void onCreatePage(titleToCreate);
              }}
              className="rounded-lg px-3 py-2"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">Create page</span>
                <span className="mx-2 text-muted-foreground/60">-</span>
                <span className="text-muted-foreground">{titleToCreate}</span>
              </div>
              <CommandShortcut>{isCreatingPage ? "..." : "Enter"}</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </>
      ) : null}
    </SearchPopup>
  );
}