import { getBlockContextMenuActionIds, getBlockContextMenuOptions } from "@/components/notes/block-context-menu-options";

it("returns the default action set for text blocks", () => {
  expect(getBlockContextMenuActionIds("text")).toEqual(["move-up", "move-down", "delete"]);
  expect(getBlockContextMenuOptions({ blockType: "text" })).toEqual([
    { id: "move-up", label: "Move block up", disabled: false },
    { id: "move-down", label: "Move block down", disabled: false },
    { id: "delete", label: "Delete block", tone: "destructive" },
  ]);
});

it("falls back to the default action set for unknown block types", () => {
  expect(getBlockContextMenuActionIds("image")).toEqual(["move-up", "move-down", "delete"]);
});