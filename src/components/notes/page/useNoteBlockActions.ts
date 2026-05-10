"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import { v4 as uuidv4 } from "uuid";

import type { NoteBlockRow } from "@/hooks/use-notes";
import { getNoteDocumentEndSelection, mergeNoteDocuments, normalizeNoteDocument, serializeNoteDocument } from "@/lib/notes/notes-content";
import {
  createNoteBlock,
  deleteNoteBlock,
  moveNoteBlock,
  updateNoteBlock,
  type JsonValue,
} from "@/lib/notes/notes";
import { getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";
import { flushUpdate } from "@/lib/shared/debounced-update";
import { getRankAfterItem, getRankAtParentEnd, getRankBeforeItem } from "@/lib/shared/ranked-order";

import type { OptimisticBlockStructure } from "./types";
import { createBlockDocument } from "./utils";

type FocusTarget = { blockId: string; placement: number | "start" | "end" } | null;

type UseNoteBlockActionsParams = {
  selectedBlocks: NoteBlockRow[];
  selectedPageId: string | null;
  selectedPageIdForWrite: string | undefined;
  isCreatingBlock: boolean;
  blockContentDrafts: Record<string, string>;
  optimisticBlockStructure: Record<string, OptimisticBlockStructure>;
  setIsCreatingBlock: Dispatch<SetStateAction<boolean>>;
  setBlockContentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setOptimisticBlockStructure: Dispatch<SetStateAction<Record<string, OptimisticBlockStructure>>>;
  setFocusTarget: Dispatch<SetStateAction<FocusTarget>>;
};

export function useNoteBlockActions({
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
}: UseNoteBlockActionsParams) {
  const [optimisticCreatedBlocks, setOptimisticCreatedBlocks] = useState<Record<string, NoteBlockRow>>({});
  const [optimisticDeletedBlockIds, setOptimisticDeletedBlockIds] = useState<Record<string, true>>({});

  useEffect(() => {
    const selectedBlockIds = new Set(selectedBlocks.map((block) => block.id));

    setOptimisticCreatedBlocks((currentBlocks) => {
      let hasChanges = false;
      const nextBlocks = { ...currentBlocks };

      for (const blockId of Object.keys(currentBlocks)) {
        if (!selectedBlockIds.has(blockId)) {
          continue;
        }

        delete nextBlocks[blockId];
        hasChanges = true;
      }

      return hasChanges ? nextBlocks : currentBlocks;
    });

    setOptimisticDeletedBlockIds((currentIds) => {
      let hasChanges = false;
      const nextIds = { ...currentIds };

      for (const blockId of Object.keys(currentIds)) {
        if (selectedBlockIds.has(blockId)) {
          continue;
        }

        delete nextIds[blockId];
        hasChanges = true;
      }

      return hasChanges ? nextIds : currentIds;
    });
  }, [selectedBlocks]);

  const structuredBlocks = useMemo(
    () => {
      const mergedBlocks = new Map<string, NoteBlockRow>();

      selectedBlocks.forEach((block) => {
        if (optimisticDeletedBlockIds[block.id]) {
          return;
        }

        const optimisticStructure = optimisticBlockStructure[block.id];
        mergedBlocks.set(
          block.id,
          optimisticStructure
            ? {
                ...block,
                parent_block_id: optimisticStructure.parent_block_id,
                sort_rank: optimisticStructure.sort_rank,
              }
            : block
        );
      });

      Object.values(optimisticCreatedBlocks).forEach((block) => {
        if (optimisticDeletedBlockIds[block.id] || mergedBlocks.has(block.id)) {
          return;
        }

        const optimisticStructure = optimisticBlockStructure[block.id];
        mergedBlocks.set(
          block.id,
          optimisticStructure
            ? {
                ...block,
                parent_block_id: optimisticStructure.parent_block_id,
                sort_rank: optimisticStructure.sort_rank,
              }
            : block
        );
      });

      return [...mergedBlocks.values()].sort((left, right) => (left.sort_rank ?? "").localeCompare(right.sort_rank ?? ""));
    },
    [optimisticBlockStructure, optimisticCreatedBlocks, optimisticDeletedBlockIds, selectedBlocks]
  );

  const selectedBlockMap = useMemo(
    () => new Map(structuredBlocks.map((block) => [block.id, block])),
    [structuredBlocks]
  );

  const orderedVisibleBlockIds = useMemo(
    () => getVisibleNoteBlockIds(structuredBlocks),
    [structuredBlocks]
  );

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

  const createOptimisticBlock = (
    blockId: string,
    parentBlockId: string | null | undefined,
    sortRank: string,
    content: JsonValue,
    pageId: string
  ) => {
    const fallbackBlock = selectedBlockMap.get(parentBlockId ?? "")
      ?? structuredBlocks.find((block) => block.page_id === pageId)
      ?? selectedBlocks[0]
      ?? null;

    const optimisticBlock: NoteBlockRow = {
      id: blockId,
      user_id: fallbackBlock?.user_id ?? "",
      page_id: pageId,
      parent_block_id: parentBlockId ?? null,
      type: "text",
      content: serializeNoteDocument(content),
      sort_rank: sortRank,
      updated_at: new Date().toISOString(),
    };

    setOptimisticCreatedBlocks((currentBlocks) => ({
      ...currentBlocks,
      [blockId]: optimisticBlock,
    }));
  };

  const removeOptimisticCreatedBlock = (blockId: string) => {
    setOptimisticCreatedBlocks((currentBlocks) => {
      if (!(blockId in currentBlocks)) {
        return currentBlocks;
      }

      const nextBlocks = { ...currentBlocks };
      delete nextBlocks[blockId];
      return nextBlocks;
    });
  };

  const hideOptimisticBlock = (blockId: string) => {
    setOptimisticDeletedBlockIds((currentIds) => ({
      ...currentIds,
      [blockId]: true,
    }));
  };

  const restoreOptimisticBlock = (blockId: string) => {
    setOptimisticDeletedBlockIds((currentIds) => {
      if (!(blockId in currentIds)) {
        return currentIds;
      }

      const nextIds = { ...currentIds };
      delete nextIds[blockId];
      return nextIds;
    });
  };

  const handleCreateRootBlock = async () => {
    if (!selectedPageId || isCreatingBlock) return;

    const blockId = uuidv4();
    setIsCreatingBlock(true);

    try {
      const content = createBlockDocument();
      const sortRank = getSortRankAtParentEnd(null);

      flushSync(() => {
        createOptimisticBlock(blockId, null, sortRank, content, selectedPageId);
        setFocusTarget({ blockId, placement: "end" });
      });

      await createNoteBlock({
        id: blockId,
        pageId: selectedPageId,
        sortRank,
        type: "text",
        content,
      });
    } catch (error) {
      removeOptimisticCreatedBlock(blockId);
      throw error;
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleCreateSiblingBlock = async (
    blockId: string,
    parentBlockId: string | null | undefined,
    nextContent: JsonValue,
    nextSiblingContent?: JsonValue,
    options?: {
      focusPlacement?: "start" | "end";
      focusTarget?: "created" | "current";
      insertionSide?: "before" | "after";
    }
  ) => {
    if (!selectedPageId || isCreatingBlock) return;

    const focusPlacement = options?.focusPlacement ?? "end";
    const focusTarget = options?.focusTarget ?? "created";
    const insertionSide = options?.insertionSide ?? "after";
    let nextBlockId: string | null = null;

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

      await flushUpdate(blockId, "blocks");

      const nextParentBlockId = parentBlockId ?? null;
      const nextSortRank = insertionSide === "before"
        ? getRankBeforeItem(structuredBlocks, blockId, parentBlockId, (block) => block.parent_block_id)
        : getSortRankAfterBlock(blockId, parentBlockId);
      nextBlockId = uuidv4();
      const createdBlockId = nextBlockId;
      const createdContent = nextSiblingContent ?? createBlockDocument();

      flushSync(() => {
        createOptimisticBlock(createdBlockId, nextParentBlockId, nextSortRank, createdContent, selectedPageId);
        setFocusTarget({
          blockId: focusTarget === "current" ? blockId : createdBlockId,
          placement: focusPlacement,
        });
      });

      await createNoteBlock({
        id: createdBlockId,
        pageId: selectedPageId,
        parentBlockId: nextParentBlockId,
        sortRank: nextSortRank,
        type: "text",
        content: createdContent,
      });
    } catch (error) {
      if (nextBlockId) {
        removeOptimisticCreatedBlock(nextBlockId);
      }
      throw error;
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleCreateEmptySiblingBlock = async (blockId: string, parentBlockId: string | null | undefined) => {
    if (!selectedPageId || isCreatingBlock) return;

    const nextBlockId = uuidv4();
    setIsCreatingBlock(true);

    try {
      const nextParentBlockId = parentBlockId ?? null;
      const nextSortRank = getSortRankAfterBlock(blockId, parentBlockId);
      const content = createBlockDocument();

      flushSync(() => {
        createOptimisticBlock(nextBlockId, nextParentBlockId, nextSortRank, content, selectedPageId);
        setFocusTarget({ blockId: nextBlockId, placement: "end" });
      });

      await createNoteBlock({
        id: nextBlockId,
        pageId: selectedPageId,
        parentBlockId: nextParentBlockId,
        sortRank: nextSortRank,
        type: "text",
        content,
      });
    } catch (error) {
      removeOptimisticCreatedBlock(nextBlockId);
      throw error;
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleCreateSiblingBlocks = async (
    blockId: string,
    parentBlockId: string | null | undefined,
    nextContent: JsonValue,
    nextSiblingContents: JsonValue[]
  ) => {
    if (!selectedPageId || isCreatingBlock) return;
    if (nextSiblingContents.length === 0) return;

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

      await flushUpdate(blockId, "blocks");

      let previousBlockId = blockId;
      let lastCreatedBlockId: string | null = null;

      for (const siblingContent of nextSiblingContents) {
        const createdBlockId = uuidv4();
        const nextSortRank = getSortRankAfterBlock(previousBlockId, parentBlockId);

        flushSync(() => {
          createOptimisticBlock(createdBlockId, parentBlockId ?? null, nextSortRank, siblingContent, selectedPageId);
        });

        await createNoteBlock({
          id: createdBlockId,
          pageId: selectedPageId,
          parentBlockId: parentBlockId ?? null,
          sortRank: nextSortRank,
          type: "text",
          content: siblingContent,
        });

        previousBlockId = createdBlockId;
        lastCreatedBlockId = createdBlockId;
      }

      if (lastCreatedBlockId) {
        setFocusTarget({ blockId: lastCreatedBlockId, placement: "end" });
      }
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleIndentBlock = (blockId: string, nextParentBlockId: string) => {
    const nextSortRank = getSortRankAtParentEnd(nextParentBlockId, blockId);

    flushSync(() => {
      setFocusTarget({ blockId, placement: "start" });
      applyOptimisticBlockMove(blockId, nextParentBlockId, nextSortRank);
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

    flushSync(() => {
      hideOptimisticBlock(blockId);
      setFocusTarget(previousBlockId ? { blockId: previousBlockId, placement: "end" } : null);
    });

    try {
      await deleteNoteBlock(blockId, selectedPageId ?? undefined);
    } catch (error) {
      restoreOptimisticBlock(blockId);
      throw error;
    }
  };

  const handleMergeWithPreviousBlock = async (
    blockId: string,
    previousBlockId: string,
    nextContent: JsonValue,
    options?: { hasChildren?: boolean }
  ) => {
    const previousBlock = selectedBlockMap.get(previousBlockId);
    if (!selectedPageId || !previousBlock || isCreatingBlock) return;

    setIsCreatingBlock(true);

    try {
      const mergedContent = mergeNoteDocuments(previousBlock.content, nextContent) as JsonValue;
      const serializedMergedContent = JSON.stringify(mergedContent);

      if (options?.hasChildren) {
        const joinPlacement = getNoteDocumentEndSelection(previousBlock.content);

        flushSync(() => {
          hideOptimisticBlock(previousBlockId);
          setBlockContentDrafts((currentDrafts) => ({
            ...currentDrafts,
            [blockId]: serializedMergedContent,
            [previousBlockId]: JSON.stringify(normalizeNoteDocument(previousBlock.content)),
          }));
          setFocusTarget({ blockId, placement: joinPlacement });
        });

        updateNoteBlock({
          blockId,
          pageId: selectedPageId ?? undefined,
          content: mergedContent,
        });

        await flushUpdate(blockId, "blocks");
        try {
          await deleteNoteBlock(previousBlockId, selectedPageId ?? undefined);
        } catch (error) {
          restoreOptimisticBlock(previousBlockId);
          throw error;
        }
        return;
      }

      const joinPlacement = getNoteDocumentEndSelection(previousBlock.content);

      flushSync(() => {
        hideOptimisticBlock(blockId);
        setBlockContentDrafts((currentDrafts) => ({
          ...currentDrafts,
          [previousBlockId]: serializedMergedContent,
          [blockId]: JSON.stringify(normalizeNoteDocument(nextContent)),
        }));
        setFocusTarget({ blockId: previousBlockId, placement: joinPlacement });
      });

      updateNoteBlock({
        blockId: previousBlockId,
        pageId: selectedPageId ?? undefined,
        content: mergedContent,
      });

      await flushUpdate(previousBlockId, "blocks");
      try {
        await deleteNoteBlock(blockId, selectedPageId ?? undefined);
      } catch (error) {
        restoreOptimisticBlock(blockId);
        throw error;
      }
    } finally {
      setIsCreatingBlock(false);
    }
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

    updateNoteBlock({
      blockId,
      pageId: selectedPageIdForWrite,
      content: nextContent,
    });

    void flushUpdate(blockId, "blocks");
  };

  return {
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
  };
}