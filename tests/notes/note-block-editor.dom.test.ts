/// <reference types="vitest/globals" />

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { JSONContent } from "@tiptap/core";

import { NoteBlockEditor } from "@/components/notes/NoteBlockEditor";
import { createNoteDocumentFromText, extractNoteText, serializeNoteDocument } from "@/lib/notes/notes-content";

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

function createParagraphDocument(paragraphs: string[]): JSONContent {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text.length > 0 ? [{ type: "text", text }] : [],
    })),
  };
}

function getParagraphStartSelection(paragraphs: string[], index: number) {
  const offset = paragraphs
    .slice(0, index)
    .reduce((total, paragraph) => total + paragraph.length + 2, 0);

  return offset + 1;
}

async function waitForEditorElement(container: HTMLElement) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const editorElement = container.querySelector(".ProseMirror") as HTMLElement | null;
    if (editorElement) {
      return editorElement;
    }

    await act(async () => {
      await Promise.resolve();
    });
  }

  throw new Error("Editor failed to initialize");
}

async function mountNoteBlockEditor(options?: {
  content?: string;
  hasChildren?: boolean;
  focusPlacement?: number | "start" | "end";
  shouldFocus?: boolean;
}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const onCreateSibling = vi.fn();
  const onNavigateUp = vi.fn();
  const onNavigateDown = vi.fn();
  const onSelectUp = vi.fn();
  const onSelectDown = vi.fn();
  const onMergeWithPrevious = vi.fn();
  const onIndent = vi.fn();
  const onOutdent = vi.fn();
  const onDeleteEmpty = vi.fn();
  const onFocusApplied = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(NoteBlockEditor, {
        content: options?.content ?? serializeNoteDocument(createNoteDocumentFromText("Hello world")),
        notePageTitles: [],
        hasChildren: options?.hasChildren ?? false,
        shouldFocus: options?.shouldFocus ?? true,
        focusPlacement: options?.focusPlacement ?? "end",
        onFocusApplied,
        onChange,
        onCommit,
        onCreateSibling,
        onNavigateUp,
        onNavigateDown,
        onSelectUp,
        onSelectDown,
        onMergeWithPrevious,
        onIndent,
        onOutdent,
        onDeleteEmpty,
      })
    );
  });

  const editorElement = await waitForEditorElement(container);

  return {
    container,
    editorElement,
    onChange,
    onCommit,
    onCreateSibling,
    onNavigateUp,
    onNavigateDown,
    onSelectUp,
    onSelectDown,
    onMergeWithPrevious,
    onIndent,
    onOutdent,
    onDeleteEmpty,
    onFocusApplied,
    async unmount() {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    },
  };
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

async function selectAllEditorText(target: HTMLElement) {
  target.focus();

  const selection = window.getSelection();
  if (!selection) {
    throw new Error("Selection API unavailable");
  }

  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));

  await act(async () => {
    await Promise.resolve();
  });
}

it("splits a parent block in place when Enter is pressed mid-line", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("Hello world")),
    hasChildren: true,
    focusPlacement: 7,
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "Enter");
  });

  expect(mounted.onCreateSibling).toHaveBeenCalledTimes(1);
  const [currentBlockContent, createdSiblingContent, splitOptions] = mounted.onCreateSibling.mock.calls[0] ?? [];
  expect(extractNoteText(currentBlockContent)).toBe("world");
  expect(extractNoteText(createdSiblingContent)).toBe("Hello");
  expect(splitOptions).toEqual({
    insertionSide: "before",
    focusPlacement: "start",
    focusTarget: "current",
  });
  expect(mounted.editorElement.textContent?.trim()).toBe("world");

  await mounted.unmount();
});

it("inserts an empty sibling before a parent block when Enter is pressed at the start", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("Hello world")),
    hasChildren: true,
    focusPlacement: "start",
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "Enter");
  });

  expect(mounted.onCreateSibling).toHaveBeenCalledTimes(1);
  const [currentBlockContent, createdSiblingContent, splitOptions] = mounted.onCreateSibling.mock.calls[0] ?? [];
  expect(extractNoteText(currentBlockContent)).toBe("Hello world");
  expect(extractNoteText(createdSiblingContent)).toBe("");
  expect(splitOptions).toEqual({
    insertionSide: "before",
    focusPlacement: "end",
    focusTarget: "created",
  });
  expect(mounted.editorElement.textContent?.trim()).toBe("Hello world");

  await mounted.unmount();
});

it("navigates down from the visible text boundary", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("Hello world")),
    focusPlacement: "end",
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "ArrowDown");
  });

  expect(mounted.onNavigateDown).toHaveBeenCalledTimes(1);
  await mounted.unmount();
});

it("does not trigger a structural merge when Backspace is pressed at the start of a later paragraph", async () => {
  const paragraphs = ["First", "Second"];
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createParagraphDocument(paragraphs)),
    focusPlacement: getParagraphStartSelection(paragraphs, 1),
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "Backspace");
  });

  expect(mounted.onMergeWithPrevious).not.toHaveBeenCalled();
  await mounted.unmount();
});

it("does not trigger a structural merge when all block text is selected from the start", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("Hello world")),
    focusPlacement: "start",
  });

  await selectAllEditorText(mounted.editorElement);

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "Backspace");
  });

  expect(mounted.onMergeWithPrevious).not.toHaveBeenCalled();
  expect(mounted.onDeleteEmpty).not.toHaveBeenCalled();
  await mounted.unmount();
});

it("does not delete an empty block when a non-Backspace key is pressed", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("")),
    focusPlacement: "start",
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "a");
  });

  expect(mounted.onDeleteEmpty).not.toHaveBeenCalled();

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "ArrowDown");
  });

  expect(mounted.onDeleteEmpty).not.toHaveBeenCalled();
  await mounted.unmount();
});

it("uses shift-arrow to extend whole-line selection instead of plain navigation", async () => {
  const mounted = await mountNoteBlockEditor({
    content: serializeNoteDocument(createNoteDocumentFromText("Hello world")),
    focusPlacement: "end",
  });

  await act(async () => {
    dispatchEditorKey(mounted.editorElement, "ArrowDown", { shiftKey: true });
  });

  expect(mounted.onSelectDown).toHaveBeenCalledTimes(1);
  expect(mounted.onNavigateDown).not.toHaveBeenCalled();

  await mounted.unmount();
});
