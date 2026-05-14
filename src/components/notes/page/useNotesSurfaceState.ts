"use client";

import { useEffect, useState } from "react";

import type { NoteBlockRow } from "@/hooks/use-notes";

import type { NormalizedNotePage, NoteTag, NotesEditorRenderableContent } from "./types";
import { useSmoothedLoading } from "./utils";

type UseNotesSurfaceStateParams = {
  selectedPageId: string | null;
  isLoading: boolean;
  isLoadingSelectedPage: boolean;
  favoritePages: NormalizedNotePage[];
  recentAccessPages: NormalizedNotePage[];
  selectedPageIdForEditor: string | null | undefined;
  selectedPageTitle: string | null | undefined;
  activePageEmoji: string | null;
  isSelectedPageFavorite: boolean;
  selectedPageTags?: NoteTag[];
  selectedBlockCount: number;
  linkedReferenceCount: number;
  displayBlocks: NoteBlockRow[];
  updatedTimestamp: { relative: string; absolute: string } | null;
};

export function useNotesSurfaceState({
  selectedPageId,
  isLoading,
  isLoadingSelectedPage,
  favoritePages,
  recentAccessPages,
  selectedPageIdForEditor,
  selectedPageTitle,
  activePageEmoji,
  isSelectedPageFavorite,
  selectedPageTags = [],
  selectedBlockCount,
  linkedReferenceCount,
  displayBlocks,
  updatedTimestamp,
}: UseNotesSurfaceStateParams) {
  const [pendingSurfaceKey, setPendingSurfaceKey] = useState<string | null>(null);
  const resolvedSurfaceKey = selectedPageId ? `editor:${selectedPageId}` : "overview";
  const displaySurfaceKey = pendingSurfaceKey ?? resolvedSurfaceKey;
  const isDisplayingOverview = displaySurfaceKey === "overview";
  const showOverviewLoading = useSmoothedLoading(
    isDisplayingOverview && (displaySurfaceKey !== resolvedSurfaceKey || isLoading),
    displaySurfaceKey,
    180,
    70
  );
  const showSelectedPageLoading = useSmoothedLoading(
    !isDisplayingOverview && (displaySurfaceKey !== resolvedSurfaceKey || isLoadingSelectedPage),
    displaySurfaceKey,
    220,
    90
  );
  const [cachedOverviewContent, setCachedOverviewContent] = useState<{
    favoritePages: NormalizedNotePage[];
    recentAccessPages: NormalizedNotePage[];
  } | null>(null);
  const [cachedEditorContent, setCachedEditorContent] = useState<NotesEditorRenderableContent>(null);

  useEffect(() => {
    if (!pendingSurfaceKey) return;
    if (pendingSurfaceKey !== resolvedSurfaceKey) return;

    const isSettled = resolvedSurfaceKey === "overview" ? !isLoading : !isLoadingSelectedPage;
    if (!isSettled) return;

    const timeoutId = window.setTimeout(() => {
      setPendingSurfaceKey(null);
    }, 90);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, isLoadingSelectedPage, pendingSurfaceKey, resolvedSurfaceKey]);

  useEffect(() => {
    if (isLoading) return;
    setCachedOverviewContent({
      favoritePages,
      recentAccessPages,
    });
  }, [favoritePages, isLoading, recentAccessPages]);

  useEffect(() => {
    if (!selectedPageIdForEditor) return;
    setCachedEditorContent({
      pageId: selectedPageIdForEditor,
      title: selectedPageTitle || "Untitled page",
      emoji: activePageEmoji,
      favorite: isSelectedPageFavorite,
      tags: selectedPageTags,
      blockCount: selectedBlockCount,
      backlinkCount: linkedReferenceCount,
      blocks: displayBlocks,
    });
  }, [
    activePageEmoji,
    displayBlocks,
    isSelectedPageFavorite,
    linkedReferenceCount,
    selectedPageTags,
    selectedBlockCount,
    selectedPageIdForEditor,
    selectedPageTitle,
  ]);

  const overviewFavoritePagesToRender = showOverviewLoading
    ? cachedOverviewContent?.favoritePages ?? []
    : favoritePages;
  const overviewRecentPagesToRender = showOverviewLoading
    ? cachedOverviewContent?.recentAccessPages ?? []
    : recentAccessPages;
  const showOverviewOverlay = showOverviewLoading && cachedOverviewContent !== null;
  const shouldAnimateOverviewContent = !showOverviewLoading && cachedOverviewContent === null;
  const liveEditorContent: NotesEditorRenderableContent = selectedPageIdForEditor
    ? {
        pageId: selectedPageIdForEditor,
        title: selectedPageTitle || "Untitled page",
        emoji: activePageEmoji,
        favorite: isSelectedPageFavorite,
      tags: selectedPageTags,
        blockCount: selectedBlockCount,
        backlinkCount: linkedReferenceCount,
        blocks: displayBlocks,
      }
    : null;
  const shouldUseCachedEditorContent = showSelectedPageLoading
    && cachedEditorContent !== null
    && cachedEditorContent.pageId !== selectedPageIdForEditor;
  const editorContentToRender: NotesEditorRenderableContent = shouldUseCachedEditorContent
    ? cachedEditorContent
    : liveEditorContent;
  const showEditorOverlay = shouldUseCachedEditorContent;
  const shouldAnimateEditorContent = !showSelectedPageLoading && cachedEditorContent === null;
  const editorUpdatedTimestamp = editorContentToRender?.pageId === selectedPageIdForEditor
    ? updatedTimestamp
    : null;

  return {
    editorContentToRender,
    editorUpdatedTimestamp,
    isDisplayingOverview,
    overviewFavoritePagesToRender,
    overviewRecentPagesToRender,
    shouldAnimateEditorContent,
    shouldAnimateOverviewContent,
    showEditorOverlay,
    showOverviewLoading,
    showOverviewOverlay,
    showSelectedPageLoading,
    transitionToEditor: (pageId: string) => setPendingSurfaceKey(`editor:${pageId}`),
    transitionToOverview: () => setPendingSurfaceKey("overview"),
  };
}