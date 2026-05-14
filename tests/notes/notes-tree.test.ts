/// <reference types="vitest/globals" />

import { buildNoteBlockTree, createVisibleNoteBlockNeighbors, getVisibleNoteBlockIds } from "@/lib/notes/notes-tree";
import { createNestedTreeBlocks } from "@/../tests/shared/tree.helpers";

const blocks = createNestedTreeBlocks();

describe("notes-tree", () => {
  it("builds a nested block tree from parent references", () => {
    const tree = buildNoteBlockTree(blocks);

    expect(tree.map((node) => node.block.id)).toEqual(["a", "d"]);
    expect(tree[0]?.children.map((node) => node.block.id)).toEqual(["b", "e"]);
    expect(tree[0]?.children[0]?.children.map((node) => node.block.id)).toEqual(["c"]);
  });

  it("returns visible ids in depth-first order", () => {
    expect(getVisibleNoteBlockIds(blocks)).toEqual(["a", "b", "c", "e", "d"]);
  });

  it("creates previous and next neighbor lookups from visible order", () => {
    const { previousBlockIdById, nextBlockIdById } = createVisibleNoteBlockNeighbors(blocks);

    expect(previousBlockIdById.get("a")).toBeNull();
    expect(nextBlockIdById.get("a")).toBe("b");
    expect(previousBlockIdById.get("e")).toBe("c");
    expect(nextBlockIdById.get("e")).toBe("d");
    expect(nextBlockIdById.get("d")).toBeNull();
  });

  it("uses the last visible descendant from another subtree as the previous visible block", () => {
    const crossSubtreeBlocks = [
      { id: "a", parent_block_id: null },
      { id: "b", parent_block_id: "a" },
      { id: "c", parent_block_id: "b" },
      { id: "d", parent_block_id: null },
    ];

    const { previousBlockIdById } = createVisibleNoteBlockNeighbors(crossSubtreeBlocks);

    expect(previousBlockIdById.get("d")).toBe("c");
  });

  it("can use the direct parent as the previous visible block", () => {
    const parentChildBlocks = [
      { id: "a", parent_block_id: null },
      { id: "b", parent_block_id: "a" },
    ];

    const { previousBlockIdById } = createVisibleNoteBlockNeighbors(parentChildBlocks);

    expect(previousBlockIdById.get("b")).toBe("a");
  });
});