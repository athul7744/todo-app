/// <reference types="vitest/globals" />

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { NotesBlockTree } from "@/components/notes/NotesBlockTree";
import { createNoteDocumentFromText, serializeNoteDocument } from "@/lib/notes/notes-content";

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

function createBlock(id: string, parentBlockId: string | null, sortRank: string, text: string) {
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