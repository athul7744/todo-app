/// <reference types="vitest/globals" />

import React, { act, forwardRef, useImperativeHandle, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { NoteBlockRow } from "@/hooks/use-notes";
import { createNoteDocumentFromText, extractNoteText, getNoteDocumentEndSelection, serializeNoteDocument } from "@/lib/notes/notes-content";
import {
  createNoteBlock,
  deleteNoteBlock,
  moveNoteBlock,
  queueNoteBlockCreate,
  queueNoteBlockCreates,
  updateNoteBlock,
  type JsonValue,
} from "@/lib/notes/notes";
import { flushUpdate } from "@/lib/shared/debounced-update";
import { useNoteBlockActions } from "@/components/notes/page/useNoteBlockActions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

type HarnessHandle = {
  deleteBlock: (blockId: string) => Promise<void>;
  createEmptySibling: (blockId: string, parentBlockId?: string | null) => Promise<void>;
  mergeWithPrevious: (blockId: string, previousBlockId: string, nextContent: JsonValue, options?: { hasChildren?: boolean }) => Promise<void>;
  updateBlockContent: (blockId: string, nextContent: JsonValue) => void;
  snapshot: () => {
    structuredBlocks: NoteBlockRow[];
    focusTarget: FocusTarget;
  };
};

const HookHost = forwardRef<HarnessHandle, { blocks: NoteBlockRow[] }>(({ blocks }, ref) => {
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [blockContentDrafts, setBlockContentDrafts] = useState<Record<string, string>>({});
  const [optimisticBlockStructure, setOptimisticBlockStructure] = useState<Record<string, { parent_block_id: string | null; sort_rank: string | null }>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);

  const actions = useNoteBlockActions({
    selectedBlocks: blocks,
    selectedPageId: "page-1",
    selectedPageIdForWrite: "page-1",
    isCreatingBlock,
    blockContentDrafts,
    optimisticBlockStructure,
    setIsCreatingBlock,
    setBlockContentDrafts,
    setOptimisticBlockStructure,
    setFocusTarget,
  });

  useImperativeHandle(ref, () => ({
    createEmptySibling: actions.handleCreateEmptySiblingBlock,
    deleteBlock: actions.handleDeleteBlock,
    mergeWithPrevious: actions.handleMergeWithPreviousBlock,
    updateBlockContent: actions.handleUpdateBlockContent,
    snapshot: () => ({
      structuredBlocks: actions.structuredBlocks,
      focusTarget,
    }),
  }), [actions, focusTarget]);

  return null;
});

HookHost.displayName = "HookHost";

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

it("merges into the previous visible block and reparents direct children under it", async () => {
  vi.clearAllMocks();
  deleteNoteBlockMock.mockResolvedValue(undefined);
  flushUpdateMock.mockResolvedValue(undefined);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("previous", null, "0|hzzzzz:", "Previous"),
    createBlock("current", null, "0|i00007:", "Current"),
    createBlock("child-a", "current", "0|i0000f:", "Child A"),
    createBlock("child-b", "current", "0|i0000n:", "Child B"),
    createBlock("grandchild", "child-a", "0|i0000v:", "Grandchild"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.mergeWithPrevious(
      "current",
      "previous",
      createNoteDocumentFromText("Current"),
      { hasChildren: true }
    );
  });

  const snapshot = ref.current?.snapshot();
  const previousSelection = getNoteDocumentEndSelection(createNoteDocumentFromText("Previous"));
  expect(snapshot).toBeTruthy();
  expect(snapshot?.focusTarget).toEqual({ blockId: "previous", placement: previousSelection });
  expect(snapshot?.structuredBlocks.map((block) => block.id)).toEqual(["previous", "child-a", "child-b", "grandchild"]);
  expect(snapshot?.structuredBlocks.find((block) => block.id === "previous")?.parent_block_id).toBeNull();
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-a")?.parent_block_id).toBe("previous");
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-b")?.parent_block_id).toBe("previous");
  expect(snapshot?.structuredBlocks.find((block) => block.id === "grandchild")?.parent_block_id).toBe("child-a");

  expect(updateNoteBlockMock).toHaveBeenCalledWith(expect.objectContaining({
    blockId: "previous",
    pageId: "page-1",
  }));
  const mergedUpdate = updateNoteBlockMock.mock.calls[0]?.[0];
  expect(mergedUpdate).toBeTruthy();
  expect(extractNoteText(mergedUpdate?.content as JsonValue)).toBe("Previous Current");
  expect(moveNoteBlockMock).toHaveBeenCalledTimes(2);
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
    blockId: "child-a",
    pageId: "page-1",
    parentBlockId: "previous",
  }));
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
    blockId: "child-b",
    pageId: "page-1",
    parentBlockId: "previous",
  }));
  expect(deleteNoteBlockMock).toHaveBeenCalledWith("current", "page-1");

  await act(async () => {
    root?.unmount();
  });
});

it("focuses the next visible block at the start when deleting the first visible block", async () => {
  vi.clearAllMocks();
  deleteNoteBlockMock.mockResolvedValue(undefined);
  flushUpdateMock.mockResolvedValue(undefined);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("first", null, "0|hzzzzz:", "First"),
    createBlock("second", null, "0|i00007:", "Second"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.deleteBlock("first");
  });

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.focusTarget).toEqual({ blockId: "second", placement: "start" });
  expect(snapshot?.structuredBlocks.map((block) => block.id)).toEqual(["second"]);
  expect(deleteNoteBlockMock).toHaveBeenCalledWith("first", "page-1");

  await act(async () => {
    root?.unmount();
  });
});

it("deletes an empty parent block without dropping its direct children", async () => {
  vi.clearAllMocks();
  deleteNoteBlockMock.mockResolvedValue(undefined);
  flushUpdateMock.mockResolvedValue(undefined);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("previous", null, "0|hzzzzz:", "Previous"),
    createBlock("current", null, "0|i00007:", ""),
    createBlock("child-a", "current", "0|i0000f:", "Child A"),
    createBlock("child-b", "current", "0|i0000n:", "Child B"),
    createBlock("after", null, "0|i0000v:", "After"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.deleteBlock("current");
  });

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.focusTarget).toEqual({ blockId: "previous", placement: "end" });
  expect(snapshot?.structuredBlocks.map((block) => block.id)).toEqual(["previous", "child-a", "child-b", "after"]);
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-a")?.parent_block_id).toBeNull();
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-b")?.parent_block_id).toBeNull();
  expect(moveNoteBlockMock).toHaveBeenCalledTimes(2);
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
    blockId: "child-a",
    pageId: "page-1",
    parentBlockId: null,
  }));
  expect(moveNoteBlockMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
    blockId: "child-b",
    pageId: "page-1",
    parentBlockId: null,
  }));
  expect(deleteNoteBlockMock).toHaveBeenCalledWith("current", "page-1");

  await act(async () => {
    root?.unmount();
  });
});

it("keeps typed content visible on a newly created optimistic block before persistence catches up", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("first", null, "0|hzzzzz:", "First"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.createEmptySibling("first", null);
  });

  const createdBlock = ref.current?.snapshot().structuredBlocks.find((block) => block.id !== "first");
  expect(createdBlock).toBeTruthy();

  await act(async () => {
    ref.current?.updateBlockContent(createdBlock?.id ?? "", createNoteDocumentFromText("Typed now"));
  });

  const snapshot = ref.current?.snapshot();
  const updatedCreatedBlock = snapshot?.structuredBlocks.find((block) => block.id === createdBlock?.id);
  expect(updatedCreatedBlock).toBeTruthy();
  expect(extractNoteText(updatedCreatedBlock?.content as JsonValue)).toBe("Typed now");

  await act(async () => {
    root?.unmount();
  });
});