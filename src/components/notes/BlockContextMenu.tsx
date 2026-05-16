import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Trash2 } from "lucide-react";

import type { BlockContextMenuActionId, BlockContextMenuOption } from "@/components/notes/block-context-menu-options";

const ACTION_ICON_BY_ID = {
  "move-up": ArrowUp,
  "move-down": ArrowDown,
  indent: IndentIncrease,
  outdent: IndentDecrease,
  delete: Trash2,
} satisfies Record<BlockContextMenuActionId, typeof ArrowUp>;

export function BlockContextMenu({
  options,
  onAction,
}: {
  options: BlockContextMenuOption[];
  onAction: (actionId: BlockContextMenuActionId) => void;
}) {
  return (
    <div
      role="menu"
      data-block-context-menu="true"
      className="absolute left-full top-1/2 z-20 ml-1.5 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      {options.map((option) => {
        const Icon = ACTION_ICON_BY_ID[option.id];

        return (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            disabled={option.disabled}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              if (option.disabled) {
                return;
              }

              onAction(option.id);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-md outline-none transition-colors ${option.tone === "destructive" ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10" : "text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground"}`}
            aria-label={option.label}
            title={option.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}