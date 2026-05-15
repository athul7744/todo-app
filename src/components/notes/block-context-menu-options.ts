export type BlockContextMenuActionId = "move-up" | "move-down" | "delete";

export type BlockContextMenuOption = {
  id: BlockContextMenuActionId;
  label: string;
  disabled?: boolean;
  tone?: "default" | "destructive";
};

type BlockContextMenuOptionsInput = {
  blockType: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

const BLOCK_CONTEXT_ACTION_IDS_BY_TYPE: Record<string, BlockContextMenuActionId[]> = {
  default: ["move-up", "move-down", "delete"],
  text: ["move-up", "move-down", "delete"],
};

export function getBlockContextMenuActionIds(blockType: string): BlockContextMenuActionId[] {
  return BLOCK_CONTEXT_ACTION_IDS_BY_TYPE[blockType] ?? BLOCK_CONTEXT_ACTION_IDS_BY_TYPE.default;
}

export function getBlockContextMenuOptions({
  blockType,
  canMoveUp = true,
  canMoveDown = true,
}: BlockContextMenuOptionsInput): BlockContextMenuOption[] {
  const options: BlockContextMenuOption[] = [];

  getBlockContextMenuActionIds(blockType).forEach((actionId) => {
    switch (actionId) {
      case "move-up":
        options.push({
          id: actionId,
          label: "Move block up",
          disabled: !canMoveUp,
        });
        return;
      case "move-down":
        options.push({
          id: actionId,
          label: "Move block down",
          disabled: !canMoveDown,
        });
        return;
      case "delete":
        options.push({
          id: actionId,
          label: "Delete block",
          tone: "destructive",
        });
        return;
      default:
        return;
    }
  });

  return options;
}