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
  type NoteBlockInsert,
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
  createSiblingBlocks: (blockId: string, parentBlockId: string | null | undefined, nextContent: NoteBlockInsert, nextSiblingContents: NoteBlockInsert[]) => Promise<void>;
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
    currentFocusTarget: focusTarget,
    blockContentDrafts,
    optimisticBlockStructure,
    setIsCreatingBlock,
    setBlockContentDrafts,
    setOptimisticBlockStructure,
    setFocusTarget,
  });

  useImperativeHandle(ref, () => ({
    createEmptySibling: actions.handleCreateEmptySiblingBlock,
    createSiblingBlocks: actions.handleCreateSiblingBlocks,
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
  expect(flushUpdateMock).toHaveBeenCalledWith("current", "blocks");
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

it("allows deleting a newly created pending block before its create promise settles", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);

  const pendingCreate = { resolve: null as ((value: string) => void) | null };
  queueNoteBlockCreateMock.mockImplementationOnce(() => new Promise<string>((resolve) => {
    pendingCreate.resolve = resolve;
  }));
  deleteNoteBlockMock.mockResolvedValue(undefined);

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
    void ref.current?.createEmptySibling("first", null);
    await Promise.resolve();
  });

  const pendingCreatedBlock = ref.current?.snapshot().structuredBlocks.find((block) => block.id !== "first");
  expect(pendingCreatedBlock).toBeTruthy();

  await act(async () => {
    await ref.current?.deleteBlock(pendingCreatedBlock?.id ?? "");
  });

  expect(deleteNoteBlockMock).toHaveBeenCalledWith(pendingCreatedBlock?.id, "page-1");
  expect(ref.current?.snapshot().structuredBlocks.map((block) => block.id)).toEqual(["first"]);

  await act(async () => {
    pendingCreate.resolve?.(pendingCreatedBlock?.id ?? "");
    await Promise.resolve();
  });

  await act(async () => {
    root?.unmount();
  });
});

it("restores the deleted block and child structure when delete persistence fails", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);
  deleteNoteBlockMock.mockRejectedValueOnce(new Error("delete failed"));

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("previous", null, "0|hzzzzz:", "Previous"),
    createBlock("current", null, "0|i00007:", ""),
    createBlock("child-a", "current", "0|i0000f:", "Child A"),
    createBlock("child-b", "current", "0|i0000n:", "Child B"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await expect(act(async () => {
    await ref.current?.deleteBlock("current");
  })).rejects.toThrow("delete failed");

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.focusTarget).toBeNull();
  expect(snapshot?.structuredBlocks.map((block) => block.id)).toEqual(["previous", "current", "child-a", "child-b"]);
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-a")?.parent_block_id).toBe("current");
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-b")?.parent_block_id).toBe("current");

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

it("pastes copied child blocks into another child block without flattening them to the root", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);
  queueNoteBlockCreatesMock.mockResolvedValue([]);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("parent-a", null, "0|hzzzzz:", "Parent A"),
    createBlock("child-a", "parent-a", "0|i00007:", "Child A"),
    createBlock("grandchild-a", "child-a", "0|i0000f:", "Grandchild A"),
    createBlock("parent-b", null, "0|i0000n:", "Parent B"),
    createBlock("child-b", "parent-b", "0|i0000v:", "Child B"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.createSiblingBlocks(
      "child-b",
      "parent-b",
      {
        content: createNoteDocumentFromText("Child A"),
        children: [
          {
            content: createNoteDocumentFromText("Grandchild A"),
            children: [],
          },
        ],
      },
      [],
    );
  });

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.structuredBlocks.find((block) => block.id === "child-b")?.parent_block_id).toBe("parent-b");
  expect(extractNoteText(snapshot?.structuredBlocks.find((block) => block.id === "child-b")?.content as JsonValue)).toBe("Child A");

  const createdNestedChild = snapshot?.structuredBlocks.find((block) => block.id !== "parent-a" && block.id !== "child-a" && block.id !== "grandchild-a" && block.id !== "parent-b" && block.id !== "child-b");
  expect(createdNestedChild).toBeTruthy();
  expect(createdNestedChild?.parent_block_id).toBe("child-b");
  expect(extractNoteText(createdNestedChild?.content as JsonValue)).toBe("Grandchild A");

  await act(async () => {
    root?.unmount();
  });
});

it("preserves relative subtree structure when mixed-indent blocks are pasted at a different depth", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);
  queueNoteBlockCreatesMock.mockResolvedValue([]);

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("source-parent", null, "0|hzzzzz:", "Source Parent"),
    createBlock("source-child", "source-parent", "0|i00007:", "Source Child"),
    createBlock("source-grandchild", "source-child", "0|i0000f:", "Source Grandchild"),
    createBlock("source-sibling-root", null, "0|i0000n:", "Source Sibling Root"),
    createBlock("source-sibling-child", "source-sibling-root", "0|i0000v:", "Source Sibling Child"),
    createBlock("target-parent", null, "0|i00013:", "Target Parent"),
    createBlock("target-child", "target-parent", "0|i0001b:", "Target Child"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    await ref.current?.createSiblingBlocks(
      "target-child",
      "target-parent",
      {
        content: createNoteDocumentFromText("Source Child"),
        children: [
          {
            content: createNoteDocumentFromText("Source Grandchild"),
            children: [],
          },
        ],
      },
      [
        {
          content: createNoteDocumentFromText("Source Sibling Root"),
          children: [
            {
              content: createNoteDocumentFromText("Source Sibling Child"),
              children: [],
            },
          ],
        },
      ],
    );
  });

  const snapshot = ref.current?.snapshot();
  const targetChild = snapshot?.structuredBlocks.find((block) => block.id === "target-child");
  expect(extractNoteText(targetChild?.content as JsonValue)).toBe("Source Child");
  expect(targetChild?.parent_block_id).toBe("target-parent");

  const createdBlocks = snapshot?.structuredBlocks.filter((block) => !blocks.some((existingBlock) => existingBlock.id === block.id)) ?? [];
  expect(createdBlocks).toHaveLength(3);

  const pastedGrandchild = createdBlocks.find((block) => extractNoteText(block.content) === "Source Grandchild");
  const pastedSiblingRoot = createdBlocks.find((block) => extractNoteText(block.content) === "Source Sibling Root");
  const pastedSiblingChild = createdBlocks.find((block) => extractNoteText(block.content) === "Source Sibling Child");

  expect(pastedGrandchild?.parent_block_id).toBe("target-child");
  expect(pastedSiblingRoot?.parent_block_id).toBe("target-parent");
  expect(pastedSiblingChild?.parent_block_id).toBe(pastedSiblingRoot?.id);

  await act(async () => {
    root?.unmount();
  });
});

it("pastes all selected blocks into a newly created pending child block", async () => {
  vi.clearAllMocks();
  flushUpdateMock.mockResolvedValue(undefined);
  queueNoteBlockCreatesMock.mockResolvedValue([]);

  const pendingCreate = { resolve: null as ((value: string) => void) | null };
  queueNoteBlockCreateMock.mockImplementationOnce(() => new Promise<string>((resolve) => {
    pendingCreate.resolve = resolve;
  }));

  const ref = React.createRef<HarnessHandle>();
  const blocks = [
    createBlock("parent", null, "0|hzzzzz:", "Parent"),
    createBlock("child-a", "parent", "0|i00007:", "Child A"),
  ];

  const container = document.createElement("div");
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, { ref, blocks }));
  });

  await act(async () => {
    void ref.current?.createEmptySibling("child-a", "parent");
    await Promise.resolve();
  });

  const pendingCreatedBlock = ref.current?.snapshot().structuredBlocks.find((block) => !blocks.some((existingBlock) => existingBlock.id === block.id));
  expect(pendingCreatedBlock).toBeTruthy();

  await act(async () => {
    await ref.current?.createSiblingBlocks(
      pendingCreatedBlock?.id ?? "",
      "parent",
      {
        content: createNoteDocumentFromText("Top"),
        children: [
          {
            content: createNoteDocumentFromText("Nested"),
            children: [],
          },
        ],
      },
      [
        {
          content: createNoteDocumentFromText("Sibling"),
          children: [],
        },
      ],
    );
  });

  const snapshot = ref.current?.snapshot();
  const updatedPendingBlock = snapshot?.structuredBlocks.find((block) => block.id === pendingCreatedBlock?.id);
  expect(extractNoteText(updatedPendingBlock?.content as JsonValue)).toBe("Top");

  const createdBlocks = snapshot?.structuredBlocks.filter((block) => !blocks.some((existingBlock) => existingBlock.id === block.id) && block.id !== pendingCreatedBlock?.id) ?? [];
  const nestedChild = createdBlocks.find((block) => extractNoteText(block.content) === "Nested");
  const siblingBlock = createdBlocks.find((block) => extractNoteText(block.content) === "Sibling");

  expect(nestedChild?.parent_block_id).toBe(pendingCreatedBlock?.id);
  expect(siblingBlock?.parent_block_id).toBe("parent");

  if (pendingCreate.resolve) {
    pendingCreate.resolve("pending-created");
  }

  await act(async () => {
    await Promise.resolve();
    root?.unmount();
  });
});