"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { flushSync } from "react-dom";

import type { NoteBlockRow } from "@/hooks/use-notes";
import {
  createNoteBlock,
  deleteNoteBlock,
  moveNoteBlock,
  updateNoteBlock,
  type JsonValue,
} from "@/lib/notes/notes";
import { getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";
import { flushUpdate } from "@/lib/shared/debounced-update";
import { getRankAfterItem, getRankAtParentEnd } from "@/lib/shared/ranked-order";

import type { OptimisticBlockStructure } from "./types";
import { createBlockDocument } from "./utils";

type FocusTarget = { blockId: string; placement: "start" | "end" } | null;

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

      await flushUpdate(blockId, "blocks");

      const nextBlockId = await createNoteBlock({
        pageId: selectedPageId,
        parentBlockId: parentBlockId ?? null,
        sortRank: getSortRankAfterBlock(blockId, parentBlockId),
        type: "text",
        content: nextSiblingContent ?? createBlockDocument(),
      });
      setFocusTarget({ blockId: nextBlockId, placement: "end" });
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleCreateEmptySiblingBlock = async (blockId: string, parentBlockId: string | null | undefined) => {
    if (!selectedPageId || isCreatingBlock) return;

    setIsCreatingBlock(true);

    try {
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
        const createdBlockId = await createNoteBlock({
          pageId: selectedPageId,
          parentBlockId: parentBlockId ?? null,
          sortRank: getSortRankAfterBlock(previousBlockId, parentBlockId),
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

    await deleteNoteBlock(blockId, selectedPageId ?? undefined);
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
    handleOutdentBlock,
    handleUpdateBlockContent,
    orderedVisibleBlockIds,
    selectedBlockMap,
    structuredBlocks,
  };
}