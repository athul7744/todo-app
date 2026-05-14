import { getRankAfterItem, getRankAtParentEnd } from "@/lib/shared/ranked-order";

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

function toRankedBlocks(blocks: BlockStructureItem[]) {
  return blocks.filter((block): block is RankedBlockStructureItem => typeof block.sort_rank === "string");
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