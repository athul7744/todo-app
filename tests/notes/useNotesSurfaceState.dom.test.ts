/// <reference types="vitest/globals" />

import React, { act, forwardRef, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { NoteBlockRow } from "@/hooks/use-notes";
import { useNotesSurfaceState } from "@/components/notes/page/useNotesSurfaceState";
import { serializeNoteDocument, createNoteDocumentFromText } from "@/lib/notes/notes-content";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HarnessHandle = {
  snapshot: () => ReturnType<typeof useNotesSurfaceState>;
};

type HookProps = Parameters<typeof useNotesSurfaceState>[0];

const HookHost = forwardRef<HarnessHandle, HookProps>((props, ref) => {
  const snapshot = useNotesSurfaceState(props);

  useImperativeHandle(ref, () => ({
    snapshot: () => snapshot,
  }), [snapshot]);

  return null;
});

HookHost.displayName = "HookHost";

function createBlock(id: string, text: string): NoteBlockRow {
  return {
    id,
    user_id: "user-1",
    page_id: "page-1",
    parent_block_id: null,
    type: "text",
    content: serializeNoteDocument(createNoteDocumentFromText(text)),
    sort_rank: "0|hzzzzz:",
    updated_at: "2026-05-14T00:00:00.000Z",
  };
}

it("keeps cached editor content in sync with the latest display blocks during selected-page loading", async () => {
  const ref = React.createRef<HarnessHandle>();
  const container = document.createElement("div");
  let root: Root | null = null;

  const baseProps: HookProps = {
    selectedPageId: "page-1",
    isLoading: false,
    isLoadingSelectedPage: false,
    favoritePages: [],
    recentAccessPages: [],
    selectedPageIdForEditor: "page-1",
    selectedPageTitle: "Page",
    activePageEmoji: null,
    isSelectedPageFavorite: false,
    selectedBlockCount: 1,
    linkedReferenceCount: 0,
    displayBlocks: [createBlock("a", "Before")],
    updatedTimestamp: null,
  };

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, {
      ref,
      ...baseProps,
    }));
  });

  await act(async () => {
    root?.render(React.createElement(HookHost, {
      ref,
      ...baseProps,
      isLoadingSelectedPage: true,
      displayBlocks: [createBlock("a", "After")],
    }));
  });

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.editorContentToRender?.blocks).toHaveLength(1);
  expect(snapshot?.editorContentToRender?.blocks[0]?.content).toBe(serializeNoteDocument(createNoteDocumentFromText("After")));

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

it("prefers live same-page editor content over stale cache while selected-page loading is true", async () => {
  const ref = React.createRef<HarnessHandle>();
  const container = document.createElement("div");
  let root: Root | null = null;

  const baseProps: HookProps = {
    selectedPageId: "page-1",
    isLoading: false,
    isLoadingSelectedPage: false,
    favoritePages: [],
    recentAccessPages: [],
    selectedPageIdForEditor: "page-1",
    selectedPageTitle: "Page",
    activePageEmoji: null,
    isSelectedPageFavorite: false,
    selectedBlockCount: 1,
    linkedReferenceCount: 0,
    displayBlocks: [createBlock("a", "Before")],
    updatedTimestamp: null,
  };

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HookHost, {
      ref,
      ...baseProps,
    }));
  });

  await act(async () => {
    root?.render(React.createElement(HookHost, {
      ref,
      ...baseProps,
      isLoadingSelectedPage: true,
      selectedBlockCount: 2,
      displayBlocks: [
        createBlock("a", "Before"),
        createBlock("b", "New block"),
      ],
    }));
  });

  const snapshot = ref.current?.snapshot();
  expect(snapshot?.editorContentToRender?.pageId).toBe("page-1");
  expect(snapshot?.editorContentToRender?.blocks).toHaveLength(2);
  expect(snapshot?.editorContentToRender?.blocks[1]?.content).toBe(serializeNoteDocument(createNoteDocumentFromText("New block")));
  expect(snapshot?.showEditorOverlay).toBe(false);

  await act(async () => {
    root?.unmount();
  });
  container.remove();
});
