/// <reference types="vitest/globals" />

import {
  getDeleteChildMoves,
  getDeleteFocusTarget,
  getIndentPosition,
  getMergeChildMoves,
  getMergePlan,
  getOutdentPosition,
} from "@/lib/notes/block-editor-structure";

describe("block-editor structure", () => {
  it("focuses the previous visible block after delete when one exists", () => {
    expect(getDeleteFocusTarget(["a", "b", "c"], "b")).toEqual({
      blockId: "a",
      placement: "end",
    });
  });

  it("falls forward after delete when removing the first visible block", () => {
    expect(getDeleteFocusTarget(["a", "b", "c"], "a")).toEqual({
      blockId: "b",
      placement: "start",
    });
  });

  it("returns null delete focus when removing the last remaining block", () => {
    expect(getDeleteFocusTarget(["only"], "only")).toBeNull();
  });

  it("reparents direct children after a deleted block to preserve visible order", () => {
    const blocks = [
      { id: "root-a", parent_block_id: null, sort_rank: "0|hzzzzz:" },
      { id: "current", parent_block_id: null, sort_rank: "0|i00007:" },
      { id: "child-a", parent_block_id: "current", sort_rank: "0|i0000f:" },
      { id: "child-b", parent_block_id: "current", sort_rank: "0|i0000n:" },
      { id: "root-b", parent_block_id: null, sort_rank: "0|i0000v:" },
    ];

    expect(getDeleteChildMoves(blocks, "current")).toEqual([
      {
        blockId: "child-a",
        parentBlockId: null,
        sortRank: expect.any(String),
      },
      {
        blockId: "child-b",
        parentBlockId: null,
        sortRank: expect.any(String),
      },
    ]);
  });

  it("always updates the previous visible block and deletes the current block on merge", () => {
    expect(getMergePlan("current", "previous", 7)).toEqual({
      updatedBlockId: "previous",
      deletedBlockId: "current",
      focusTarget: {
        blockId: "previous",
        placement: 7,
      },
    });
  });

  it("reparents direct children of the deleted block to the surviving merged block", () => {
    const blocks = [
      { id: "previous", parent_block_id: null, sort_rank: "0|hzzzzz:" },
      { id: "current", parent_block_id: null, sort_rank: "0|i00007:" },
      { id: "prev-child", parent_block_id: "previous", sort_rank: "0|i0000f:" },
      { id: "child-a", parent_block_id: "current", sort_rank: "0|i0000n:" },
      { id: "child-b", parent_block_id: "current", sort_rank: "0|i0000v:" },
      { id: "grandchild", parent_block_id: "child-a", sort_rank: "0|i00013:" },
    ];

    expect(getMergeChildMoves(blocks, "current", "previous")).toEqual([
      {
        blockId: "child-a",
        parentBlockId: "previous",
        sortRank: expect.any(String),
      },
      {
        blockId: "child-b",
        parentBlockId: "previous",
        sortRank: expect.any(String),
      },
    ]);
  });

  it("places an indented block at the end of its new parent", () => {
    const blocks = [
      { id: "root-a", parent_block_id: null, sort_rank: "0|hzzzzz:" },
      { id: "root-b", parent_block_id: null, sort_rank: "0|i00007:" },
      { id: "child-a", parent_block_id: "root-a", sort_rank: "0|i0000f:" },
      { id: "child-b", parent_block_id: "root-a", sort_rank: "0|i0000n:" },
    ];

    const nextPosition = getIndentPosition(blocks, "root-b", "root-a");

    expect(nextPosition.parentBlockId).toBe("root-a");
    expect(nextPosition.sortRank).not.toBe("0|i0000f:");
    expect(nextPosition.sortRank).not.toBe("0|i0000n:");
  });

  it("places an outdented block immediately after its current parent", () => {
    const blocks = [
      { id: "root-a", parent_block_id: null, sort_rank: "0|hzzzzz:" },
      { id: "root-b", parent_block_id: null, sort_rank: "0|i00007:" },
      { id: "child-a", parent_block_id: "root-a", sort_rank: "0|i0000f:" },
      { id: "child-b", parent_block_id: "root-a", sort_rank: "0|i0000n:" },
    ];

    const nextPosition = getOutdentPosition(blocks, "child-b", null);

    expect(nextPosition.parentBlockId).toBeNull();
    expect(nextPosition.sortRank).not.toBe("0|hzzzzz:");
    expect(nextPosition.sortRank).not.toBe("0|i00007:");
  });

  it("outdents root blocks to the end of the requested parent scope", () => {
    const blocks = [
      { id: "root-a", parent_block_id: null, sort_rank: "0|hzzzzz:" },
      { id: "root-b", parent_block_id: null, sort_rank: "0|i00007:" },
    ];

    const nextPosition = getOutdentPosition(blocks, "root-a", null);

    expect(nextPosition.parentBlockId).toBeNull();
    expect(nextPosition.sortRank).not.toBe("0|hzzzzz:");
  });
});