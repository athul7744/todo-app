export type BlockEnterAction =
  | "none"
  | "create-code-or-table-sibling"
  | "exit-empty-task"
  | "create-task-sibling"
  | "create-horizontal-rule-sibling"
  | "split-before"
  | "split-after";

export type BlockTabAction = "none" | "indent" | "outdent" | "insert-tab";

export type BlockBackspaceAction = "none" | "reset-empty-special-block" | "delete-empty-block" | "merge-with-previous";

type EnterActionInput = {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isTaskItem: boolean;
  isCodeBlock: boolean;
  isTable: boolean;
  isHorizontalRuleOnly: boolean;
  isEmptyBlock: boolean;
  hasChildren: boolean;
};

type TabActionInput = {
  shiftKey: boolean;
  isCodeBlock: boolean;
  isTable: boolean;
  isAtBlockStart: boolean;
};

type BackspaceActionInput = {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isEmptyBlock: boolean;
  isTaskItem: boolean;
  isCodeBlock: boolean;
  isTable: boolean;
  isAtBlockStart: boolean;
  canMergeWithPrevious: boolean;
};

type SplitSiblingOptionsInput = {
  hasChildren: boolean;
  isAtBlockStart: boolean;
};

type ArrowNavigationInput = {
  selectionEmpty: boolean;
  atTextBoundary: boolean;
  hasAdjacentBlock: boolean;
};

export function getBlockEnterAction(input: EnterActionInput): BlockEnterAction {
  if (input.altKey || input.ctrlKey || input.metaKey) {
    return "none";
  }

  if (input.shiftKey) {
    return input.isCodeBlock || input.isTable ? "create-code-or-table-sibling" : "none";
  }

  if (input.isTaskItem) {
    return input.isEmptyBlock ? "exit-empty-task" : "create-task-sibling";
  }

  if (input.isHorizontalRuleOnly) {
    return "create-horizontal-rule-sibling";
  }

  if (input.isCodeBlock || input.isTable) {
    return "none";
  }

  return input.hasChildren ? "split-before" : "split-after";
}

export function getSplitSiblingOptions(input: SplitSiblingOptionsInput) {
  if (input.hasChildren) {
    return {
      insertionSide: "before" as const,
      focusPlacement: input.isAtBlockStart ? "end" as const : "start" as const,
      focusTarget: input.isAtBlockStart ? "created" as const : "current" as const,
    };
  }

  return {
    insertionSide: "after" as const,
    focusPlacement: "start" as const,
    focusTarget: "created" as const,
  };
}

export function getBlockTabAction(input: TabActionInput): BlockTabAction {
  if (input.isCodeBlock || input.isTable) {
    return "none";
  }

  if (input.isAtBlockStart) {
    return input.shiftKey ? "outdent" : "indent";
  }

  return "insert-tab";
}

export function shouldNavigateBetweenBlocks(input: ArrowNavigationInput) {
  return input.selectionEmpty && input.atTextBoundary && input.hasAdjacentBlock;
}

export function getBlockBackspaceAction(input: BackspaceActionInput): BlockBackspaceAction {
  if (input.isEmptyBlock) {
    if (input.isTaskItem || input.isCodeBlock) {
      return "reset-empty-special-block";
    }

    return "delete-empty-block";
  }

  if (input.shiftKey || input.altKey || input.ctrlKey || input.metaKey) {
    return "none";
  }

  if (!input.isAtBlockStart || !input.canMergeWithPrevious) {
    return "none";
  }

  if (input.isTaskItem || input.isCodeBlock || input.isTable) {
    return "none";
  }

  return "merge-with-previous";
}