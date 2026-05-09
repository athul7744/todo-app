"use client";

import { useMemo } from "react";

import type { NoteBlockRow, NotePageRow } from "@/hooks/use-notes";
import { extractNoteText } from "@/lib/notes/notes-content";
import { normalizeNotePageTitle } from "@/lib/notes/notes";

import { type NormalizedNotePage, type OutlineEntry, type TagDirectoryEntry } from "./types";
import { extractOutlineEntries, formatTimestampLabel, normalizePageEmoji, parseProperties } from "./utils";

type UseNotesPageDerivedStateParams = {
  allPages: NotePageRow[];
  recentPages: NotePageRow[];
  selectedPage: NotePageRow | null | undefined;
  structuredBlocks: NoteBlockRow[];
  blockContentDrafts: Record<string, string>;
  pageSearchQuery: string;
};

function normalizePages(pages: NotePageRow[]): NormalizedNotePage[] {
  return pages.map((page) => {
    const properties = parseProperties(page.properties);
    const persistedSummary = typeof properties.summary === "string" ? properties.summary.trim() : "";
    const previewSummary = persistedSummary ? "" : extractNoteText(page.preview_content).trim();
    const tags = Array.isArray(properties.tags)
      ? properties.tags.filter((tag): tag is string => typeof tag === "string")
      : [];

    return {
      ...page,
      summary: persistedSummary || previewSummary || null,
      tags,
      emoji: normalizePageEmoji(properties.emoji),
    };
  });
}

export function useNotesPageDerivedState({
  allPages,
  recentPages,
  selectedPage,
  structuredBlocks,
  blockContentDrafts,
  pageSearchQuery,
}: UseNotesPageDerivedStateParams) {
  const normalizedPages = useMemo<NormalizedNotePage[]>(
    () => normalizePages(recentPages),
    [recentPages]
  );

  const allNormalizedPages = useMemo<NormalizedNotePage[]>(
    () => normalizePages(allPages),
    [allPages]
  );

  const notePageTitles = useMemo(() => {
    const seenTitles = new Set<string>();

    return allPages.flatMap((page) => {
      const normalizedTitle = normalizeNotePageTitle(page.title) || "Untitled";
      const key = normalizedTitle.toLocaleLowerCase();

      if (seenTitles.has(key)) {
        return [];
      }

      seenTitles.add(key);
      return [normalizedTitle];
    });
  }, [allPages]);

  const notePageIdByTitle = useMemo(() => {
    const titleMap = new Map<string, string>();

    allPages.forEach((page) => {
      const normalizedTitle = normalizeNotePageTitle(page.title) || "Untitled";
      const key = normalizedTitle.toLocaleLowerCase();

      if (!titleMap.has(key)) {
        titleMap.set(key, page.id);
      }
    });

    return titleMap;
  }, [allPages]);

  const normalizedSearchQuery = useMemo(
    () => normalizeNotePageTitle(pageSearchQuery),
    [pageSearchQuery]
  );

  const filteredSearchPages = useMemo(() => {
    const nextQuery = normalizedSearchQuery.toLocaleLowerCase();

    if (!nextQuery) {
      return allNormalizedPages;
    }

    return allNormalizedPages.filter((page) => {
      const title = (normalizeNotePageTitle(page.title) || "Untitled").toLocaleLowerCase();
      const summary = (page.summary ?? "").toLocaleLowerCase();
      const tags = page.tags.join(" ").toLocaleLowerCase();
      return title.includes(nextQuery) || summary.includes(nextQuery) || tags.includes(nextQuery);
    });
  }, [allNormalizedPages, normalizedSearchQuery]);

  const exactSearchMatch = useMemo(
    () => notePageIdByTitle.get(normalizedSearchQuery.toLocaleLowerCase()) ?? null,
    [notePageIdByTitle, normalizedSearchQuery]
  );

  const selectedPageProperties = useMemo(
    () => parseProperties(selectedPage?.properties ?? null),
    [selectedPage?.properties]
  );

  const selectedPageTags = useMemo(
    () => Array.isArray(selectedPageProperties.tags)
      ? selectedPageProperties.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    [selectedPageProperties.tags]
  );

  const selectedPageEmoji = useMemo(
    () => normalizePageEmoji(selectedPageProperties.emoji),
    [selectedPageProperties.emoji]
  );

  const favoritePages = useMemo(
    () => normalizedPages.filter((page) => {
      const properties = parseProperties(page.properties);
      return properties.favorite === true;
    }),
    [normalizedPages]
  );

  const tagDirectory = useMemo<TagDirectoryEntry[]>(() => {
    const tagMap = new Map<string, TagDirectoryEntry>();

    normalizedPages.forEach((page) => {
      page.tags.forEach((tag) => {
        const trimmedTag = tag.trim();
        if (!trimmedTag) return;

        const key = trimmedTag.toLowerCase();
        const entry = tagMap.get(key);

        if (entry) {
          entry.count += 1;
          entry.pages.push(page);
          return;
        }

        tagMap.set(key, {
          key,
          label: trimmedTag,
          count: 1,
          pages: [page],
        });
      });
    });

    return Array.from(tagMap.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    });
  }, [normalizedPages]);

  const recentAccessPages = useMemo(
    () => normalizedPages.filter((page) => {
      const properties = parseProperties(page.properties);
      return properties.favorite !== true;
    }),
    [normalizedPages]
  );

  const displayBlocks = useMemo(
    () => structuredBlocks.map((block) => ({
      ...block,
      content: blockContentDrafts[block.id] ?? block.content,
    })),
    [blockContentDrafts, structuredBlocks]
  );

  const pageOutline = useMemo<OutlineEntry[]>(
    () => displayBlocks.flatMap((block) => extractOutlineEntries(block.id, block.content)),
    [displayBlocks]
  );

  const selectedPageSummary = typeof selectedPageProperties.summary === "string"
    ? selectedPageProperties.summary
    : null;
  const createdTimestamp = formatTimestampLabel(selectedPage?.created_at ?? null);
  const updatedTimestamp = formatTimestampLabel(selectedPage?.updated_at ?? null);

  return {
    allNormalizedPages,
    canCreatePageFromSearch: normalizedSearchQuery.length > 0 && !exactSearchMatch,
    createdTimestamp,
    displayBlocks,
    favoritePages,
    filteredSearchPages,
    normalizedPages,
    normalizedSearchQuery,
    notePageIdByTitle,
    notePageTitles,
    pageOutline,
    recentAccessPages,
    selectedPageEmoji,
    selectedPageProperties,
    selectedPageSummary,
    selectedPageTags,
    tagDirectory,
    updatedTimestamp,
  };
}