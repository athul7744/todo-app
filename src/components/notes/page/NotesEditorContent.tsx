"use client";

import { NotesBlockTree } from "@/components/notes/NotesBlockTree";
import { NotesEditorMainSkeleton } from "@/components/notes/NotesPageSkeleton";
import type { JsonValue } from "@/lib/notes/notes";

import { NotesEditorHeader } from "./NotesEditorHeader";
import type { NotesEditorRenderableContent } from "./types";

type FocusTarget = { blockId: string; placement: "start" | "end" } | null;

export function NotesEditorContent({
  editorContent,
  showSelectedPageLoading,
  showEditorOverlay,
  shouldAnimateEditorContent,
  pageTitleDraft,
  pageTitleError,
  isEmojiPickerOpen,
  activePageEmoji,
  focusTarget,
  notePageTitles,
  onBack,
  onTitleChange,
  onCommitTitle,
  onToggleFavorite,
  onEmojiPickerOpenChange,
  onSelectEmoji,
  onCreateFirstBlock,
  onFocusApplied,
  onFocusBlock,
  onOpenPageReference,
  onCreateSibling,
  onCreateEmptySibling,
  onCreateSiblings,
  onCommitContent,
  onIndent,
  onOutdent,
  onDelete,
  onUpdateContent,
}: {
  editorContent: NotesEditorRenderableContent;
  showSelectedPageLoading: boolean;
  showEditorOverlay: boolean;
  shouldAnimateEditorContent: boolean;
  pageTitleDraft: string;
  pageTitleError: string | null;
  isEmojiPickerOpen: boolean;
  activePageEmoji: string | null;
  focusTarget: FocusTarget;
  notePageTitles: string[];
  onBack: () => void;
  onTitleChange: (value: string) => void;
  onCommitTitle: () => void | Promise<void>;
  onToggleFavorite: () => void;
  onEmojiPickerOpenChange: (open: boolean) => void;
  onSelectEmoji: (emoji: string | null) => void;
  onCreateFirstBlock: () => void | Promise<void>;
  onFocusApplied: () => void;
  onFocusBlock: (blockId: string, placement: "start" | "end") => void;
  onOpenPageReference: (title: string) => void;
  onCreateSibling: (blockId: string, parentBlockId: string | null | undefined, nextContent: JsonValue, nextSiblingContent?: JsonValue) => void | Promise<void>;
  onCreateEmptySibling: (blockId: string, parentBlockId: string | null | undefined) => void | Promise<void>;
  onCreateSiblings: (blockId: string, parentBlockId: string | null | undefined, nextContent: JsonValue, nextSiblingContents: JsonValue[]) => void | Promise<void>;
  onCommitContent: (blockId: string, nextContent: JsonValue) => void;
  onIndent: (blockId: string, nextParentBlockId: string) => void;
  onOutdent: (blockId: string, nextParentBlockId?: string | null) => void;
  onDelete: (blockId: string) => void | Promise<void>;
  onUpdateContent: (blockId: string, nextContent: JsonValue) => void;
}) {
  if (showSelectedPageLoading && !editorContent) {
    return (
      <div className="mx-auto max-w-3xl">
        <NotesEditorMainSkeleton />
      </div>
    );
  }

  if (!editorContent) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-sm text-muted-foreground">
        This page is not available locally.
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-3xl">
      <div className={showEditorOverlay ? "pointer-events-none opacity-0 transition-opacity duration-100" : "transition-opacity duration-150"}>
        <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-1 gap-y-4 md:gap-x-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${shouldAnimateEditorContent ? "animate-fade-slide-in" : ""}`}>
          <NotesEditorHeader
            editorContent={editorContent}
            showEditorOverlay={showEditorOverlay}
            shouldAnimateEditorContent={shouldAnimateEditorContent}
            pageTitleDraft={pageTitleDraft}
            pageTitleError={pageTitleError}
            isEmojiPickerOpen={isEmojiPickerOpen}
            activePageEmoji={activePageEmoji}
            onBack={onBack}
            onTitleChange={onTitleChange}
            onCommitTitle={onCommitTitle}
            onToggleFavorite={onToggleFavorite}
            onEmojiPickerOpenChange={onEmojiPickerOpenChange}
            onSelectEmoji={onSelectEmoji}
          />

          <div className={`col-span-2 sm:col-start-2 sm:col-span-2 ${shouldAnimateEditorContent ? "animate-fade-slide-in" : ""}`}>
            <NotesBlockTree
              blocks={editorContent.blocks}
              onCreateFirstBlock={onCreateFirstBlock}
              focusedBlockId={focusTarget?.blockId ?? null}
              focusPlacement={focusTarget?.placement ?? "end"}
              onFocusApplied={onFocusApplied}
              onFocusBlock={onFocusBlock}
              notePageTitles={notePageTitles}
              onOpenPageReference={onOpenPageReference}
              onCreateSibling={onCreateSibling}
              onCreateEmptySibling={onCreateEmptySibling}
              onCreateSiblings={onCreateSiblings}
              onCommitContent={onCommitContent}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDelete={onDelete}
              onUpdateContent={onUpdateContent}
            />
          </div>
        </div>
      </div>
      {showEditorOverlay ? (
        <div className="pointer-events-none absolute inset-0 bg-background">
          <NotesEditorMainSkeleton />
        </div>
      ) : null}
    </div>
  );
}