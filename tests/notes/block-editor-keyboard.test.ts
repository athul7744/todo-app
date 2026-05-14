/// <reference types="vitest/globals" />

import {
  getBlockBackspaceAction,
  getBlockEnterAction,
  getBlockTabAction,
  getSplitSiblingOptions,
  shouldNavigateBetweenBlocks,
} from "@/lib/notes/block-editor-keyboard";

describe("block-editor keyboard spec", () => {
  it("exits an empty task block on Enter", () => {
    expect(getBlockEnterAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: true,
      isCodeBlock: false,
      isTable: false,
      isHorizontalRuleOnly: false,
      isEmptyBlock: true,
      hasChildren: false,
    })).toBe("exit-empty-task");
  });

  it("creates another task block on Enter for non-empty tasks", () => {
    expect(getBlockEnterAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: true,
      isCodeBlock: false,
      isTable: false,
      isHorizontalRuleOnly: false,
      isEmptyBlock: false,
      hasChildren: false,
    })).toBe("create-task-sibling");
  });

  it("creates a sibling from Shift+Enter in code blocks and tables", () => {
    expect(getBlockEnterAction({
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: false,
      isCodeBlock: true,
      isTable: false,
      isHorizontalRuleOnly: false,
      isEmptyBlock: false,
      hasChildren: false,
    })).toBe("create-code-or-table-sibling");

    expect(getBlockEnterAction({
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: true,
      isHorizontalRuleOnly: false,
      isEmptyBlock: false,
      hasChildren: false,
    })).toBe("create-code-or-table-sibling");
  });

  it("splits before when a block has children and after otherwise", () => {
    expect(getBlockEnterAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isHorizontalRuleOnly: false,
      isEmptyBlock: false,
      hasChildren: true,
    })).toBe("split-before");

    expect(getBlockEnterAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isHorizontalRuleOnly: false,
      isEmptyBlock: false,
      hasChildren: false,
    })).toBe("split-after");
  });

  it("derives split focus rules from child state and caret position", () => {
    expect(getSplitSiblingOptions({ hasChildren: true, isAtBlockStart: true })).toEqual({
      insertionSide: "before",
      focusPlacement: "end",
      focusTarget: "created",
    });

    expect(getSplitSiblingOptions({ hasChildren: true, isAtBlockStart: false })).toEqual({
      insertionSide: "before",
      focusPlacement: "start",
      focusTarget: "current",
    });

    expect(getSplitSiblingOptions({ hasChildren: false, isAtBlockStart: false })).toEqual({
      insertionSide: "after",
      focusPlacement: "start",
      focusTarget: "created",
    });
  });

  it("uses Tab structurally at block start and inserts a literal tab inside text", () => {
    expect(getBlockTabAction({ shiftKey: false, isCodeBlock: false, isTable: false, isAtBlockStart: true })).toBe("indent");
    expect(getBlockTabAction({ shiftKey: true, isCodeBlock: false, isTable: false, isAtBlockStart: true })).toBe("outdent");
    expect(getBlockTabAction({ shiftKey: false, isCodeBlock: false, isTable: false, isAtBlockStart: false })).toBe("insert-tab");
    expect(getBlockTabAction({ shiftKey: false, isCodeBlock: true, isTable: false, isAtBlockStart: true })).toBe("none");
  });

  it("navigates between blocks only at text boundaries with an adjacent block", () => {
    expect(shouldNavigateBetweenBlocks({ selectionEmpty: true, atTextBoundary: true, hasAdjacentBlock: true })).toBe(true);
    expect(shouldNavigateBetweenBlocks({ selectionEmpty: false, atTextBoundary: true, hasAdjacentBlock: true })).toBe(false);
    expect(shouldNavigateBetweenBlocks({ selectionEmpty: true, atTextBoundary: false, hasAdjacentBlock: true })).toBe(false);
    expect(shouldNavigateBetweenBlocks({ selectionEmpty: true, atTextBoundary: true, hasAdjacentBlock: false })).toBe(false);
  });

  it("normalizes empty task/code blocks on Backspace and deletes other empty blocks", () => {
    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: true,
      isTaskItem: true,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: true,
    })).toBe("reset-empty-special-block");

    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: true,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: true,
    })).toBe("delete-empty-block");
  });

  it("merges with the previous block only from plain block starts without modifiers", () => {
    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: true,
    })).toBe("merge-with-previous");

    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: false,
      isTaskItem: true,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: true,
    })).toBe("none");

    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: false,
      canMergeWithPrevious: true,
    })).toBe("none");

    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: true,
      isEmptyBlock: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: false,
    })).toBe("none");

    expect(getBlockBackspaceAction({
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      selectionEmpty: false,
      isEmptyBlock: false,
      isTaskItem: false,
      isCodeBlock: false,
      isTable: false,
      isAtBlockStart: true,
      canMergeWithPrevious: true,
    })).toBe("none");
  });
});