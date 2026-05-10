"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Files, NotebookTabs, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Star } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { MobileBottomFabs } from "@/components/MobileBottomFabs";
import { NotesDetailsRailSkeleton, NotesPageSkeleton } from "@/components/notes/NotesPageSkeleton";
import { MobileRailDrawer } from "../../components/notes/MobileRailDrawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SEARCH_POPUP_CLOSE_ANIMATION_MS } from "@/components/ui/search-popup";
import { useAllNotePages, useLinkedNoteReferences, useNoteCounts, useNotePageWithBlocks, usePageAttachments, usePageTagMentions, useRecentNotePages } from "@/hooks/use-notes";
import { createStarterPage, flushPendingNoteEdgeReconciles, hasPendingNoteEdgeReconciles, normalizeNotePageTitle } from "@/lib/notes/notes";
import { getApp } from "@/lib/shared/apps";
import { flushAllUpdates, hasPendingWrites } from "@/lib/shared/debounced-update";
import {
  type OptimisticBlockStructure,
} from "@/components/notes/page/types";
import { NotesDetailsRail } from "@/components/notes/page/NotesDetailsRail";
import { NotesEditorContent } from "@/components/notes/page/NotesEditorContent";
import { NotesNavigationRail, NotesNavigationRailHeader } from "@/components/notes/page/NotesNavigationRail";
import { NotesOverview } from "@/components/notes/page/NotesOverview";
import { useNoteBlockActions } from "@/components/notes/page/useNoteBlockActions";
import { useNotePageActions } from "@/components/notes/page/useNotePageActions";
import { NotesPageSearchPopup } from "@/components/notes/page/NotesPageSearchPopup";
import { useNotesPageDerivedState } from "@/components/notes/page/useNotesPageDerivedState";
import { useNotesSurfaceState } from "@/components/notes/page/useNotesSurfaceState";
import { formatTimestampLabel } from "@/components/notes/page/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRelativeTimeTick } from "@/hooks/use-relative-time-tick";

const notesApp = getApp("notes");
const NOTES_DESKTOP_PANEL_PREFERENCE_KEY = "notes.desktop-panels";
const MOBILE_EDGE_SWIPE_START_PX = 24;
const MOBILE_EDGE_SWIPE_TRIGGER_PX = 56;
const MOBILE_EDGE_SWIPE_MAX_VERTICAL_DRIFT_PX = 48;

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPageId = searchParams.get("page");
  const selectedPageIdForWrite: string | undefined = selectedPageId ?? undefined;
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [isPageSearchOpen, setIsPageSearchOpen] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [pageTitleDraft, setPageTitleDraft] = useState("");
  const [pageTitleError, setPageTitleError] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [pageEmojiDraft, setPageEmojiDraft] = useState<string | null | undefined>(undefined);
  const [resolvedPageEmoji, setResolvedPageEmoji] = useState<string | null | undefined>(undefined);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [blockContentDrafts, setBlockContentDrafts] = useState<Record<string, string>>({});
  const [optimisticBlockStructure, setOptimisticBlockStructure] = useState<Record<string, OptimisticBlockStructure>>({});
  const [showAbsoluteUpdatedTime, setShowAbsoluteUpdatedTime] = useState(false);
  const [stableUpdatedTimestamp, setStableUpdatedTimestamp] = useState<{ relative: string; absolute: string } | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ blockId: string; placement: number | "start" | "end" } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [isMobilePagesDrawerOpen, setIsMobilePagesDrawerOpen] = useState(false);
  const [isMobileDetailsDrawerOpen, setIsMobileDetailsDrawerOpen] = useState(false);
  const [pageRailSectionOpen, setPageRailSectionOpen] = useState({
    favorites: true,
    recent: true,
    tags: true,
  });
  const [showEditorAppHeader, setShowEditorAppHeader] = useState(false);
  const [showDesktopPagesRail, setShowDesktopPagesRail] = useState(true);
  const [showDesktopDetailsRail, setShowDesktopDetailsRail] = useState(false);
  const [tagDirectoryOpen, setTagDirectoryOpen] = useState<Record<string, boolean>>({});
  const [detailsSectionOpen, setDetailsSectionOpen] = useState({
    outline: false,
    summary: false,
    tags: false,
    references: false,
    mentions: false,
    attachments: false,
    timestamps: true,
    actions: true,
  });
  const isMobileViewport = useMediaQuery("(max-width: 639px)");
  const edgeSwipeStartRef = useRef<{ x: number; y: number; edge: "left" | "right" } | null>(null);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasPendingWrites() && !hasPendingNoteEdgeReconciles()) {
        return;
      }

      flushAllUpdates();
      void flushPendingNoteEdgeReconciles();
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    try {
      const rawPreference = window.localStorage.getItem(NOTES_DESKTOP_PANEL_PREFERENCE_KEY);
      if (!rawPreference) {
        return;
      }

      const parsedPreference = JSON.parse(rawPreference) as {
        showDesktopDetailsRail?: boolean;
        showDesktopPagesRail?: boolean;
      };

      if (typeof parsedPreference.showDesktopPagesRail === "boolean") {
        setShowDesktopPagesRail(parsedPreference.showDesktopPagesRail);
      }

      if (typeof parsedPreference.showDesktopDetailsRail === "boolean") {
        setShowDesktopDetailsRail(parsedPreference.showDesktopDetailsRail);
      }
    } catch {
      window.localStorage.removeItem(NOTES_DESKTOP_PANEL_PREFERENCE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      NOTES_DESKTOP_PANEL_PREFERENCE_KEY,
      JSON.stringify({
        showDesktopPagesRail,
        showDesktopDetailsRail,
      })
    );
  }, [showDesktopDetailsRail, showDesktopPagesRail]);

  const { isLoading: isLoadingCounts } = useNoteCounts();
  const { pages: allPages = [] } = useAllNotePages();
  const { pages: recentPages = [], isLoading: isLoadingRecentPages } = useRecentNotePages(8);
  const { page: selectedPage, blocks: selectedBlocks, isLoading: isLoadingSelectedPage } = useNotePageWithBlocks(selectedPageId);
  const { attachments: selectedPageAttachments, isLoading: isLoadingAttachments } = usePageAttachments(selectedPageId);
  const { references: linkedReferences, isLoading: isLoadingLinkedReferences } = useLinkedNoteReferences(selectedPageId);
  const { tags: pageTagMentions, isLoading: isLoadingTagMentions } = usePageTagMentions(selectedPageId);

  const handleCreateStarterPage = async () => {
    setPageSearchQuery("");
    setIsPageSearchOpen(true);
  };
  const {
    handleCommitBlockContent,
    handleCreateEmptySiblingBlock,
    handleCreateRootBlock,
    handleCreateSiblingBlock,
    handleCreateSiblingBlocks,
    handleDeleteBlock,
    handleIndentBlock,
    handleMergeWithPreviousBlock,
    handleOutdentBlock,
    handleUpdateBlockContent,
    orderedVisibleBlockIds,
    selectedBlockMap,
    structuredBlocks,
  } = useNoteBlockActions({
    selectedBlocks,
    selectedPageId,
    selectedPageIdForWrite,
    isCreatingBlock,
    blockContentDrafts,
    optimisticBlockStructure,
    setIsCreatingBlock,
    setBlockContentDrafts,
    setOptimisticBlockStructure,
    setFocusTarget,
  });

  const {
    canCreatePageFromSearch,
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
  } = useNotesPageDerivedState({
    allPages,
    recentPages,
    selectedPage,
    structuredBlocks,
    blockContentDrafts,
    pageSearchQuery,
  });
  const activePageEmoji = pageEmojiDraft !== undefined
    ? pageEmojiDraft
    : resolvedPageEmoji !== undefined
      ? resolvedPageEmoji
      : selectedPageEmoji;
  const absoluteUpdatedTimeTimeoutRef = useRef<number | null>(null);
  const pendingUpdatedTimestampRef = useRef<{ relative: string; absolute: string } | null>(null);
  const settleUpdatedTimestampTimeoutRef = useRef<number | null>(null);

  const revealAbsoluteUpdatedTime = () => {
    setShowAbsoluteUpdatedTime(true);

    if (absoluteUpdatedTimeTimeoutRef.current !== null) {
      window.clearTimeout(absoluteUpdatedTimeTimeoutRef.current);
    }

    absoluteUpdatedTimeTimeoutRef.current = window.setTimeout(() => {
      setShowAbsoluteUpdatedTime(false);
      absoluteUpdatedTimeTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    if (!selectedPage) {
      setPageTitleDraft("");
      setPageTitleError(null);
      setPageEmojiDraft(undefined);
      setResolvedPageEmoji(undefined);
      setSummaryDraft("");
      setTagsDraft("");
      setBlockContentDrafts({});
      setOptimisticBlockStructure({});
      setShowAbsoluteUpdatedTime(false);
      setStableUpdatedTimestamp(null);
      setFocusTarget(null);
      return;
    }

    setPageTitleDraft(selectedPage?.title ?? "");
    setPageTitleError(null);
    setPageEmojiDraft(undefined);
  setResolvedPageEmoji(selectedPageEmoji);
    setSummaryDraft(selectedPageSummary ?? "");
    setTagsDraft(selectedPageTags.join(", "));
    setBlockContentDrafts({});
    setOptimisticBlockStructure({});
    setShowAbsoluteUpdatedTime(false);
    setStableUpdatedTimestamp(updatedTimestamp);
    setFocusTarget(null);
  }, [selectedPage?.id]);

  useEffect(() => {
    pendingUpdatedTimestampRef.current = updatedTimestamp;

    if (!selectedPage) {
      if (settleUpdatedTimestampTimeoutRef.current !== null) {
        window.clearTimeout(settleUpdatedTimestampTimeoutRef.current);
        settleUpdatedTimestampTimeoutRef.current = null;
      }
      setStableUpdatedTimestamp(null);
      return;
    }

    if (!hasPendingWrites() && !hasPendingNoteEdgeReconciles()) {
      if (settleUpdatedTimestampTimeoutRef.current !== null) {
        window.clearTimeout(settleUpdatedTimestampTimeoutRef.current);
        settleUpdatedTimestampTimeoutRef.current = null;
      }
      setStableUpdatedTimestamp(updatedTimestamp);
      return;
    }

    if (settleUpdatedTimestampTimeoutRef.current !== null) {
      return;
    }

    const waitForSettledTimestamp = () => {
      if (hasPendingWrites() || hasPendingNoteEdgeReconciles()) {
        settleUpdatedTimestampTimeoutRef.current = window.setTimeout(waitForSettledTimestamp, 240);
        return;
      }

      settleUpdatedTimestampTimeoutRef.current = null;
      setStableUpdatedTimestamp(pendingUpdatedTimestampRef.current);
    };

    settleUpdatedTimestampTimeoutRef.current = window.setTimeout(waitForSettledTimestamp, 240);

    return () => {
      if (settleUpdatedTimestampTimeoutRef.current !== null) {
        window.clearTimeout(settleUpdatedTimestampTimeoutRef.current);
        settleUpdatedTimestampTimeoutRef.current = null;
      }
    };
  }, [selectedPage?.id, selectedPage?.updated_at]);

  const relativeTimeTick = useRelativeTimeTick(30000);

  useEffect(() => {
    if (!selectedPage || hasPendingWrites() || hasPendingNoteEdgeReconciles()) {
      return;
    }

    const nextTimestamp = formatTimestampLabel(selectedPage.updated_at ?? null);
    setStableUpdatedTimestamp((currentTimestamp) => {
      if (
        currentTimestamp?.relative === nextTimestamp?.relative &&
        currentTimestamp?.absolute === nextTimestamp?.absolute
      ) {
        return currentTimestamp;
      }

      return nextTimestamp;
    });
  }, [relativeTimeTick, selectedPage?.id, selectedPage?.updated_at]);

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setResolvedPageEmoji(selectedPageEmoji);
  }, [selectedPage, selectedPageEmoji]);

  useEffect(() => {
    if (!selectedPage || pageEmojiDraft === undefined) {
      return;
    }

    if (pageEmojiDraft === selectedPageEmoji) {
      setPageEmojiDraft(undefined);
    }
  }, [pageEmojiDraft, selectedPage?.id, selectedPageEmoji]);

  useEffect(() => {
    return () => {
      if (absoluteUpdatedTimeTimeoutRef.current !== null) {
        window.clearTimeout(absoluteUpdatedTimeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOptimisticBlockStructure((current) => {
      const optimisticIds = Object.keys(current);
      if (optimisticIds.length === 0) {
        return current;
      }

      const selectedBlockById = new Map(selectedBlocks.map((block) => [block.id, block]));
      let hasChanged = false;
      const next = { ...current };

      optimisticIds.forEach((blockId) => {
        const optimisticMove = current[blockId];
        const selectedBlock = selectedBlockById.get(blockId);

        if (!selectedBlock) {
          delete next[blockId];
          hasChanged = true;
          return;
        }

        if (
          (selectedBlock.parent_block_id ?? null) === optimisticMove.parent_block_id &&
          selectedBlock.sort_rank === optimisticMove.sort_rank
        ) {
          delete next[blockId];
          hasChanged = true;
        }
      });

      return hasChanged ? next : current;
    });
  }, [selectedBlocks]);

  useEffect(() => {
    setTagDirectoryOpen((current) => {
      const selectedTagKeys = new Set(selectedPageTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
      const next: Record<string, boolean> = {};
      let hasChanged = Object.keys(current).length !== tagDirectory.length;

      tagDirectory.forEach((entry, index) => {
        const nextValue = current[entry.key] ?? (selectedTagKeys.has(entry.key) || index === 0);
        next[entry.key] = nextValue;

        if (current[entry.key] !== nextValue) {
          hasChanged = true;
        }
      });

      return hasChanged ? next : current;
    });
  }, [selectedPageTags, tagDirectory]);

  useEffect(() => {
    const nextState = {
      outline: pageOutline.length > 0,
      summary: Boolean(selectedPageSummary?.trim()),
      tags: selectedPageTags.length > 0,
      references: linkedReferences.length > 0,
      mentions: pageTagMentions.length > 0,
      attachments: selectedPageAttachments.length > 0,
      timestamps: true,
      actions: true,
    };

    setDetailsSectionOpen((current) => {
      if (
        current.outline === nextState.outline &&
        current.summary === nextState.summary &&
        current.tags === nextState.tags &&
        current.references === nextState.references &&
        current.mentions === nextState.mentions &&
        current.attachments === nextState.attachments &&
        current.timestamps === nextState.timestamps &&
        current.actions === nextState.actions
      ) {
        return current;
      }

      return nextState;
    });
  }, [linkedReferences.length, pageOutline.length, pageTagMentions.length, selectedPage?.id, selectedPageAttachments.length, selectedPageSummary, selectedPageTags.length]);

  const isLoading = isLoadingCounts || isLoadingRecentPages;

  const {
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
    transitionToEditor,
    transitionToOverview,
  } = useNotesSurfaceState({
    selectedPageId,
    isLoading,
    isLoadingSelectedPage,
    favoritePages,
    recentAccessPages,
    selectedPageIdForEditor: selectedPage?.id,
    selectedPageTitle: pageTitleDraft || selectedPage?.title || "Untitled page",
    activePageEmoji,
    isSelectedPageFavorite: selectedPageProperties.favorite === true,
    selectedBlockCount: selectedBlocks.length,
    linkedReferenceCount: linkedReferences.length,
    displayBlocks,
    updatedTimestamp: stableUpdatedTimestamp,
  });

  const openPageById = (pageId: string) => {
    transitionToEditor(pageId);
    startTransition(() => {
      router.push(`/notes?page=${pageId}`);
    });
  };

  const handleSelectPageFromSearch = (pageId: string) => {
    setIsPageSearchOpen(false);
    openPageById(pageId);
  };

  const handleCreatePageFromSearch = async (title: string) => {
    const normalizedTitle = normalizeNotePageTitle(title);
    if (!normalizedTitle || isCreatingPage) return;

    const existingPageId = notePageIdByTitle.get(normalizedTitle.toLocaleLowerCase());
    if (existingPageId) {
      handleSelectPageFromSearch(existingPageId);
      return;
    }

    setIsCreatingPage(true);

    try {
      const pageId = await createStarterPage(normalizedTitle);
      setIsPageSearchOpen(false);
      openPageById(pageId);
    } finally {
      setIsCreatingPage(false);
    }
  };

  const handleOpenPageReference = (title: string) => {
    const targetPageId = notePageIdByTitle.get(title.trim().toLocaleLowerCase());
    if (!targetPageId) {
      return;
    }

    openPageById(targetPageId);
  };

  const overviewSearchTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isPageSearchOpen || pageSearchQuery.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPageSearchQuery("");
    }, SEARCH_POPUP_CLOSE_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPageSearchOpen, pageSearchQuery]);

  const togglePageRailSection = (section: keyof typeof pageRailSectionOpen) => {
    setPageRailSectionOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const toggleTagDirectoryGroup = (tagKey: string) => {
    setTagDirectoryOpen((current) => ({
      ...current,
      [tagKey]: !current[tagKey],
    }));
  };

  const toggleDetailsSection = (section: keyof typeof detailsSectionOpen) => {
    setDetailsSectionOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const areAllPageRailSectionsOpen = Object.values(pageRailSectionOpen).every(Boolean);

  const toggleAllPageRailSections = () => {
    setPageRailSectionOpen({
      favorites: !areAllPageRailSectionsOpen,
      recent: !areAllPageRailSectionsOpen,
      tags: !areAllPageRailSectionsOpen,
    });
  };

  const areAllDetailsSectionsOpen = Object.values(detailsSectionOpen).every(Boolean);

  const toggleAllDetailsSections = () => {
    setDetailsSectionOpen({
      outline: !areAllDetailsSectionsOpen,
      summary: !areAllDetailsSectionsOpen,
      tags: !areAllDetailsSectionsOpen,
      references: !areAllDetailsSectionsOpen,
      mentions: !areAllDetailsSectionsOpen,
      attachments: !areAllDetailsSectionsOpen,
      timestamps: !areAllDetailsSectionsOpen,
      actions: !areAllDetailsSectionsOpen,
    });
  };

  const {
    commitPageTitleDraft,
    handleCopyDocument,
    handleDeletePage,
    handleSelectPageEmoji,
    handleToggleFavorite,
    persistSelectedPageProperties,
    togglePageFavorite,
  } = useNotePageActions({
    selectedPageId,
    selectedPage,
    selectedPageProperties,
    selectedPageSummary,
    selectedPageTags,
    pageTitleDraft,
    activePageEmoji,
    summaryDraft,
    tagsDraft,
    blockContentDrafts,
    orderedVisibleBlockIds,
    selectedBlockMap,
    setPageTitleDraft,
    setPageTitleError,
    setPageEmojiDraft,
    setIsEmojiPickerOpen,
    setIsDeletingPage,
    setIsDeleteDialogOpen,
    onDeleteSuccess: () => {
      transitionToOverview();
      startTransition(() => {
        router.push("/notes");
      });
    },
  });

  const showDesktopUpdatedTimestamp = Boolean(editorUpdatedTimestamp && !showEditorOverlay && !isLoading && !showSelectedPageLoading && selectedPage);
  const showMobileUpdatedTimestamp = Boolean(editorUpdatedTimestamp && !showEditorOverlay);
  const desktopGridColumns = showDesktopPagesRail && showDesktopDetailsRail
    ? "sm:grid-cols-[280px_minmax(0,1fr)_320px]"
    : showDesktopPagesRail
      ? "sm:grid-cols-[280px_minmax(0,1fr)_44px]"
      : showDesktopDetailsRail
        ? "sm:grid-cols-[44px_minmax(0,1fr)_320px]"
        : "sm:grid-cols-[44px_minmax(0,1fr)_44px]";

  const desktopPagesRestoreButton = !showDesktopPagesRail ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setShowDesktopPagesRail(true)}
      className="hidden size-8 rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
      aria-label="Show pages panel"
    >
      <PanelLeftOpen className="h-4 w-4" />
    </Button>
  ) : null;

  const desktopDetailsRestoreButton = !showDesktopDetailsRail ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setShowDesktopDetailsRail(true)}
      className="hidden size-8 rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
      aria-label="Show details panel"
    >
      <PanelRightOpen className="h-4 w-4" />
    </Button>
  ) : null;

  const desktopDetailsRailHeader = showDesktopDetailsRail ? (
    <div className="hidden w-full items-center justify-between gap-3 sm:flex">
      <p className="text-sm font-semibold text-foreground">Details</p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleAllDetailsSections}
          className="h-8 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {areAllDetailsSectionsOpen ? "Collapse all" : "Expand all"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShowDesktopDetailsRail(false)}
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Hide details panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  const navigationRail = (
    <NotesNavigationRail
      isLoading={isLoading}
      normalizedPages={normalizedPages}
      favoritePages={favoritePages}
      recentAccessPages={recentAccessPages}
      tagDirectory={tagDirectory}
      tagDirectoryOpen={tagDirectoryOpen}
      pageRailSectionOpen={pageRailSectionOpen}
      selectedPageId={selectedPageId}
      areAllSectionsOpen={areAllPageRailSectionsOpen}
      onToggleAllSections={toggleAllPageRailSections}
      onTogglePageRailSection={togglePageRailSection}
      onToggleTagDirectoryGroup={toggleTagDirectoryGroup}
      onSelectPage={transitionToEditor}
    />
  );

  const detailsRail = (
    <NotesDetailsRail
      selectedPage={selectedPage}
      detailsSectionOpen={detailsSectionOpen}
      pageOutline={pageOutline}
      summaryDraft={summaryDraft}
      tagsDraft={tagsDraft}
      linkedReferences={linkedReferences}
      pageTagMentions={pageTagMentions}
      selectedPageAttachments={selectedPageAttachments}
      selectedBlocks={selectedBlocks}
      createdTimestamp={createdTimestamp}
      isLoadingLinkedReferences={isLoadingLinkedReferences}
      isLoadingTagMentions={isLoadingTagMentions}
      isLoadingAttachments={isLoadingAttachments}
      areAllDetailsSectionsOpen={areAllDetailsSectionsOpen}
      onToggleAllDetailsSections={toggleAllDetailsSections}
      onToggleDetailsSection={toggleDetailsSection}
      onSetSummaryDraft={setSummaryDraft}
      onSetTagsDraft={setTagsDraft}
      onPersistSelectedPageProperties={persistSelectedPageProperties}
      onSetFocusTarget={setFocusTarget}
      onOpenDeleteDialog={() => {
        setIsMobileDetailsDrawerOpen(false);
        setIsDeleteDialogOpen(true);
      }}
      onHandleCopyDocument={handleCopyDocument}
    />
  );

  const handleMobileEdgeSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileViewport || isDeleteDialogOpen || isPageSearchOpen || isMobilePagesDrawerOpen || isMobileDetailsDrawerOpen) {
      edgeSwipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      edgeSwipeStartRef.current = null;
      return;
    }

    const { clientX, clientY } = touch;
    const viewportWidth = window.innerWidth;

    if (clientX <= MOBILE_EDGE_SWIPE_START_PX) {
      edgeSwipeStartRef.current = { x: clientX, y: clientY, edge: "left" };
      return;
    }

    if (clientX >= viewportWidth - MOBILE_EDGE_SWIPE_START_PX) {
      edgeSwipeStartRef.current = { x: clientX, y: clientY, edge: "right" };
      return;
    }

    edgeSwipeStartRef.current = null;
  };

  const handleMobileEdgeSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const swipeStart = edgeSwipeStartRef.current;
    edgeSwipeStartRef.current = null;

    if (!swipeStart || !isMobileViewport || isDeleteDialogOpen || isPageSearchOpen) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = Math.abs(touch.clientY - swipeStart.y);
    if (deltaY > MOBILE_EDGE_SWIPE_MAX_VERTICAL_DRIFT_PX) {
      return;
    }

    if (swipeStart.edge === "left" && deltaX >= MOBILE_EDGE_SWIPE_TRIGGER_PX) {
      setIsMobileDetailsDrawerOpen(false);
      setIsMobilePagesDrawerOpen(true);
      return;
    }

    if (swipeStart.edge === "right" && deltaX <= -MOBILE_EDGE_SWIPE_TRIGGER_PX && (detailsRail || showSelectedPageLoading)) {
      setIsMobilePagesDrawerOpen(false);
      setIsMobileDetailsDrawerOpen(true);
    }
  };

  return (
    <div
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background"
      onTouchStart={handleMobileEdgeSwipeStart}
      onTouchEnd={handleMobileEdgeSwipeEnd}
    >
      {isDisplayingOverview || showEditorAppHeader ? (
        <AppHeader
          app={notesApp}
          actions={isDisplayingOverview ? (
            <Button
              onClick={handleCreateStarterPage}
              variant="ghost"
              size="sm"
              disabled={isCreatingPage}
              className="gap-1.5 rounded-full text-xs h-8 px-2.5 hover:text-amber-700 dark:hover:text-amber-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isCreatingPage ? "Creating..." : "Page"}</span>
            </Button>
          ) : undefined}
        />
      ) : null}

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:overflow-hidden sm:pb-4 md:py-8 md:pb-8">
        <div className="mx-auto max-w-[1600px] space-y-4 sm:flex sm:h-full sm:min-h-0 sm:flex-col sm:space-y-0">
          {isDisplayingOverview ? (
            <NotesOverview
              isPageSearchOpen={isPageSearchOpen}
              overviewSearchTriggerRef={overviewSearchTriggerRef}
              overviewFavoritePagesToRender={overviewFavoritePagesToRender}
              overviewRecentPagesToRender={overviewRecentPagesToRender}
              showOverviewOverlay={showOverviewOverlay}
              showOverviewLoading={showOverviewLoading}
              shouldAnimateOverviewContent={shouldAnimateOverviewContent}
              onOpenSearch={() => setIsPageSearchOpen(true)}
              onSelectPage={transitionToEditor}
              onToggleFavorite={togglePageFavorite}
            />
          ) : (
            <>
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 sm:hidden">
                <MobileRailDrawer
                  direction="left"
                  triggerIcon={NotebookTabs}
                  triggerLabel="Pages"
                  title="Pages"
                  description="Browse and create notes pages."
                  open={isMobilePagesDrawerOpen}
                  onOpenChange={setIsMobilePagesDrawerOpen}
                >
                  {navigationRail}
                </MobileRailDrawer>

                <div className="min-w-0 flex flex-1 items-center justify-center gap-1.5 px-2 text-center">
                  {showMobileUpdatedTimestamp ? (
                    <button
                      type="button"
                      onClick={revealAbsoluteUpdatedTime}
                      key={editorUpdatedTimestamp?.absolute}
                      className="inline-flex max-w-full items-center justify-center truncate text-[11px] text-muted-foreground/75 animate-fade-slide-in-soft transition-colors hover:text-foreground"
                    >
                      {showAbsoluteUpdatedTime ? editorUpdatedTimestamp?.absolute : `Updated ${editorUpdatedTimestamp?.relative}`}
                    </button>
                  ) : <span className="block h-4" aria-hidden="true" />}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowEditorAppHeader((current) => !current)}
                    className="size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label={showEditorAppHeader ? "Hide app header" : "Show app header"}
                  >
                    {showEditorAppHeader ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>

                {detailsRail || showSelectedPageLoading ? (
                  <MobileRailDrawer
                    direction="right"
                    triggerIcon={Files}
                    triggerLabel="Details"
                    title="Details"
                    description="Summary, tags, files, timestamps, and actions for the current page."
                    open={isMobileDetailsDrawerOpen}
                    onOpenChange={setIsMobileDetailsDrawerOpen}
                  >
                    {detailsRail ?? <NotesDetailsRailSkeleton />}
                  </MobileRailDrawer>
                ) : <div />}
              </div>

              <section className={`grid gap-4 sm:h-full sm:min-h-0 sm:grid-rows-[auto_minmax(0,1fr)] sm:gap-y-2 ${desktopGridColumns}`}>
                {showDesktopPagesRail ? (
                  <div className="hidden h-8 items-center sm:flex">
                    <NotesNavigationRailHeader
                      showDesktopPagesRail={showDesktopPagesRail}
                      areAllSectionsOpen={areAllPageRailSectionsOpen}
                      onToggleAllSections={toggleAllPageRailSections}
                      onHideDesktopPagesRail={() => setShowDesktopPagesRail(false)}
                    />
                  </div>
                ) : (
                  <div className="hidden h-8 items-center justify-center sm:flex">
                    {desktopPagesRestoreButton}
                  </div>
                )}

                <div className="hidden h-8 items-center sm:flex">
                  <div className="mx-auto grid w-full max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 md:gap-x-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        transitionToOverview();
                        router.push("/notes");
                      }}
                      className="-ml-2 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground md:size-9"
                      aria-label="Back to notes list"
                    >
                      <ArrowLeft className="h-6 w-6 md:h-7 md:w-7" />
                    </Button>
                    {showDesktopUpdatedTimestamp ? (
                      <button
                        type="button"
                        onClick={revealAbsoluteUpdatedTime}
                        key={editorUpdatedTimestamp?.absolute}
                        className="inline-flex items-center text-[11px] text-muted-foreground/75 animate-fade-slide-in-soft transition-colors hover:text-foreground"
                      >
                        {showAbsoluteUpdatedTime ? editorUpdatedTimestamp?.absolute : `Updated ${editorUpdatedTimestamp?.relative}`}
                      </button>
                    ) : <span className="block h-4 w-32" aria-hidden="true" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowEditorAppHeader((current) => !current)}
                      className="mt-1 flex size-8 shrink-0 items-center justify-center justify-self-end rounded-full text-muted-foreground hover:text-foreground md:size-9"
                      aria-label={showEditorAppHeader ? "Hide app header" : "Show app header"}
                    >
                      {showEditorAppHeader ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {showDesktopDetailsRail ? (
                  <div className="hidden h-8 items-center sm:flex">
                    {desktopDetailsRailHeader}
                  </div>
                ) : (
                  <div className="hidden h-8 items-center justify-center sm:flex">
                    {desktopDetailsRestoreButton}
                  </div>
                )}

                {showDesktopPagesRail ? (
                  <aside className="hidden sm:block sm:min-h-0 sm:overflow-hidden">{navigationRail}</aside>
                ) : <div className="hidden sm:block" aria-hidden="true" />}

                <section className="min-w-0 sm:min-h-0 sm:overflow-y-auto">
                  <NotesEditorContent
                    editorContent={editorContentToRender}
                    showSelectedPageLoading={showSelectedPageLoading}
                    showEditorOverlay={showEditorOverlay}
                    shouldAnimateEditorContent={shouldAnimateEditorContent}
                    pageTitleDraft={pageTitleDraft}
                    pageTitleError={pageTitleError}
                    isEmojiPickerOpen={isEmojiPickerOpen}
                    activePageEmoji={activePageEmoji}
                    focusTarget={focusTarget}
                    notePageTitles={notePageTitles}
                    onBack={() => {
                      transitionToOverview();
                      router.push("/notes");
                    }}
                    onTitleChange={(value) => {
                      setPageTitleDraft(value);
                      setPageTitleError(null);
                    }}
                    onCommitTitle={commitPageTitleDraft}
                    onToggleFavorite={handleToggleFavorite}
                    onEmojiPickerOpenChange={setIsEmojiPickerOpen}
                    onSelectEmoji={handleSelectPageEmoji}
                    onCreateFirstBlock={handleCreateRootBlock}
                    onFocusApplied={() => setFocusTarget(null)}
                    onFocusBlock={(blockId, placement) => setFocusTarget({ blockId, placement })}
                    onOpenPageReference={handleOpenPageReference}
                    onCreateSibling={handleCreateSiblingBlock}
                    onCreateEmptySibling={handleCreateEmptySiblingBlock}
                    onCreateSiblings={handleCreateSiblingBlocks}
                    onMergeWithPrevious={handleMergeWithPreviousBlock}
                    onCommitContent={handleCommitBlockContent}
                    onIndent={handleIndentBlock}
                    onOutdent={handleOutdentBlock}
                    onDelete={handleDeleteBlock}
                    onUpdateContent={handleUpdateBlockContent}
                  />
                </section>

                {showDesktopDetailsRail ? (
                  <aside className="hidden sm:flex sm:min-h-0 sm:overflow-hidden">{detailsRail ?? (showSelectedPageLoading ? <NotesDetailsRailSkeleton showHeader={false} /> : null)}</aside>
                ) : <div className="hidden sm:block" aria-hidden="true" />}
              </section>
            </>
          )}
        </div>
      </main>

      <MobileBottomFabs
        app={notesApp}
        centerUseShell={false}
        centerContent={isDisplayingOverview ? (
          <Button
            onClick={handleCreateStarterPage}
            size="icon"
            disabled={isCreatingPage}
            className="size-12 rounded-full border border-amber-200 bg-amber-100 text-amber-700 shadow-lg transition-all duration-200 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/80 dark:text-amber-300 dark:hover:bg-amber-800"
            aria-label="Create new page"
          >
            <Plus className="h-5 w-5" />
          </Button>
        ) : undefined}
      />

      <NotesPageSearchPopup
        open={isPageSearchOpen}
        query={pageSearchQuery}
        titleToCreate={normalizedSearchQuery}
        filteredPages={filteredSearchPages}
        canCreatePage={canCreatePageFromSearch}
        isCreatingPage={isCreatingPage}
        anchorRef={overviewSearchTriggerRef}
        onOpenChange={setIsPageSearchOpen}
        onQueryChange={setPageSearchQuery}
        onSelectPage={handleSelectPageFromSearch}
        onCreatePage={handleCreatePageFromSearch}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the page, its blocks, attachments, and local note links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPage}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              disabled={isDeletingPage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPage ? "Deleting..." : "Delete page"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}