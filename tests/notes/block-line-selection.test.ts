/// <reference types="vitest/globals" />

import { createNoteDocumentFromText, serializeNoteDocument } from "@/lib/notes/notes-content";
import {
  buildBlockClipboardBlocks,
  getSelectedBlockIds,
  parseBlockClipboardData,
  serializeBlockClipboardData,
  serializeBlockClipboardMarkdown,
} from "@/lib/notes/block-line-selection";

function createBlock(id: string, parentBlockId: string | null, text: string) {
  return {
    id,
    parent_block_id: parentBlockId,
    content: serializeNoteDocument(createNoteDocumentFromText(text)),
  };
}

describe("block-line-selection", () => {
  it("returns the visible contiguous block range between anchor and focus", () => {
    expect(getSelectedBlockIds(["a", "b", "c", "d"], "b", "d")).toEqual(["b", "c", "d"]);
    expect(getSelectedBlockIds(["a", "b", "c", "d"], "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("builds clipboard blocks that preserve selected nesting", () => {
    const clipboardBlocks = buildBlockClipboardBlocks(
      [
        createBlock("a", null, "Parent"),
        createBlock("b", "a", "Child"),
        createBlock("c", null, "After"),
      ],
      ["a", "b"],
    );

    expect(clipboardBlocks).toHaveLength(1);
    expect(clipboardBlocks[0]?.children).toHaveLength(1);
  });

  it("treats selected child blocks as clipboard roots when their parent is not selected", () => {
    const clipboardBlocks = buildBlockClipboardBlocks(
      [
        createBlock("parent", null, "Parent"),
        createBlock("child", "parent", "Child"),
        createBlock("grandchild", "child", "Grandchild"),
      ],
      ["child", "grandchild"],
    );

    expect(clipboardBlocks).toHaveLength(1);
    expect(clipboardBlocks[0]?.content).toEqual(createNoteDocumentFromText("Child"));
    expect(clipboardBlocks[0]?.children).toHaveLength(1);
    expect(clipboardBlocks[0]?.children[0]?.content).toEqual(createNoteDocumentFromText("Grandchild"));
  });

  it("round-trips the custom block clipboard payload", () => {
    const clipboardBlocks = buildBlockClipboardBlocks(
      [createBlock("a", null, "One"), createBlock("b", null, "Two")],
      ["a", "b"],
    );

    expect(parseBlockClipboardData(serializeBlockClipboardData(clipboardBlocks))).toEqual(clipboardBlocks);
  });

  it("serializes selected blocks to markdown list fallback", () => {
    const clipboardBlocks = buildBlockClipboardBlocks(
      [
        createBlock("a", null, "One"),
        createBlock("b", "a", "Two"),
      ],
      ["a", "b"],
    );

    expect(serializeBlockClipboardMarkdown(clipboardBlocks)).toBe("- One\n  - Two");
  });
});