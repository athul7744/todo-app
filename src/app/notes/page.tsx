"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Copy, FileText, Files, Hash, Link2, Loader2, NotebookTabs, Paperclip, Plus, Settings2, Star, Tags, Trash2, type LucideIcon } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { MobileBottomFabs } from "@/components/MobileBottomFabs";
import { NotesBlockTree } from "@/components/notes/NotesBlockTree";
import { NotesDetailsRailSkeleton, NotesEditorMainSkeleton, NotesNavigationRailSkeleton, NotesOverviewListSkeleton, NotesPageSkeleton } from "@/components/notes/NotesPageSkeleton";
import { MobileRailDrawer } from "../../components/notes/MobileRailDrawer";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLinkedNoteReferences, useNoteCounts, useNotePageWithBlocks, usePageAttachments, usePageTagMentions, useRecentNotePages, type NoteBlockRow, type NotePageRow } from "@/hooks/use-notes";
import { extractNoteText } from "@/lib/notes/notes-content";
import { getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";
import { createNoteBlock, createStarterPage, deleteNoteBlock, deleteNotePage, moveNoteBlock, updateNoteBlock, updateNotePageProperties, updateNotePageTitle, type JsonValue } from "@/lib/notes/notes";
import { getApp } from "@/lib/shared/apps";
import { flushAllUpdates, flushUpdate, hasPendingWrites } from "@/lib/shared/debounced-update";
import { getRankAfterItem, getRankAtParentEnd } from "@/lib/shared/ranked-order";
import { formatRelativeTime } from "@/lib/shared/utils";

const notesApp = getApp("notes");

type NormalizedNotePage = NotePageRow & {
  summary: string | null;
  tags: string[];
};

type TagDirectoryEntry = {
  key: string;
  label: string;
  count: number;
  pages: NormalizedNotePage[];
};

type OptimisticBlockStructure = Pick<NoteBlockRow, "parent_block_id" | "sort_rank">;

type OutlineEntry = {
  blockId: string;
  level: number;
  text: string;
};

type RichContentNode = {
  type?: string;
  text?: string;
  attrs?: {
    level?: number;
  };
  content?: RichContentNode[];
};

function formatTimestampLabel(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    relative: formatRelativeTime(date),
    absolute: date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
  };
}

function extractTextFromRichContent(node: RichContentNode | null | undefined): string {
  if (!node) return "";

  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = Array.isArray(node.content)
    ? node.content.map((child) => extractTextFromRichContent(child)).join("")
    : "";

  return `${ownText}${childText}`;
}

function collectOutlineHeadings(node: RichContentNode | null | undefined, headings: Array<{ level: number; text: string }>) {
  if (!node) return;

  if (node.type === "heading") {
    const text = extractTextFromRichContent(node).trim();
    if (text) {
      headings.push({
        level: typeof node.attrs?.level === "number" ? node.attrs.level : 1,
        text,
      });
    }
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((child) => collectOutlineHeadings(child, headings));
  }
}

function extractOutlineEntries(blockId: string, rawContent: string | null | undefined): OutlineEntry[] {
  if (!rawContent) return [];

  try {
    const parsed = JSON.parse(rawContent) as RichContentNode;
    const headings: Array<{ level: number; text: string }> = [];
    collectOutlineHeadings(parsed, headings);

    return headings.map((heading) => ({
      blockId,
      level: Math.min(Math.max(heading.level, 1), 3),
      text: heading.text,
    }));
  } catch {
    return [];
  }
}

function DetailsSection({
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
  children: React.ReactNode;
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

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

function DetailsRailCardSkeleton({ lines = 2 }: { lines?: number }) {
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

function attachmentLabel(filePath: string | null | undefined) {
  if (!filePath) return "Attachment";

  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? filePath;
}

function useSmoothedLoading(
  isLoading: boolean,
  loadingKey: string,
  minVisibleMs = 160,
  settleDelayMs = 80
) {
  const [showLoading, setShowLoading] = useState(true);
  const visibleSinceRef = useRef<number>(Date.now());

  useEffect(() => {
    visibleSinceRef.current = Date.now();
    setShowLoading(true);
  }, [loadingKey]);

  useEffect(() => {
    if (isLoading) {
      if (!showLoading) {
        visibleSinceRef.current = Date.now();
        setShowLoading(true);
      }
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const timeoutId = window.setTimeout(() => {
      setShowLoading(false);
    }, Math.max(minVisibleMs - elapsed, 0) + settleDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, minVisibleMs, settleDelayMs, showLoading]);

  return showLoading;
}

function createBlockDocument(text = ""): JsonValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text.trim().length > 0 ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function parseProperties(raw: string | null) {
  if (!raw) return {} as Record<string, unknown>;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPageId = searchParams.get("page");
  const selectedPageIdForWrite: string | undefined = selectedPageId ?? undefined;
  const [pendingSurfaceKey, setPendingSurfaceKey] = useState<string | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [pageTitleDraft, setPageTitleDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [blockContentDrafts, setBlockContentDrafts] = useState<Record<string, string>>({});
  const [optimisticBlockStructure, setOptimisticBlockStructure] = useState<Record<string, OptimisticBlockStructure>>({});
  const [optimisticUpdatedAt, setOptimisticUpdatedAt] = useState<string | null>(null);
  const [showAbsoluteUpdatedTime, setShowAbsoluteUpdatedTime] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ blockId: string; placement: "start" | "end" } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [pageRailSectionOpen, setPageRailSectionOpen] = useState({
    favorites: true,
    recent: true,
    tags: true,
  });
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

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasPendingWrites()) {
        return;
      }

      flushAllUpdates();
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const { isLoading: isLoadingCounts } = useNoteCounts();
  const { pages: recentPages = [], isLoading: isLoadingRecentPages } = useRecentNotePages(8);
  const { page: selectedPage, blocks: selectedBlocks, isLoading: isLoadingSelectedPage } = useNotePageWithBlocks(selectedPageId);
  const { attachments: selectedPageAttachments, isLoading: isLoadingAttachments } = usePageAttachments(selectedPageId);
  const { references: linkedReferences, isLoading: isLoadingLinkedReferences } = useLinkedNoteReferences(selectedPageId);
  const { tags: pageTagMentions, isLoading: isLoadingTagMentions } = usePageTagMentions(selectedPageId);

  const structuredBlocks = useMemo(
    () => [...selectedBlocks.map((block) => {
      const optimisticStructure = optimisticBlockStructure[block.id];

      return optimisticStructure
        ? {
            ...block,
            parent_block_id: optimisticStructure.parent_block_id,
            sort_rank: optimisticStructure.sort_rank,
          }
        : block;
    })].sort((left, right) => (left.sort_rank ?? "").localeCompare(right.sort_rank ?? "")),
    [optimisticBlockStructure, selectedBlocks]
  );

  const getSiblingBlocks = (parentBlockId: string | null | undefined, excludeBlockId?: string) => {
    const normalizedParentBlockId = parentBlockId ?? null;

    return structuredBlocks.filter((block) => {
      if ((block.parent_block_id ?? null) !== normalizedParentBlockId) {
        return false;
      }

      return excludeBlockId ? block.id !== excludeBlockId : true;
    });
  };

  const getSortRankAtParentEnd = (parentBlockId: string | null | undefined, excludeBlockId?: string) => {
    return getRankAtParentEnd(structuredBlocks, parentBlockId, (block) => block.parent_block_id, excludeBlockId);
  };

  const getSortRankAfterBlock = (
    siblingBlockId: string,
    parentBlockId: string | null | undefined,
    excludeBlockId?: string
  ) => {
    return getRankAfterItem(structuredBlocks, siblingBlockId, parentBlockId, (block) => block.parent_block_id, excludeBlockId);
  };

  const applyOptimisticBlockMove = (blockId: string, parentBlockId: string | null, sortRank: string) => {
    setOptimisticBlockStructure((current) => ({
      ...current,
      [blockId]: {
        parent_block_id: parentBlockId,
        sort_rank: sortRank,
      },
    }));
  };

  const handleCreateStarterPage = async () => {
    if (isCreatingPage) return;

    setIsCreatingPage(true);

    try {
      const pageId = await createStarterPage();
      transitionToEditor(pageId);
      startTransition(() => {
        router.push(`/notes?page=${pageId}`);
      });
    } finally {
      setIsCreatingPage(false);
    }
  };

  const handleCreateRootBlock = async () => {
    if (!selectedPageId || isCreatingBlock) return;

    setIsCreatingBlock(true);

    try {
      const blockId = await createNoteBlock({
        pageId: selectedPageId,
        sortRank: getSortRankAtParentEnd(null),
        type: "text",
        content: createBlockDocument(),
      });
      setFocusTarget({ blockId, placement: "end" });
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleCreateSiblingBlock = async (
    blockId: string,
    parentBlockId: string | null | undefined,
    nextContent: JsonValue,
    nextSiblingContent?: JsonValue
  ) => {
    if (!selectedPageId || isCreatingBlock) return;

    setIsCreatingBlock(true);

    try {
      const serializedContent = JSON.stringify(nextContent);

      flushSync(() => {
        setBlockContentDrafts((currentDrafts) => ({
          ...currentDrafts,
          [blockId]: serializedContent,
        }));
      });

      updateNoteBlock({
        blockId,
        pageId: selectedPageId ?? undefined,
        content: nextContent,
      });

      markPageEdited();

      await flushUpdate(blockId, "blocks");

      const nextBlockId = await createNoteBlock({
        pageId: selectedPageId,
        parentBlockId: parentBlockId ?? null,
        sortRank: getSortRankAfterBlock(blockId, parentBlockId),
        type: "text",
        content: nextSiblingContent ?? createBlockDocument(),
      });
      markPageEdited();
      setFocusTarget({ blockId: nextBlockId, placement: "end" });
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleIndentBlock = (blockId: string, nextParentBlockId: string) => {
    const nextSortRank = getSortRankAtParentEnd(nextParentBlockId, blockId);

    flushSync(() => {
      setFocusTarget({ blockId, placement: "start" });
      applyOptimisticBlockMove(blockId, nextParentBlockId, nextSortRank);
      markPageEdited();
    });

    void moveNoteBlock({
      blockId,
      pageId: selectedPageIdForWrite,
      parentBlockId: nextParentBlockId,
      sortRank: nextSortRank,
    });
  };

  const handleOutdentBlock = (blockId: string, nextParentBlockId?: string | null) => {
    const currentBlock = structuredBlocks.find((block) => block.id === blockId) ?? null;
    const currentParentBlock = currentBlock?.parent_block_id
      ? structuredBlocks.find((block) => block.id === currentBlock.parent_block_id) ?? null
      : null;

    const nextSortRank = currentParentBlock
      ? getSortRankAfterBlock(currentParentBlock.id, nextParentBlockId, blockId)
      : getSortRankAtParentEnd(nextParentBlockId, blockId);

    flushSync(() => {
      setFocusTarget({ blockId, placement: "start" });
      applyOptimisticBlockMove(blockId, nextParentBlockId ?? null, nextSortRank);
      markPageEdited();
    });

    void moveNoteBlock({
      blockId,
      pageId: selectedPageIdForWrite,
      parentBlockId: nextParentBlockId ?? null,
      sortRank: nextSortRank,
    });
  };

  const handleDeleteBlock = async (blockId: string) => {
    const blockIndex = orderedVisibleBlockIds.findIndex((visibleBlockId) => visibleBlockId === blockId);
    const previousBlockId = blockIndex > 0
      ? orderedVisibleBlockIds[blockIndex - 1] ?? null
      : orderedVisibleBlockIds[blockIndex + 1] ?? null;

    await deleteNoteBlock(blockId, selectedPageId ?? undefined);
    markPageEdited();
    setFocusTarget(previousBlockId ? { blockId: previousBlockId, placement: "end" } : null);
  };

  const handleUpdateBlockContent = (blockId: string, nextContent: JsonValue) => {
    const serializedContent = JSON.stringify(nextContent);
    const currentSerialized = blockContentDrafts[blockId] ?? selectedBlockMap.get(blockId)?.content ?? null;

    if (currentSerialized === serializedContent) {
      return;
    }

    setBlockContentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [blockId]: serializedContent,
    }));

    markPageEdited();

    updateNoteBlock({
      blockId,
      pageId: selectedPageIdForWrite,
      content: nextContent,
    });
  };

  const handleCommitBlockContent = (blockId: string, nextContent: JsonValue) => {
    const serializedContent = JSON.stringify(nextContent);
    const currentSerialized = blockContentDrafts[blockId] ?? selectedBlockMap.get(blockId)?.content ?? null;

    if (currentSerialized === serializedContent) {
      return;
    }

    setBlockContentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [blockId]: serializedContent,
    }));

    markPageEdited();

    updateNoteBlock({
      blockId,
      pageId: selectedPageIdForWrite,
      content: nextContent,
    });

    void flushUpdate(blockId, "blocks");
  };

  const normalizedPages = useMemo<NormalizedNotePage[]>(
    () =>
      recentPages.map((page) => {
        const properties = parseProperties(page.properties);
        const summary = typeof properties.summary === "string" ? properties.summary : null;
        const tags = Array.isArray(properties.tags)
          ? properties.tags.filter((tag): tag is string => typeof tag === "string")
          : [];

        return {
          ...page,
          summary,
          tags,
        };
      }),
    [recentPages]
  );

  const selectedPageProperties = useMemo(
    () => parseProperties(selectedPage?.properties ?? null),
    [selectedPage?.properties]
  );
  const selectedBlockMap = useMemo(
    () => new Map(structuredBlocks.map((block) => [block.id, block])),
    [structuredBlocks]
  );
  const orderedVisibleBlockIds = useMemo(
    () => getVisibleNoteBlockIds(structuredBlocks),
    [structuredBlocks]
  );

  const selectedPageTags = useMemo(
    () => Array.isArray(selectedPageProperties.tags)
      ? selectedPageProperties.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    [selectedPageProperties.tags]
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
  const absoluteUpdatedTimeTimeoutRef = useRef<number | null>(null);

  const selectedPageSummary = typeof selectedPageProperties.summary === "string"
    ? selectedPageProperties.summary
    : null;
  const createdTimestamp = formatTimestampLabel(selectedPage?.created_at ?? null);
  const effectiveUpdatedAt = optimisticUpdatedAt ?? selectedPage?.updated_at ?? null;
  const updatedTimestamp = formatTimestampLabel(effectiveUpdatedAt);

  const markPageEdited = () => {
    setOptimisticUpdatedAt(new Date().toISOString());
  };

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
      setSummaryDraft("");
      setTagsDraft("");
      setBlockContentDrafts({});
      setOptimisticBlockStructure({});
      setOptimisticUpdatedAt(null);
      setShowAbsoluteUpdatedTime(false);
      setFocusTarget(null);
      return;
    }

    setPageTitleDraft(selectedPage?.title ?? "");
    setSummaryDraft(selectedPageSummary ?? "");
    setTagsDraft(selectedPageTags.join(", "));
    setBlockContentDrafts({});
    setOptimisticBlockStructure({});
    setOptimisticUpdatedAt(null);
    setShowAbsoluteUpdatedTime(false);
    setFocusTarget(null);
  }, [selectedPage?.id]);

  useEffect(() => {
    if (!optimisticUpdatedAt || !selectedPage?.updated_at) {
      return;
    }

    if (new Date(selectedPage.updated_at).getTime() >= new Date(optimisticUpdatedAt).getTime()) {
      setOptimisticUpdatedAt(null);
    }
  }, [optimisticUpdatedAt, selectedPage?.updated_at]);

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
    favoritePages: typeof favoritePages;
    recentAccessPages: typeof recentAccessPages;
  } | null>(null);
  const [cachedEditorContent, setCachedEditorContent] = useState<{
    pageId: string;
    title: string;
    favorite: boolean;
    blockCount: number;
    backlinkCount: number;
    blocks: typeof displayBlocks;
  } | null>(null);

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

  const transitionToOverview = () => {
    setPendingSurfaceKey("overview");
  };

  const transitionToEditor = (pageId: string) => {
    setPendingSurfaceKey(`editor:${pageId}`);
  };

  const handleToggleFavorite = () => {
    if (!selectedPageId) return;

    markPageEdited();

    updateNotePageProperties(selectedPageId, {
      ...(selectedPageProperties as Record<string, null | boolean | number | string | unknown[] | Record<string, unknown>>),
      favorite: selectedPageProperties.favorite !== true,
    });
  };

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

  const handleDeletePage = async () => {
    if (!selectedPageId) return;

    setIsDeletingPage(true);

    try {
      await deleteNotePage(selectedPageId);
      transitionToOverview();
      startTransition(() => {
        router.push("/notes");
      });
    } finally {
      setIsDeletingPage(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCopyDocument = async () => {
    if (!selectedPage) return;

    const lines = [selectedPage.title?.trim() || "Untitled page"];

    if (selectedPageSummary?.trim()) {
      lines.push("", selectedPageSummary.trim());
    }

    if (selectedPageTags.length > 0) {
      lines.push("", `Tags: ${selectedPageTags.map((tag) => `#${tag}`).join(", ")}`);
    }

    const blockLines = orderedVisibleBlockIds
      .map((blockId) => {
        const serialized = blockContentDrafts[blockId] ?? selectedBlockMap.get(blockId)?.content ?? null;
        return extractNoteText(serialized);
      })
      .filter((text) => text.length > 0);

    if (blockLines.length > 0) {
      lines.push("", ...blockLines.map((text) => `- ${text}`));
    }

    await navigator.clipboard.writeText(lines.join("\n"));
  };

  const persistSelectedPageProperties = (nextSummary: string, nextTagsRaw: string) => {
    if (!selectedPageId) return;

    markPageEdited();

    const nextTags = nextTagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    updateNotePageProperties(selectedPageId, {
      ...(selectedPageProperties as Record<string, null | boolean | number | string | unknown[] | Record<string, unknown>>),
      summary: nextSummary,
      tags: nextTags,
    });
  };

  useEffect(() => {
    if (isLoading) return;
    setCachedOverviewContent({
      favoritePages,
      recentAccessPages,
    });
  }, [favoritePages, isLoading, recentAccessPages]);

  useEffect(() => {
    if (isLoadingSelectedPage || !selectedPage) return;
    setCachedEditorContent({
      pageId: selectedPage.id,
      title: pageTitleDraft || selectedPage.title || "Untitled page",
      favorite: selectedPageProperties.favorite === true,
      blockCount: selectedBlocks.length,
      backlinkCount: linkedReferences.length,
      blocks: displayBlocks,
    });
  }, [displayBlocks, isLoadingSelectedPage, linkedReferences.length, pageTitleDraft, selectedBlocks.length, selectedPage, selectedPageProperties.favorite]);

  const overviewFavoritePagesToRender = showOverviewLoading
    ? cachedOverviewContent?.favoritePages ?? []
    : favoritePages;
  const overviewRecentPagesToRender = showOverviewLoading
    ? cachedOverviewContent?.recentAccessPages ?? []
    : recentAccessPages;
  const showOverviewOverlay = showOverviewLoading && cachedOverviewContent !== null;
  const shouldAnimateOverviewContent = !showOverviewLoading && cachedOverviewContent === null;
  const editorContentToRender = showSelectedPageLoading
    ? cachedEditorContent
    : selectedPage
      ? {
          pageId: selectedPage.id,
          title: pageTitleDraft || selectedPage.title || "Untitled page",
          favorite: selectedPageProperties.favorite === true,
          blockCount: selectedBlocks.length,
          backlinkCount: linkedReferences.length,
          blocks: displayBlocks,
        }
      : null;
  const showEditorOverlay = showSelectedPageLoading && cachedEditorContent !== null;
  const shouldAnimateEditorContent = !showSelectedPageLoading && cachedEditorContent === null;
  const editorUpdatedTimestamp = editorContentToRender?.pageId === selectedPage?.id
    ? updatedTimestamp
    : null;
  const showDesktopUpdatedTimestamp = Boolean(editorUpdatedTimestamp && !showEditorOverlay && !isLoading && !showSelectedPageLoading && selectedPage);
  const showMobileUpdatedTimestamp = Boolean(editorUpdatedTimestamp && !showEditorOverlay);

  const renderNavigationPageLink = (
    page: NormalizedNotePage,
    {
      showTags = true,
      trailing,
      className,
    }: {
      showTags?: boolean;
      trailing?: React.ReactNode;
      className?: string;
    } = {}
  ) => (
    <Link
      key={page.id}
      href={`/notes?page=${page.id}`}
      onClick={() => transitionToEditor(page.id)}
      className={`block rounded-lg px-3 py-1.5 transition-smooth ${
        page.id === selectedPageId
          ? "text-amber-700 dark:text-amber-300"
          : "text-foreground hover:bg-accent/60"
      } ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${page.id === selectedPageId ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`} />
          <div className="min-w-0">
            <p className={`truncate text-[12px] font-medium ${page.id === selectedPageId ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{page.title || "Untitled page"}</p>
            {page.summary ? (
              <p className={`mt-0.5 line-clamp-2 text-[11px] leading-4.5 ${page.id === selectedPageId ? "text-amber-700/80 dark:text-amber-300/80" : "text-muted-foreground"}`}>{page.summary}</p>
            ) : null}
          </div>
        </div>
        {trailing ?? <ArrowRight className={`mt-0.5 h-4 w-4 shrink-0 ${page.id === selectedPageId ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`} />}
      </div>
      {showTags && page.tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {page.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${page.id === selectedPageId ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );

  const navigationRail = (
    <div className="animate-fade-slide-in space-y-4 py-1 lg:flex lg:min-h-0 lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:gap-4 lg:space-y-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookTabs className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Pages</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleAllPageRailSections}
          className="h-8 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {areAllPageRailSectionsOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <div className="space-y-4 pr-1 pb-4 transition-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {isLoading ? (
          <div className="px-1 py-1">
            <NotesNavigationRailSkeleton showHeader={false} />
          </div>
        ) : normalizedPages.length === 0 ? (
          <div className="px-2 py-4 text-[13px] text-muted-foreground">No pages yet. Create one to start writing.</div>
        ) : (
          <div className="space-y-4">
            <DetailsSection
              title="Favorites"
              icon={Star}
              accentClassName="bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
              isOpen={pageRailSectionOpen.favorites}
              onToggle={() => togglePageRailSection("favorites")}
            >
              <div className="space-y-1">
                {favoritePages.length === 0 ? (
                  <div className="px-3 py-1 text-[13px] text-muted-foreground">No favorites yet.</div>
                ) : (
                  favoritePages.map((page) => renderNavigationPageLink(page, {
                    trailing: <Star className="mt-0.5 h-4 w-4 shrink-0 fill-current text-amber-500" />,
                  }))
                )}
              </div>
            </DetailsSection>

            <DetailsSection
              title="Recent / Frequent"
              icon={Clock3}
              accentClassName="bg-sky-500/12 text-sky-700 dark:bg-sky-500/18 dark:text-sky-300"
              isOpen={pageRailSectionOpen.recent}
              onToggle={() => togglePageRailSection("recent")}
            >
              <div className="space-y-1">
                {recentAccessPages.length === 0 ? (
                  <div className="px-3 py-1 text-[13px] text-muted-foreground">No recent pages yet.</div>
                ) : (
                  recentAccessPages.map((page) => renderNavigationPageLink(page))
                )}
              </div>
            </DetailsSection>

            <DetailsSection
              title="Tag Directory"
              icon={Tags}
              accentClassName="bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
              isOpen={pageRailSectionOpen.tags}
              onToggle={() => togglePageRailSection("tags")}
            >
              <div className="space-y-1">
                {tagDirectory.length === 0 ? (
                  <div className="px-3 py-1 text-[13px] text-muted-foreground">No tags yet.</div>
                ) : (
                  tagDirectory.map((entry) => {
                    const isOpen = tagDirectoryOpen[entry.key] ?? false;

                    return (
                      <div key={entry.key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleTagDirectoryGroup(entry.key)}
                          aria-expanded={isOpen}
                          aria-controls={`tag-directory-${entry.key}`}
                          className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:text-foreground"
                        >
                          <span className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                              <Hash className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-foreground">#{entry.label}</span>
                              <span className="block text-[11px] leading-5 text-muted-foreground">{entry.count} page{entry.count === 1 ? "" : "s"}</span>
                            </span>
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                        </button>

                        <div
                          id={`tag-directory-${entry.key}`}
                          className={`grid overflow-hidden transition-all duration-200 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                        >
                          <div className="min-h-0" inert={!isOpen}>
                            <div className={`space-y-1 pl-8 transition-all duration-200 ease-out ${isOpen ? "translate-y-0" : "-translate-y-1"}`} aria-hidden={!isOpen}>
                              {entry.pages.map((page) => renderNavigationPageLink(page, {
                                showTags: false,
                                className: "px-3 py-1.5",
                              }))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </DetailsSection>
          </div>
        )}
      </div>
    </div>
  );

  const detailsRail = selectedPage ? (
    <div className="animate-fade-slide-in space-y-4 py-1 lg:flex lg:min-h-0 lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:gap-4 lg:space-y-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Files className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Details</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleAllDetailsSections}
          className="h-8 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {areAllDetailsSectionsOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <div className="space-y-4 pr-1 pb-4 transition-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <DetailsSection
            title="Outline"
            icon={Files}
            accentClassName="bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300"
            isOpen={detailsSectionOpen.outline}
            onToggle={() => toggleDetailsSection("outline")}
          >
            {pageOutline.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Files className="h-3.5 w-3.5" />No headings yet.</p>
            ) : (
              <div className="mt-2 space-y-1 animate-stagger">
                {pageOutline.map((entry, index) => (
                  <button
                    key={`${entry.blockId}-${index}`}
                    type="button"
                    onClick={() => setFocusTarget({ blockId: entry.blockId, placement: "start" })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-foreground transition-smooth hover:bg-accent"
                    style={{ paddingLeft: `${12 + (entry.level - 1) * 12}px` }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">H{entry.level}</span>
                    <span className="truncate">{entry.text}</span>
                  </button>
                ))}
              </div>
            )}
          </DetailsSection>

          <DetailsSection
            title="Summary"
            icon={FileText}
            accentClassName="bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
            isOpen={detailsSectionOpen.summary}
            onToggle={() => toggleDetailsSection("summary")}
          >
            <Textarea
              value={summaryDraft}
              onChange={(event) => {
                setSummaryDraft(event.target.value);
                persistSelectedPageProperties(event.target.value, tagsDraft);
              }}
              rows={4}
              placeholder="Add page context"
              className="min-h-24 rounded-xl border-0 bg-muted/95 px-3 py-2.5 text-[13px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            />
          </DetailsSection>

          <DetailsSection
            title="Tags"
            icon={Tags}
            accentClassName="bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
            isOpen={detailsSectionOpen.tags}
            onToggle={() => toggleDetailsSection("tags")}
          >
            <Input
              value={tagsDraft}
              onChange={(event) => {
                setTagsDraft(event.target.value);
                persistSelectedPageProperties(summaryDraft, event.target.value);
              }}
              placeholder="comma, separated, tags"
              className="h-10 rounded-xl border-0 bg-muted/95 px-3 text-[13px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
            />
          </DetailsSection>

          <DetailsSection
            title="Linked references"
            icon={Link2}
            accentClassName="bg-sky-500/12 text-sky-700 dark:bg-sky-500/18 dark:text-sky-300"
            isOpen={detailsSectionOpen.references}
            onToggle={() => toggleDetailsSection("references")}
          >
            {isLoadingLinkedReferences ? (
              <div className="mt-2 space-y-2 animate-stagger">
                <DetailsRailCardSkeleton lines={2} />
                <DetailsRailCardSkeleton lines={3} />
                <DetailsRailCardSkeleton lines={2} />
              </div>
            ) : linkedReferences.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Link2 className="h-3.5 w-3.5" />No incoming references.</p>
            ) : (
              <div className="mt-2 space-y-2 animate-stagger">
                {linkedReferences.slice(0, 8).map((reference) => (
                  <div key={`${reference.source_block_id}-${reference.source_page_id}`} className="rounded-xl bg-muted/95 px-3 py-2.5 transition-smooth">
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground"><FileText className="h-3 w-3 text-muted-foreground" />{reference.source_page_title || "Untitled page"}</p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-muted-foreground">{reference.source_block_content ? JSON.parse(reference.source_block_content).content?.[0]?.content?.[0]?.text ?? "Referenced block" : "Referenced block"}</p>
                  </div>
                ))}
              </div>
            )}
          </DetailsSection>

          <DetailsSection
            title="Tag mentions"
            icon={Hash}
            accentClassName="bg-violet-500/12 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300"
            isOpen={detailsSectionOpen.mentions}
            onToggle={() => toggleDetailsSection("mentions")}
          >
            {isLoadingTagMentions ? (
              <div className="mt-2 flex flex-wrap gap-2 animate-stagger">
                <Bone className="h-7 w-24 rounded-full" />
                <Bone className="h-7 w-20 rounded-full" />
                <Bone className="h-7 w-28 rounded-full" />
              </div>
            ) : pageTagMentions.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Hash className="h-3.5 w-3.5" />No inline tags.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2 animate-stagger">
                {pageTagMentions.map((tag) => (
                  <span
                    key={tag.tag_name}
                    className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-smooth dark:bg-amber-500/20 dark:text-amber-300"
                  >
                    #{tag.tag_name} · {tag.mention_count}
                  </span>
                ))}
              </div>
            )}
          </DetailsSection>

          <DetailsSection
            title="Attachments"
            icon={Paperclip}
            accentClassName="bg-cyan-500/12 text-cyan-700 dark:bg-cyan-500/18 dark:text-cyan-300"
            isOpen={detailsSectionOpen.attachments}
            onToggle={() => toggleDetailsSection("attachments")}
          >
            {isLoadingAttachments ? (
              <div className="mt-2 space-y-2 animate-stagger">
                <DetailsRailCardSkeleton lines={1} />
                <DetailsRailCardSkeleton lines={1} />
              </div>
            ) : selectedPageAttachments.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />No attachments yet.</p>
            ) : (
              <div className="mt-2 space-y-2 animate-stagger">
                {selectedPageAttachments.slice(0, 6).map((attachment) => (
                  <div key={attachment.id} className="rounded-xl bg-muted/95 px-3 py-2.5 transition-smooth">
                    <p className="truncate text-[12px] font-medium text-foreground">{attachmentLabel(attachment.file_path)}</p>
                    <p className="mt-1 truncate text-[11px] leading-5 text-muted-foreground">
                      {attachment.sync_state ?? "local"}
                      {attachment.file_path ? ` · ${attachment.file_path}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DetailsSection>

          <DetailsSection
            title="Timestamps"
            icon={Clock3}
            accentClassName="bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300"
            isOpen={detailsSectionOpen.timestamps}
            onToggle={() => toggleDetailsSection("timestamps")}
          >
            <div className="overflow-hidden rounded-xl bg-muted/95">
              <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Created</p>
                  <p className="mt-1 text-[13px] text-foreground">{createdTimestamp?.relative ?? "Unknown"}</p>
                </div>
                <p className="pt-0.5 text-right text-[11px] leading-5 text-muted-foreground">{createdTimestamp?.absolute ?? "No timestamp available"}</p>
              </div>
            </div>
          </DetailsSection>

          <section className="grid grid-cols-2 gap-3 pl-8 text-center animate-stagger">
            <div className="rounded-xl bg-muted/95 px-3 py-3 transition-smooth">
              <p className="text-base font-semibold text-foreground">{selectedBlocks.length}</p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Files className="h-3 w-3" />Blocks</p>
            </div>
            <div className="rounded-xl bg-muted/95 px-3 py-3 transition-smooth">
              {isLoadingAttachments ? (
                <div className="flex flex-col items-center gap-2">
                  <Bone className="h-5 w-8" />
                  <Bone className="h-3 w-14" />
                </div>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">{selectedPageAttachments.length}</p>
                  <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />Files</p>
                </>
              )}
            </div>
          </section>

          <DetailsSection
            title="Actions"
            icon={Settings2}
            accentClassName="bg-rose-500/12 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
            isOpen={detailsSectionOpen.actions}
            onToggle={() => toggleDetailsSection("actions")}
          >
            <div className="rounded-xl bg-muted/95 p-3 transition-smooth">
              <Button
                variant="ghost"
                onClick={() => {
                  void handleCopyDocument();
                }}
                className="h-10 w-full justify-start gap-2 rounded-lg px-3 text-[13px] text-foreground hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
                Copy document
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="mt-1 h-10 w-full justify-start gap-2 rounded-lg px-3 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete page
              </Button>
            </div>
          </DetailsSection>
      </div>

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
              {isDeletingPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete page"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
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

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:pb-4 md:py-8 md:pb-8">
        <div className="mx-auto max-w-[1600px] space-y-4">
          {isDisplayingOverview ? (
            <section className="grid gap-10 lg:grid-cols-2 animate-fade-slide-in">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-foreground">Favorites</p>
                  </div>
                </div>

                <div className="relative mt-4 min-h-24">
                  <div className={showOverviewOverlay ? "pointer-events-none opacity-0 transition-opacity duration-100" : "transition-opacity duration-150"}>
                    <div className={`space-y-1 ${shouldAnimateOverviewContent ? "animate-stagger" : ""}`}>
                      {overviewFavoritePagesToRender.length === 0 ? (
                        showOverviewLoading ? <NotesOverviewListSkeleton /> : <div className="py-6 text-sm text-muted-foreground">No favorites yet.</div>
                      ) : (
                        overviewFavoritePagesToRender.map((page) => (
                          <Link
                            key={page.id}
                            href={`/notes?page=${page.id}`}
                            onClick={() => transitionToEditor(page.id)}
                            className="block rounded-lg px-2.5 py-2 transition-smooth hover:bg-accent"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-2">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{page.title || "Untitled page"}</p>
                                  {page.summary ? (
                                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{page.summary}</p>
                                  ) : null}
                                </div>
                              </div>
                              <Star className="mt-0.5 h-4 w-4 shrink-0 fill-current text-amber-500" />
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                  {showOverviewOverlay ? (
                    <div className="pointer-events-none absolute inset-0 bg-background">
                      <NotesOverviewListSkeleton />
                    </div>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Files className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Recently accessed</p>
                </div>

                <div className="relative mt-4 min-h-24">
                  <div className={showOverviewOverlay ? "pointer-events-none opacity-0 transition-opacity duration-100" : "transition-opacity duration-150"}>
                    <div className={`space-y-1 ${shouldAnimateOverviewContent ? "animate-stagger" : ""}`}>
                      {overviewRecentPagesToRender.length === 0 ? (
                        showOverviewLoading ? <NotesOverviewListSkeleton /> : <div className="py-6 text-sm text-muted-foreground">No recent pages yet.</div>
                      ) : (
                        overviewRecentPagesToRender.map((page) => (
                          <Link
                            key={page.id}
                            href={`/notes?page=${page.id}`}
                            onClick={() => transitionToEditor(page.id)}
                            className="block rounded-lg px-2.5 py-2 transition-smooth hover:bg-accent"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-2">
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{page.title || "Untitled page"}</p>
                                  {page.summary ? (
                                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{page.summary}</p>
                                  ) : null}
                                </div>
                              </div>
                              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                            {page.tags.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {page.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                  {showOverviewOverlay ? (
                    <div className="pointer-events-none absolute inset-0 bg-background">
                      <NotesOverviewListSkeleton />
                    </div>
                  ) : null}
                </div>
              </section>
            </section>
          ) : (
            <>
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 lg:hidden">
                <MobileRailDrawer
                  direction="left"
                  triggerIcon={NotebookTabs}
                  triggerLabel="Pages"
                  title="Pages"
                  description="Browse and create notes pages."
                >
                  {navigationRail}
                </MobileRailDrawer>

                <div className="min-w-0 flex-1 px-2 text-center">
                  {showMobileUpdatedTimestamp ? (
                    <button
                      type="button"
                      onClick={revealAbsoluteUpdatedTime}
                      key={editorUpdatedTimestamp?.absolute}
                      className="inline-flex max-w-full items-center justify-center truncate text-[11px] text-muted-foreground/75 animate-fade-slide-in transition-colors hover:text-foreground"
                    >
                      {showAbsoluteUpdatedTime ? editorUpdatedTimestamp?.absolute : `Updated ${editorUpdatedTimestamp?.relative}`}
                    </button>
                  ) : <span className="block h-4" aria-hidden="true" />}
                </div>

                {detailsRail || showSelectedPageLoading ? (
                  <MobileRailDrawer
                    direction="right"
                    triggerIcon={Files}
                    triggerLabel="Details"
                    title="Details"
                    description="Summary, tags, files, timestamps, and actions for the current page."
                  >
                    {detailsRail ?? <NotesDetailsRailSkeleton />}
                  </MobileRailDrawer>
                ) : <div />}
              </div>

              <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
                <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">{isLoading ? <NotesNavigationRailSkeleton /> : navigationRail}</aside>

                <section className="min-w-0">
                  {showSelectedPageLoading && !editorContentToRender ? (
                    <NotesPageSkeleton />
                  ) : !editorContentToRender ? (
                    <div className="mx-auto max-w-3xl py-12 text-sm text-muted-foreground">
                      This page is not available locally.
                    </div>
                  ) : (
                    <div className="relative mx-auto max-w-3xl">
                      <div className={showEditorOverlay ? "pointer-events-none opacity-0 transition-opacity duration-100" : "transition-opacity duration-150"}>
                        <div className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1 gap-y-4 md:gap-x-2 ${shouldAnimateEditorContent ? "animate-fade-slide-in" : ""}`}>
                          <div className="col-span-3 hidden lg:block">
                            {showDesktopUpdatedTimestamp ? (
                              <div className="pl-8 md:pl-9">
                                <button
                                  type="button"
                                  onClick={revealAbsoluteUpdatedTime}
                                  key={editorUpdatedTimestamp?.absolute}
                                  className="inline-flex items-center text-[11px] text-muted-foreground/75 animate-fade-slide-in transition-colors hover:text-foreground"
                                >
                                  {showAbsoluteUpdatedTime ? editorUpdatedTimestamp?.absolute : `Updated ${editorUpdatedTimestamp?.relative}`}
                                </button>
                              </div>
                            ) : null}
                          </div>

                          <div className="contents">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              transitionToOverview();
                              router.push("/notes");
                            }}
                            className="-ml-2 -mr-1 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground md:size-9"
                            aria-label="Back to notes list"
                          >
                            <ArrowLeft className="h-6 w-6 md:h-7 md:w-7" />
                          </Button>
                          <Input
                            value={showEditorOverlay ? editorContentToRender.title : pageTitleDraft}
                            onChange={(event) => {
                              setPageTitleDraft(event.target.value);
                              if (selectedPageId) {
                                markPageEdited();
                                updateNotePageTitle(selectedPageId, event.target.value || "Untitled page");
                              }
                            }}
                            readOnly={showEditorOverlay}
                            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-4xl font-semibold tracking-tight text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent md:text-5xl"
                            placeholder="Untitled"
                          />
                          <Button
                            variant="ghost"
                            className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full md:size-9 ${editorContentToRender.favorite ? "text-amber-500" : "text-muted-foreground"}`}
                            onClick={handleToggleFavorite}
                            aria-label="Toggle favorite"
                          >
                            <Star className={`h-5 w-5 ${editorContentToRender.favorite ? "fill-current" : ""}`} />
                          </Button>
                          </div>

                          <div className={`col-start-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${shouldAnimateEditorContent ? "animate-stagger" : ""}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Files className="h-3 w-3" />{editorContentToRender.blockCount} blocks</span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Link2 className="h-3 w-3" />{editorContentToRender.backlinkCount} backlinks</span>
                            </div>
                          </div>

                          <div className={`col-start-2 col-span-2 ${shouldAnimateEditorContent ? "animate-fade-slide-in" : ""}`}>
                            <NotesBlockTree
                              blocks={editorContentToRender.blocks}
                              onCreateFirstBlock={handleCreateRootBlock}
                              focusedBlockId={focusTarget?.blockId ?? null}
                              focusPlacement={focusTarget?.placement ?? "end"}
                              onFocusApplied={() => setFocusTarget(null)}
                              onFocusBlock={(blockId, placement) => setFocusTarget({ blockId, placement })}
                              onCreateSibling={handleCreateSiblingBlock}
                              onCommitContent={handleCommitBlockContent}
                              onIndent={handleIndentBlock}
                              onOutdent={handleOutdentBlock}
                              onDelete={handleDeleteBlock}
                              onUpdateContent={handleUpdateBlockContent}
                            />
                          </div>
                        </div>
                      </div>
                      {showEditorOverlay ? (
                        <div className="pointer-events-none absolute inset-0 bg-background">
                          <NotesEditorMainSkeleton />
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">{detailsRail ?? (showSelectedPageLoading ? <NotesDetailsRailSkeleton /> : null)}</aside>
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
    </div>
  );
}