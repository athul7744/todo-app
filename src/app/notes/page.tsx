"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Files, Hash, Link2, NotebookTabs, PanelLeftOpen, PanelRightOpen, Paperclip, Plus, Star, Tags } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { MobileBottomFabs } from "@/components/MobileBottomFabs";
import { NotesBlockTree } from "@/components/notes/NotesBlockTree";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLinkedNoteReferences, useNoteCounts, useNotePageWithBlocks, usePageAttachments, usePageTagMentions, useRecentNotePages } from "@/hooks/use-notes";
import { getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";
import { createNoteBlock, createStarterPage, deleteNoteBlock, moveNoteBlock, updateNoteBlock, updateNotePageProperties, updateNotePageTitle, type JsonValue } from "@/lib/notes/notes";
import { getApp } from "@/lib/shared/apps";
import { flushUpdate } from "@/lib/shared/debounced-update";
import { getRankAfterItem, getRankAtParentEnd } from "@/lib/shared/ranked-order";

const notesApp = getApp("notes");

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
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [pageTitleDraft, setPageTitleDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [blockContentDrafts, setBlockContentDrafts] = useState<Record<string, string>>({});
  const [focusTarget, setFocusTarget] = useState<{ blockId: string; placement: "start" | "end" } | null>(null);
  const { isLoading: isLoadingCounts } = useNoteCounts();
  const { pages: recentPages = [], isLoading: isLoadingRecentPages } = useRecentNotePages(8);
  const { page: selectedPage, blocks: selectedBlocks, isLoading: isLoadingSelectedPage } = useNotePageWithBlocks(selectedPageId);
  const { attachments: selectedPageAttachments, isLoading: isLoadingAttachments } = usePageAttachments(selectedPageId);
  const { references: linkedReferences, isLoading: isLoadingLinkedReferences } = useLinkedNoteReferences(selectedPageId);
  const { tags: pageTagMentions, isLoading: isLoadingTagMentions } = usePageTagMentions(selectedPageId);

  const getSiblingBlocks = (parentBlockId: string | null | undefined, excludeBlockId?: string) => {
    const normalizedParentBlockId = parentBlockId ?? null;

    return selectedBlocks.filter((block) => {
      if ((block.parent_block_id ?? null) !== normalizedParentBlockId) {
        return false;
      }

      return excludeBlockId ? block.id !== excludeBlockId : true;
    });
  };

  const getSortRankAtParentEnd = (parentBlockId: string | null | undefined, excludeBlockId?: string) => {
    return getRankAtParentEnd(selectedBlocks, parentBlockId, (block) => block.parent_block_id, excludeBlockId);
  };

  const getSortRankAfterBlock = (
    siblingBlockId: string,
    parentBlockId: string | null | undefined,
    excludeBlockId?: string
  ) => {
    return getRankAfterItem(selectedBlocks, siblingBlockId, parentBlockId, (block) => block.parent_block_id, excludeBlockId);
  };

  const handleCreateStarterPage = async () => {
    if (isCreatingPage) return;

    setIsCreatingPage(true);

    try {
      const pageId = await createStarterPage();
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

  const handleCreateSiblingBlock = async (blockId: string, parentBlockId: string | null | undefined, nextContent: JsonValue) => {
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
        content: nextContent,
      });

      await flushUpdate(blockId, "blocks");

      const nextBlockId = await createNoteBlock({
        pageId: selectedPageId,
        parentBlockId: parentBlockId ?? null,
        sortRank: getSortRankAfterBlock(blockId, parentBlockId),
        type: "text",
        content: createBlockDocument(),
      });
      setFocusTarget({ blockId: nextBlockId, placement: "end" });
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleIndentBlock = (blockId: string, nextParentBlockId: string) => {
    void moveNoteBlock({
      blockId,
      parentBlockId: nextParentBlockId,
      sortRank: getSortRankAtParentEnd(nextParentBlockId, blockId),
    });
  };

  const handleOutdentBlock = (blockId: string, nextParentBlockId?: string | null) => {
    const currentBlock = selectedBlocks.find((block) => block.id === blockId) ?? null;
    const currentParentBlock = currentBlock?.parent_block_id
      ? selectedBlocks.find((block) => block.id === currentBlock.parent_block_id) ?? null
      : null;

    void moveNoteBlock({
      blockId,
      parentBlockId: nextParentBlockId ?? null,
      sortRank: currentParentBlock
        ? getSortRankAfterBlock(currentParentBlock.id, nextParentBlockId, blockId)
        : getSortRankAtParentEnd(nextParentBlockId, blockId),
    });
  };

  const handleDeleteBlock = async (blockId: string) => {
    const blockIndex = orderedVisibleBlockIds.findIndex((visibleBlockId) => visibleBlockId === blockId);
    const previousBlockId = blockIndex > 0
      ? orderedVisibleBlockIds[blockIndex - 1] ?? null
      : orderedVisibleBlockIds[blockIndex + 1] ?? null;

    await deleteNoteBlock(blockId);
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

    updateNoteBlock({
      blockId,
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

    updateNoteBlock({
      blockId,
      content: nextContent,
    });

    void flushUpdate(blockId, "blocks");
  };

  const normalizedPages = useMemo(
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
    () => new Map(selectedBlocks.map((block) => [block.id, block])),
    [selectedBlocks]
  );
  const orderedVisibleBlockIds = useMemo(
    () => getVisibleNoteBlockIds(selectedBlocks),
    [selectedBlocks]
  );

  const selectedPageTags = Array.isArray(selectedPageProperties.tags)
    ? selectedPageProperties.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const favoritePages = useMemo(
    () => normalizedPages.filter((page) => {
      const properties = parseProperties(page.properties);
      return properties.favorite === true;
    }),
    [normalizedPages]
  );
  const recentAccessPages = useMemo(
    () => normalizedPages.filter((page) => {
      const properties = parseProperties(page.properties);
      return properties.favorite !== true;
    }),
    [normalizedPages]
  );

  const selectedPageSummary = typeof selectedPageProperties.summary === "string"
    ? selectedPageProperties.summary
    : null;

  useEffect(() => {
    if (!selectedPage) {
      setPageTitleDraft("");
      setSummaryDraft("");
      setTagsDraft("");
      setBlockContentDrafts({});
      setFocusTarget(null);
      return;
    }

    setPageTitleDraft(selectedPage?.title ?? "");
    setSummaryDraft(selectedPageSummary ?? "");
    setTagsDraft(selectedPageTags.join(", "));
    setBlockContentDrafts({});
    setFocusTarget(null);
  }, [selectedPage?.id]);

  const isLoading = isLoadingCounts || isLoadingRecentPages;

  const handleToggleFavorite = () => {
    if (!selectedPageId) return;

    updateNotePageProperties(selectedPageId, {
      ...(selectedPageProperties as Record<string, null | boolean | number | string | unknown[] | Record<string, unknown>>),
      favorite: selectedPageProperties.favorite !== true,
    });
  };

  const persistSelectedPageProperties = (nextSummary: string, nextTagsRaw: string) => {
    if (!selectedPageId) return;

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

  const displayBlocks = useMemo(
    () => selectedBlocks.map((block) => ({
      ...block,
      content: blockContentDrafts[block.id] ?? block.content,
    })),
    [blockContentDrafts, selectedBlocks]
  );

  const navigationRail = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookTabs className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Pages</p>
          <p className="text-xs text-muted-foreground">Local notebook index</p>
        </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
          <div className="px-1 py-4 text-sm text-muted-foreground">Loading pages…</div>
        ) : normalizedPages.length === 0 ? (
          <div className="px-1 py-4 text-sm text-muted-foreground">No pages yet. Create one to start writing.</div>
        ) : (
          normalizedPages.map((page) => (
            <Link
              key={page.id}
              href={`/notes?page=${page.id}`}
              className={`block rounded-xl px-3 py-2.5 transition-colors ${
                page.id === selectedPageId
                  ? "bg-amber-500/10 text-foreground"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{page.title || "Untitled page"}</p>
                  <div className="min-w-0">
                    {page.summary ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{page.summary}</p>
                    ) : null}
                  </div>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              {page.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {page.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
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
  );

  const contextRail = selectedPage ? (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Files className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Page details</p>
        <p className="mt-1 text-xs text-muted-foreground">Metadata and incoming references</p>
      </div>

      <div className="space-y-5 border-l border-border/60 pl-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><FileText className="h-3 w-3" />Summary</p>
            <Textarea
              value={summaryDraft}
              onChange={(event) => {
                setSummaryDraft(event.target.value);
                persistSelectedPageProperties(event.target.value, tagsDraft);
              }}
              rows={4}
              placeholder="Add page context"
              className="rounded-xl border-0 bg-muted/50 px-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Tags className="h-3 w-3" />Tags</p>
            <Input
              value={tagsDraft}
              onChange={(event) => {
                setTagsDraft(event.target.value);
                persistSelectedPageProperties(summaryDraft, event.target.value);
              }}
              placeholder="comma, separated, tags"
              className="rounded-xl border-0 bg-muted/50 shadow-none focus-visible:ring-0"
            />
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Link2 className="h-3 w-3" />Linked references</p>
            {isLoadingLinkedReferences ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : linkedReferences.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No incoming references yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {linkedReferences.slice(0, 8).map((reference) => (
                  <div key={`${reference.source_block_id}-${reference.source_page_id}`} className="py-1.5">
                    <p className="text-xs font-medium text-foreground">{reference.source_page_title || "Untitled page"}</p>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{reference.source_block_content ? JSON.parse(reference.source_block_content).content?.[0]?.content?.[0]?.text ?? "Referenced block" : "Referenced block"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Hash className="h-3 w-3" />Tag mentions</p>
            {isLoadingTagMentions ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : pageTagMentions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No inline tags on this page.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {pageTagMentions.map((tag) => (
                  <span
                    key={tag.tag_name}
                    className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  >
                    #{tag.tag_name} · {tag.mention_count}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-base font-semibold text-foreground">{selectedBlocks.length}</p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Files className="h-3 w-3" />Blocks</p>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{isLoadingAttachments ? "…" : selectedPageAttachments.length}</p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />Files</p>
            </div>
          </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <AppHeader
        app={notesApp}
        actions={!selectedPageId ? (
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
          {!selectedPageId ? (
            <section className="grid gap-10 lg:grid-cols-2">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-foreground">Favorites</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  {isLoading ? (
                    <div className="py-6 text-sm text-muted-foreground">Loading pages…</div>
                  ) : favoritePages.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">No favorites yet.</div>
                  ) : (
                    favoritePages.map((page) => (
                      <Link
                        key={page.id}
                        href={`/notes?page=${page.id}`}
                        className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-accent"
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
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Files className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Recently accessed</p>
                </div>

                <div className="mt-4 space-y-1">
                  {isLoading ? (
                    <div className="py-6 text-sm text-muted-foreground">Loading pages…</div>
                  ) : recentAccessPages.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">No recent pages yet.</div>
                  ) : (
                    recentAccessPages.map((page) => (
                      <Link
                        key={page.id}
                        href={`/notes?page=${page.id}`}
                        className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-accent"
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
              </section>
            </section>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <Drawer direction="left">
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 rounded-full">
                      <PanelLeftOpen className="h-4 w-4" />
                      Pages
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="p-0">
                    <DrawerHeader>
                      <DrawerTitle className="flex items-center justify-center gap-2"><NotebookTabs className="h-4 w-4" />Pages</DrawerTitle>
                      <DrawerDescription>Browse and create notes pages.</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-4">{navigationRail}</div>
                  </DrawerContent>
                </Drawer>

                {contextRail ? (
                  <Drawer direction="right">
                    <DrawerTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 rounded-full">
                        <PanelRightOpen className="h-4 w-4" />
                        Context
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="p-0">
                      <DrawerHeader>
                        <DrawerTitle className="flex items-center justify-center gap-2"><Files className="h-4 w-4" />Context</DrawerTitle>
                        <DrawerDescription>Metadata, links, and references for the current page.</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-4">{contextRail}</div>
                    </DrawerContent>
                  </Drawer>
                ) : <div />}
              </div>

              <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
                <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">{navigationRail}</aside>

                <section className="min-w-0 px-2 md:px-4">
                  {isLoadingSelectedPage ? (
                    <div className="px-2 py-12 text-sm text-muted-foreground">
                      Loading page…
                    </div>
                  ) : !selectedPage ? (
                    <div className="px-2 py-12 text-sm text-muted-foreground">
                      This page is not available locally.
                    </div>
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-6">
                      <header className="space-y-4 px-2">
                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/notes")}
                            className="-ml-2 rounded-full px-2 text-muted-foreground"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back to list
                          </Button>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <Input
                            value={pageTitleDraft}
                            onChange={(event) => {
                              setPageTitleDraft(event.target.value);
                              if (selectedPageId) {
                                updateNotePageTitle(selectedPageId, event.target.value || "Untitled page");
                              }
                            }}
                            className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-4xl font-semibold tracking-tight text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent md:text-5xl"
                            placeholder="Untitled"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={`rounded-full ${selectedPageProperties.favorite === true ? "text-amber-500" : "text-muted-foreground"}`}
                            onClick={handleToggleFavorite}
                            aria-label="Toggle favorite"
                          >
                            <Star className={selectedPageProperties.favorite === true ? "fill-current" : ""} />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Files className="h-3 w-3" />{selectedBlocks.length} blocks</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Link2 className="h-3 w-3" />{linkedReferences.length} backlinks</span>
                        </div>
                      </header>

                      <div className="px-2 md:px-0">
                        <NotesBlockTree
                          blocks={displayBlocks}
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
                  )}
                </section>

                <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">{contextRail}</aside>
              </section>
            </>
          )}
        </div>
      </main>

      <MobileBottomFabs
        app={notesApp}
        centerUseShell={false}
        centerContent={!selectedPageId ? (
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