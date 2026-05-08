import { describe, expect, it } from "vitest";

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
});