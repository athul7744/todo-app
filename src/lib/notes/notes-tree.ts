export interface NoteTreeBlockLike {
  id: string;
  parent_block_id: string | null;
}

export interface NoteTreeNode<TBlock extends NoteTreeBlockLike> {
  block: TBlock;
  children: NoteTreeNode<TBlock>[];
}

export function buildNoteBlockTree<TBlock extends NoteTreeBlockLike>(blocks: TBlock[]) {
  const nodeMap = new Map<string, NoteTreeNode<TBlock>>();
  const roots: NoteTreeNode<TBlock>[] = [];

  for (const block of blocks) {
    nodeMap.set(block.id, { block, children: [] });
  }

  for (const block of blocks) {
    const node = nodeMap.get(block.id);
    if (!node) continue;

    if (block.parent_block_id) {
      const parent = nodeMap.get(block.parent_block_id);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}

export function flattenNoteBlockTree<TBlock extends NoteTreeBlockLike>(nodes: NoteTreeNode<TBlock>[]) {
  const orderedIds: string[] = [];

  const visit = (node: NoteTreeNode<TBlock>) => {
    orderedIds.push(node.block.id);
    for (const child of node.children) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return orderedIds;
}

export function getVisibleNoteBlockIds<TBlock extends NoteTreeBlockLike>(blocks: TBlock[]) {
  return flattenNoteBlockTree(buildNoteBlockTree(blocks));
}

export function createVisibleNoteBlockNeighbors<TBlock extends NoteTreeBlockLike>(blocks: TBlock[]) {
  const orderedBlockIds = getVisibleNoteBlockIds(blocks);
  const previousBlockIdById = new Map<string, string | null>();
  const nextBlockIdById = new Map<string, string | null>();

  orderedBlockIds.forEach((blockId, index) => {
    previousBlockIdById.set(blockId, index > 0 ? orderedBlockIds[index - 1] : null);
    nextBlockIdById.set(blockId, index < orderedBlockIds.length - 1 ? orderedBlockIds[index + 1] : null);
  });

  return {
    orderedBlockIds,
    previousBlockIdById,
    nextBlockIdById,
  };
}