/// <reference types="vitest/globals" />

import React, { act, forwardRef, useImperativeHandle, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { NotesBlockTree } from "@/components/notes/NotesBlockTree";
import { useNoteBlockActions } from "@/components/notes/page/useNoteBlockActions";
import type { NoteBlockRow } from "@/hooks/use-notes";
import { createNoteDocumentFromText, serializeNoteDocument } from "@/lib/notes/notes-content";
import {
  createNoteBlock,
  deleteNoteBlock,
  moveNoteBlock,
  queueNoteBlockCreate,
  queueNoteBlockCreates,
  updateNoteBlock,
} from "@/lib/notes/notes";
import { flushUpdate } from "@/lib/shared/debounced-update";

vi.mock("@/lib/notes/notes", () => ({
  createNoteBlock: vi.fn(),
  deleteNoteBlock: vi.fn(async () => undefined),
  moveNoteBlock: vi.fn(),
  queueNoteBlockCreate: vi.fn(),
  queueNoteBlockCreates: vi.fn(),
  updateNoteBlock: vi.fn(),
}));

vi.mock("@/lib/shared/debounced-update", () => ({
  flushUpdate: vi.fn(async () => undefined),
}));

const createNoteBlockMock = vi.mocked(createNoteBlock);
const deleteNoteBlockMock = vi.mocked(deleteNoteBlock);
const moveNoteBlockMock = vi.mocked(moveNoteBlock);
const queueNoteBlockCreateMock = vi.mocked(queueNoteBlockCreate);
const queueNoteBlockCreatesMock = vi.mocked(queueNoteBlockCreates);
const updateNoteBlockMock = vi.mocked(updateNoteBlock);
const flushUpdateMock = vi.mocked(flushUpdate);

type FocusTarget = { blockId: string; placement: number | "start" | "end" } | null;

type TreeHarnessHandle = {
  snapshot: () => {
    structuredBlocks: NoteBlockRow[];
    focusTarget: FocusTarget;
  };
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyDomRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

if (!HTMLElement.prototype.getBoundingClientRect) {
  HTMLElement.prototype.getBoundingClientRect = () => emptyDomRect as DOMRect;
}

if (!HTMLElement.prototype.getClientRects) {
  HTMLElement.prototype.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {
      yield emptyDomRect as DOMRect;
    },
  }) as DOMRectList;
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => emptyDomRect as DOMRect;
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {
      yield emptyDomRect as DOMRect;
    },
  }) as DOMRectList;
}

function createBlock(id: string, parentBlockId: string | null, sortRank: string, text: string): NoteBlockRow {
  return {
    id,
    user_id: "user-1",
    page_id: "page-1",
    parent_block_id: parentBlockId,
    type: "text",
    content: serializeNoteDocument(createNoteDocumentFromText(text)),
    sort_rank: sortRank,
    updated_at: "2026-05-14T00:00:00.000Z",
  };
}

async function waitForEditors(container: HTMLElement) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const editorElements = container.querySelectorAll(".ProseMirror");
    if (editorElements.length >= 2) {
      return Array.from(editorElements) as HTMLElement[];
    }

    await act(async () => {
      await Promise.resolve();
    });
  }

  throw new Error("Editors failed to initialize");
}

async function waitForEditorCount(container: HTMLElement, count: number) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const editorElements = container.querySelectorAll(".ProseMirror");
    if (editorElements.length === count) {
      return Array.from(editorElements) as HTMLElement[];
    }

    await act(async () => {
      await Promise.resolve();
    });
  }

  throw new Error(`Expected ${count} editors`);
}

function dispatchEditorKey(target: HTMLElement, key: string, options?: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });

  target.dispatchEvent(event);
  return event;
}

function dispatchMouseClick(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}

const TreeHarness = forwardRef<TreeHarnessHandle, {
  blocks: NoteBlockRow[];
  initialFocusTarget: FocusTarget;
}>(({ blocks, initialFocusTarget }, ref) => {
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [blockContentDrafts, setBlockContentDrafts] = useState<Record<string, string>>({});
  const [optimisticBlockStructure, setOptimisticBlockStructure] = useState<Record<string, { parent_block_id: string | null; sort_rank: string | null }>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(initialFocusTarget);

  const actions = useNoteBlockActions({
    selectedBlocks: blocks,
    selectedPageId: "page-1",
    selectedPageIdForWrite: "page-1",
    isCreatingBlock,
    currentFocusTarget: focusTarget,
    blockContentDrafts,
    optimisticBlockStructure,
    setIsCreatingBlock,
    setBlockContentDrafts,
    setOptimisticBlockStructure,
    setFocusTarget,
  });

  useImperativeHandle(ref, () => ({
    snapshot: () => ({
      structuredBlocks: actions.structuredBlocks,
      focusTarget,
    }),
  }), [actions.structuredBlocks, focusTarget]);

  return React.createElement(NotesBlockTree, {
    blocks: actions.structuredBlocks,
    focusedBlockId: focusTarget?.blockId ?? null,
    focusPlacement: focusTarget?.placement ?? undefined,
    onCreateFirstBlock: () => undefined,
    onFocusApplied: () => undefined,
    onFocusBlock: (blockId: string, placement: "start" | "end") => setFocusTarget({ blockId, placement }),
    notePageTitles: [],
    onCreateSibling: actions.handleCreateSiblingBlock,
    onCreateEmptySibling: actions.handleCreateEmptySiblingBlock,
    onCreateSiblings: actions.handleCreateSiblingBlocks,
    onMergeWithPrevious: actions.handleMergeWithPreviousBlock,
    onCommitContent: actions.handleCommitBlockContent,
    onIndent: actions.handleIndentBlock,
    onOutdent: actions.handleOutdentBlock,
    onMoveSelectedBlockRange: actions.handleMoveSelectedBlockRange,
    onDelete: actions.handleDeleteBlock,
    onDeleteRange: actions.handleDeleteBlockRange,
    onUpdateContent: actions.handleUpdateBlockContent,
  });
});

TreeHarness.displayName = "TreeHarness";

it("forwards structured paste handlers to nested child editors", async () => {
  const onCreateSiblings = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(NotesBlockTree, {
        blocks: [
          createBlock("parent", null, "0|hzzzzz:", "Parent"),
          createBlock("child", "parent", "0|i00007:", "Child"),
        ],
        onCreateFirstBlock: vi.fn(),
        onFocusBlock: vi.fn(),
        notePageTitles: [],
        onCreateSibling: vi.fn(),
        onCreateEmptySibling: vi.fn(),
        onCreateSiblings,
        onMergeWithPrevious: vi.fn(),
        onCommitContent: vi.fn(),
        onIndent: vi.fn(),
        onOutdent: vi.fn(),
        onMoveSelectedBlockRange: vi.fn(),
        onDelete: vi.fn(),
        onDeleteRange: vi.fn(),
        onUpdateContent: vi.fn(),
      }),
    );
  });

  const [, childEditor] = await waitForEditors(container);
  const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: (type: string) => string };
  };

  Object.defineProperty(pasteEvent, "clipboardData", {
    value: {
      getData(type: string) {
        if (type === "text/plain") {
          return [
            "- first",
            "  - nested",
            "- second",
          ].join("\n");
        }

        return "";
      },
    },
  });

  await act(async () => {
    childEditor.dispatchEvent(pasteEvent);
  });

  expect(onCreateSiblings).toHaveBeenCalledTimes(1);
  expect(onCreateSiblings).toHaveBeenCalledWith(
    "child",
    "parent",
    expect.objectContaining({ children: [expect.any(Object)] }),
    expect.any(Array),
  );

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("deletes an empty block through the Backspace editor flow and updates tree state optimistically", async () => {
  vi.clearAllMocks();
  createNoteBlockMock.mockReset();
  deleteNoteBlockMock.mockResolvedValue(undefined);
  moveNoteBlockMock.mockReset();
  queueNoteBlockCreateMock.mockReset();
  queueNoteBlockCreatesMock.mockReset();
  updateNoteBlockMock.mockReset();
  flushUpdateMock.mockResolvedValue(undefined);

  const ref = React.createRef<TreeHarnessHandle>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(TreeHarness, {
        ref,
        blocks: [
          createBlock("first", null, "0|hzzzzz:", "First"),
          createBlock("current", null, "0|i00007:", ""),
        ],
        initialFocusTarget: { blockId: "current", placement: "start" },
      }),
    );
  });

  const [, emptyEditor] = await waitForEditors(container);

  await act(async () => {
    dispatchEditorKey(emptyEditor, "Backspace");
    await Promise.resolve();
  });

  await waitForEditorCount(container, 1);

  expect(deleteNoteBlockMock).toHaveBeenCalledWith("current", "page-1");
  expect(ref.current?.snapshot().structuredBlocks.map((block) => block.id)).toEqual(["first"]);
  expect(ref.current?.snapshot().focusTarget).toEqual({ blockId: "first", placement: "end" });

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("moves a focused unselected block with Alt+ArrowDown", async () => {
  vi.clearAllMocks();
  moveNoteBlockMock.mockReset();

  const ref = React.createRef<TreeHarnessHandle>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(TreeHarness, {
        ref,
        blocks: [
          createBlock("first", null, "0|hzzzzz:", "First"),
          createBlock("second", null, "0|i00007:", "Second"),
          createBlock("third", null, "0|i0000f:", "Third"),
        ],
        initialFocusTarget: null,
      }),
    );
  });

  const [, focusedEditor] = await waitForEditors(container);

  await act(async () => {
    dispatchEditorKey(focusedEditor, "ArrowDown", { altKey: true });
    await Promise.resolve();
  });

  expect(moveNoteBlockMock).toHaveBeenCalledTimes(1);
  expect(moveNoteBlockMock).toHaveBeenCalledWith(expect.objectContaining({
    blockId: "second",
    pageId: "page-1",
    parentBlockId: null,
  }));
  expect(ref.current?.snapshot().structuredBlocks.map((block) => block.id)).toEqual(["first", "third", "second"]);
  expect(ref.current?.snapshot().focusTarget).toEqual({ blockId: "second", placement: "start" });

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("preserves shift selection across focus moves and moves the selected range with Alt+ArrowDown", async () => {
  vi.clearAllMocks();
  moveNoteBlockMock.mockReset();

  const ref = React.createRef<TreeHarnessHandle>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(TreeHarness, {
        ref,
        blocks: [
          createBlock("first", null, "0|hzzzzz:", "First"),
          createBlock("second", null, "0|i00007:", "Second"),
          createBlock("third", null, "0|i0000f:", "Third"),
          createBlock("fourth", null, "0|i0000n:", "Fourth"),
        ],
        initialFocusTarget: { blockId: "second", placement: "start" },
      }),
    );
  });

  const [, secondEditor, thirdEditor] = await waitForEditors(container);

  await act(async () => {
    dispatchEditorKey(secondEditor, "ArrowDown", { shiftKey: true });
    await Promise.resolve();
  });

  const selectedBlocksAfterShift = Array.from(container.querySelectorAll('[class*="bg-accent/45"]'));
  expect(selectedBlocksAfterShift).toHaveLength(2);

  await act(async () => {
    dispatchEditorKey(thirdEditor, "ArrowDown", { altKey: true });
    await Promise.resolve();
  });

  expect(moveNoteBlockMock).toHaveBeenCalledTimes(2);
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ blockId: "second" }));
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ blockId: "third" }));
  expect(ref.current?.snapshot().structuredBlocks.map((block) => block.id)).toEqual(["first", "fourth", "second", "third"]);

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("shows block context menu move actions and routes them through the block move handler", async () => {
  const onMoveSelectedBlockRange = vi.fn();
  const onDelete = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(NotesBlockTree, {
        blocks: [
          createBlock("first", null, "0|hzzzzz:", "First"),
          createBlock("second", null, "0|i00007:", "Second"),
          createBlock("third", null, "0|i0000f:", "Third"),
        ],
        onCreateFirstBlock: vi.fn(),
        onFocusBlock: vi.fn(),
        notePageTitles: [],
        onCreateSibling: vi.fn(),
        onCreateEmptySibling: vi.fn(),
        onCreateSiblings: vi.fn(),
        onMergeWithPrevious: vi.fn(),
        onCommitContent: vi.fn(),
        onIndent: vi.fn(),
        onOutdent: vi.fn(),
        onMoveSelectedBlockRange,
        onDelete,
        onDeleteRange: vi.fn(),
        onUpdateContent: vi.fn(),
      }),
    );
  });

  const bulletButtons = Array.from(container.querySelectorAll('button[aria-label="Toggle raw markdown view"]')) as HTMLButtonElement[];

  await act(async () => {
    bulletButtons[1].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });

  const moveUpButton = container.querySelector('button[aria-label="Move block up"]') as HTMLButtonElement | null;
  const moveDownButton = container.querySelector('button[aria-label="Move block down"]') as HTMLButtonElement | null;

  expect(moveUpButton).not.toBeNull();
  expect(moveDownButton).not.toBeNull();

  await act(async () => {
    if (moveUpButton) {
      dispatchMouseClick(moveUpButton);
    }
  });

  expect(onMoveSelectedBlockRange).toHaveBeenNthCalledWith(1, ["second"], "up", "second");

  await act(async () => {
    bulletButtons[1].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });

  const reopenedMoveDownButton = container.querySelector('button[aria-label="Move block down"]') as HTMLButtonElement | null;

  await act(async () => {
    if (reopenedMoveDownButton) {
      dispatchMouseClick(reopenedMoveDownButton);
    }
  });

  expect(onMoveSelectedBlockRange).toHaveBeenNthCalledWith(2, ["second"], "down", "second");
  expect(onDelete).not.toHaveBeenCalled();

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("preserves an existing shift selection when moving from the block context menu", async () => {
  vi.clearAllMocks();
  moveNoteBlockMock.mockReset();

  const ref = React.createRef<TreeHarnessHandle>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(TreeHarness, {
        ref,
        blocks: [
          createBlock("first", null, "0|hzzzzz:", "First"),
          createBlock("second", null, "0|i00007:", "Second"),
          createBlock("third", null, "0|i0000f:", "Third"),
          createBlock("fourth", null, "0|i0000n:", "Fourth"),
        ],
        initialFocusTarget: { blockId: "second", placement: "start" },
      }),
    );
  });

  const [, secondEditor] = await waitForEditors(container);

  await act(async () => {
    dispatchEditorKey(secondEditor, "ArrowDown", { shiftKey: true });
    await Promise.resolve();
  });

  const bulletButtons = Array.from(container.querySelectorAll('button[aria-label="Toggle raw markdown view"]')) as HTMLButtonElement[];

  await act(async () => {
    bulletButtons[2].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });

  const moveDownButton = container.querySelector('button[aria-label="Move block down"]') as HTMLButtonElement | null;

  await act(async () => {
    if (moveDownButton) {
      dispatchMouseClick(moveDownButton);
    }
    await Promise.resolve();
  });

  expect(moveNoteBlockMock).toHaveBeenCalledTimes(2);
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ blockId: "second" }));
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ blockId: "third" }));
  expect(ref.current?.snapshot().structuredBlocks.map((block) => block.id)).toEqual(["first", "fourth", "second", "third"]);

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});