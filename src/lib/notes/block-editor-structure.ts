import { getRankAfterItem, getRankAtParentEnd, getRankAtParentStart, getRankBeforeItem } from "@/lib/shared/ranked-order";
import { getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";

type BlockStructureItem = {
  id: string;
  parent_block_id: string | null;
  sort_rank: string | null;
};

type RankedBlockStructureItem = BlockStructureItem & {
  sort_rank: string;
};

type BlockMove = {
  blockId: string;
  parentBlockId: string | null;
  sortRank: string;
};

export type BlockRangeMoveDirection = "up" | "down";

function toRankedBlocks(blocks: BlockStructureItem[]) {
  return blocks.filter((block): block is RankedBlockStructureItem => typeof block.sort_rank === "string");
}

function getSelectedRootBlocks(blocks: RankedBlockStructureItem[], selectedBlockIds: string[]) {
  const selectedBlockIdSet = new Set(selectedBlockIds);

  return selectedBlockIds.flatMap((blockId) => {
    const block = blocks.find((candidate) => candidate.id === blockId);
    if (!block || selectedBlockIdSet.has(block.parent_block_id ?? "")) {
      return [];
    }

    return [block];
  });
}

function isDescendantBlock(blocksById: ReadonlyMap<string, RankedBlockStructureItem>, blockId: string, ancestorBlockId: string) {
  let currentBlock = blocksById.get(blockId) ?? null;

  while (currentBlock?.parent_block_id) {
    if (currentBlock.parent_block_id === ancestorBlockId) {
      return true;
    }

    currentBlock = blocksById.get(currentBlock.parent_block_id) ?? null;
  }

  return false;
}

function getSingleBlockMovePlan(
  blocks: RankedBlockStructureItem[],
  blockId: string,
  direction: BlockRangeMoveDirection,
) {
  const currentBlock = blocks.find((block) => block.id === blockId) ?? null;
  if (!currentBlock) {
    return [];
  }

  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const visibleBlockIds = getVisibleNoteBlockIds(blocks);
  const currentVisibleIndex = visibleBlockIds.indexOf(blockId);
  if (currentVisibleIndex === -1) {
    return [];
  }

  const workingBlocks = blocks.filter((block) => block.id !== blockId).map((block) => ({ ...block }));

  if (direction === "up") {
    const previousVisibleId = currentVisibleIndex > 0 ? visibleBlockIds[currentVisibleIndex - 1] ?? null : null;
    const previousVisibleBlock = previousVisibleId ? blocksById.get(previousVisibleId) ?? null : null;
    if (!previousVisibleBlock) {
      return [];
    }

    return [{
      blockId,
      parentBlockId: previousVisibleBlock.parent_block_id,
      sortRank: getRankBeforeItem(
        workingBlocks,
        previousVisibleBlock.id,
        previousVisibleBlock.parent_block_id,
        (item) => item.parent_block_id,
      ),
    }];
  }

  const nextVisibleBlock = visibleBlockIds
    .slice(currentVisibleIndex + 1)
    .map((visibleId) => blocksById.get(visibleId) ?? null)
    .find((block): block is RankedBlockStructureItem => {
      if (!block) {
        return false;
      }

      return !isDescendantBlock(blocksById, block.id, blockId);
    });

  if (!nextVisibleBlock) {
    return [];
  }

  const hasDirectChildren = blocks.some((block) => block.parent_block_id === nextVisibleBlock.id);
  if (hasDirectChildren) {
    return [{
      blockId,
      parentBlockId: nextVisibleBlock.id,
      sortRank: getRankAtParentStart(workingBlocks, nextVisibleBlock.id, (item) => item.parent_block_id),
    }];
  }

  return [{
    blockId,
    parentBlockId: nextVisibleBlock.parent_block_id,
    sortRank: getRankAfterItem(
      workingBlocks,
      nextVisibleBlock.id,
      nextVisibleBlock.parent_block_id,
      (item) => item.parent_block_id,
    ),
  }];
}

export function getBlockRangeMovePlan(
  blocks: BlockStructureItem[],
  selectedBlockIds: string[],
  direction: BlockRangeMoveDirection,
) {
  const rankedBlocks = toRankedBlocks(blocks);
  const selectedRootBlocks = getSelectedRootBlocks(rankedBlocks, selectedBlockIds);

  if (selectedRootBlocks.length === 0) {
    return [];
  }

  if (selectedRootBlocks.length === 1 && selectedBlockIds.length === 1) {
    return getSingleBlockMovePlan(rankedBlocks, selectedRootBlocks[0].id, direction);
  }

  const movesById = new Map<string, BlockMove>();

  const selectedRootBlocksByParentId = new Map<string | null, RankedBlockStructureItem[]>();
  selectedRootBlocks.forEach((block) => {
    const parentBlockId = block.parent_block_id ?? null;
    const currentBlocks = selectedRootBlocksByParentId.get(parentBlockId) ?? [];
    currentBlocks.push(block);
    selectedRootBlocksByParentId.set(parentBlockId, currentBlocks);
  });

  selectedRootBlocksByParentId.forEach((groupBlocks, parentBlockId) => {
    const siblingBlocks = rankedBlocks
      .filter((block) => block.parent_block_id === parentBlockId)
      .sort((left, right) => left.sort_rank.localeCompare(right.sort_rank));
    const selectedRootIdSet = new Set(groupBlocks.map((block) => block.id));
    const selectedIndices = siblingBlocks.reduce<number[]>((indices, block, index) => {
      if (selectedRootIdSet.has(block.id)) {
        indices.push(index);
      }
      return indices;
    }, []);

    if (
      selectedIndices.length !== groupBlocks.length
      || selectedIndices.some((index, offset) => offset > 0 && index !== selectedIndices[offset - 1] + 1)
    ) {
      return;
    }

    const workingBlocks = rankedBlocks
      .filter((block) => !selectedRootIdSet.has(block.id))
      .map((block) => ({ ...block }));

    if (direction === "up") {
      const firstSelectedIndex = selectedIndices[0] ?? -1;
      const previousSibling = firstSelectedIndex > 0 ? siblingBlocks[firstSelectedIndex - 1] : null;
      if (!previousSibling) {
        return;
      }

      let nextSiblingId = previousSibling.id;

      [...groupBlocks].reverse().forEach((block) => {
        const sortRank = getRankBeforeItem(workingBlocks, nextSiblingId, parentBlockId, (item) => item.parent_block_id);
        const movedBlock = {
          blockId: block.id,
          parentBlockId,
          sortRank,
        };

        movesById.set(block.id, movedBlock);
        workingBlocks.push({
          ...block,
          parent_block_id: parentBlockId,
          sort_rank: sortRank,
        });
        nextSiblingId = block.id;
      });

      return;
    }

    const lastSelectedIndex = selectedIndices[selectedIndices.length - 1] ?? -1;
    const nextSibling = lastSelectedIndex >= 0 ? siblingBlocks[lastSelectedIndex + 1] ?? null : null;
    if (!nextSibling) {
      return;
    }

    let previousSiblingId = nextSibling.id;

    groupBlocks.forEach((block) => {
      const sortRank = getRankAfterItem(workingBlocks, previousSiblingId, parentBlockId, (item) => item.parent_block_id);
      const movedBlock = {
        blockId: block.id,
        parentBlockId,
        sortRank,
      };

      movesById.set(block.id, movedBlock);
      workingBlocks.push({
        ...block,
        parent_block_id: parentBlockId,
        sort_rank: sortRank,
      });
      previousSiblingId = block.id;
    });
  });

  return selectedRootBlocks
    .map((block) => movesById.get(block.id) ?? null)
    .filter((move): move is BlockMove => move !== null);
}

export function getDeleteFocusTarget(orderedVisibleBlockIds: string[], blockId: string) {
  const blockIndex = orderedVisibleBlockIds.findIndex((visibleBlockId) => visibleBlockId === blockId);
  if (blockIndex > 0) {
    const previousBlockId = orderedVisibleBlockIds[blockIndex - 1] ?? null;
    return previousBlockId ? { blockId: previousBlockId, placement: "end" as const } : null;
  }

  const nextBlockId = orderedVisibleBlockIds[blockIndex + 1] ?? null;
  return nextBlockId ? { blockId: nextBlockId, placement: "start" as const } : null;
}

export function getDeleteChildMoves(blocks: BlockStructureItem[], deletedBlockId: string): BlockMove[] {
  const rankedBlocks = toRankedBlocks(blocks);
  const deletedBlock = rankedBlocks.find((block) => block.id === deletedBlockId);
  if (!deletedBlock) {
    return [];
  }

  const directChildren = rankedBlocks
    .filter((block) => block.parent_block_id === deletedBlockId)
    .sort((left, right) => left.sort_rank.localeCompare(right.sort_rank));

  if (directChildren.length === 0) {
    return [];
  }

  const workingBlocks = rankedBlocks.map((block) => ({ ...block }));
  const moves: BlockMove[] = [];
  let previousSiblingId = deletedBlockId;

  for (const child of directChildren) {
    const sortRank = getRankAfterItem(
      workingBlocks,
      previousSiblingId,
      deletedBlock.parent_block_id,
      (block) => block.parent_block_id,
      child.id
    );

    moves.push({
      blockId: child.id,
      parentBlockId: deletedBlock.parent_block_id,
      sortRank,
    });

    const workingChild = workingBlocks.find((block) => block.id === child.id);
    if (workingChild) {
      workingChild.parent_block_id = deletedBlock.parent_block_id;
      workingChild.sort_rank = sortRank;
    }

    previousSiblingId = child.id;
  }

  return moves;
}

export function getMergePlan(blockId: string, previousBlockId: string, joinPlacement: number) {
  return {
    updatedBlockId: previousBlockId,
    deletedBlockId: blockId,
    focusTarget: {
      blockId: previousBlockId,
      placement: joinPlacement,
    },
  };
}

export function getMergeChildMoves(blocks: BlockStructureItem[], deletedBlockId: string, survivorBlockId: string): BlockMove[] {
  const rankedBlocks = toRankedBlocks(blocks);
  const directChildren = rankedBlocks
    .filter((block) => block.parent_block_id === deletedBlockId)
    .sort((left, right) => left.sort_rank.localeCompare(right.sort_rank));

  if (directChildren.length === 0) {
    return [];
  }

  const workingBlocks = rankedBlocks.map((block) => ({ ...block }));
  const moves: BlockMove[] = [];

  for (const child of directChildren) {
    const sortRank = getRankAtParentEnd(workingBlocks, survivorBlockId, (block) => block.parent_block_id, child.id);
    moves.push({
      blockId: child.id,
      parentBlockId: survivorBlockId,
      sortRank,
    });

    const workingChild = workingBlocks.find((block) => block.id === child.id);
    if (workingChild) {
      workingChild.parent_block_id = survivorBlockId;
      workingChild.sort_rank = sortRank;
    }
  }

  return moves;
}

export function getIndentPosition(blocks: BlockStructureItem[], blockId: string, nextParentBlockId: string) {
  const rankedBlocks = toRankedBlocks(blocks);

  return {
    parentBlockId: nextParentBlockId,
    sortRank: getRankAtParentEnd(rankedBlocks, nextParentBlockId, (block) => block.parent_block_id, blockId),
  };
}

export function getOutdentPosition(blocks: BlockStructureItem[], blockId: string, nextParentBlockId?: string | null) {
  const rankedBlocks = toRankedBlocks(blocks);
  const currentBlock = blocks.find((block) => block.id === blockId) ?? null;
  const currentParentBlock = currentBlock?.parent_block_id
    ? blocks.find((block) => block.id === currentBlock.parent_block_id) ?? null
    : null;

  const sortRank = currentParentBlock
    ? getRankAfterItem(rankedBlocks, currentParentBlock.id, nextParentBlockId, (block) => block.parent_block_id, blockId)
    : getRankAtParentEnd(rankedBlocks, nextParentBlockId, (block) => block.parent_block_id, blockId);

  return {
    parentBlockId: nextParentBlockId ?? null,
    sortRank,
  };
}