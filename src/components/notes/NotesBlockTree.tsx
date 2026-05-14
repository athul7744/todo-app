"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { NoteBlockEditor } from "@/components/notes/NoteBlockEditor";
import type { NoteBlockRow } from "@/hooks/use-notes";
import {
  buildBlockClipboardBlocks,
  getSelectedBlockIds,
  NOTES_BLOCK_CLIPBOARD_MIME,
  serializeBlockClipboardData,
  serializeBlockClipboardMarkdown,
} from "@/lib/notes/block-line-selection";
import { extractNoteText } from "@/lib/notes/notes-content";
import { buildNoteBlockTree, createVisibleNoteBlockNeighbors, type NoteTreeNode } from "@/lib/notes/notes-tree";
import type { JsonValue, NoteBlockInsert } from "@/lib/notes/notes";

type BlockTreeNode = NoteTreeNode<NoteBlockRow>;

export function extractBlockText(raw: string | null | undefined) {
  return extractNoteText(raw);
}

function BlockNodeView({
  node,
  depth = 0,
  previousSiblingId,
  parentBlockId,
  parentParentBlockId,
  focusedBlockId,
  focusPlacement,
  previousBlockIdById,
  nextBlockIdById,
  onFocusApplied,
  onFocusBlock,
  notePageTitles,
  onOpenPageReference,
  onCreateSibling,
  onCreateSiblings,
  onMergeWithPrevious,
  onCommitContent,
  onIndent,
  onOutdent,
  onDelete,
  onDeleteRange,
  onUpdateContent,
  onToggleMarkdownMode,
  markdownToggleVersions,
  selectedBlockIds,
  onSelectUp,
  onSelectDown,
  onClearSelection,
}: {
  node: BlockTreeNode;
  depth?: number;
  previousSiblingId?: string | null;
  parentBlockId?: string | null;
  parentParentBlockId?: string | null;
  focusedBlockId?: string | null;
  focusPlacement?: number | "start" | "end";
  previousBlockIdById: ReadonlyMap<string, string | null>;
  nextBlockIdById: ReadonlyMap<string, string | null>;
  onFocusApplied?: () => void;
  onFocusBlock: (blockId: string, placement: "start" | "end") => void;
  notePageTitles: string[];
  onOpenPageReference?: (title: string) => void;
  onCreateSibling: (
    blockId: string,
    parentBlockId: string | null | undefined,
    nextContent: JsonValue,
    nextSiblingContent?: JsonValue,
    options?: {
      focusPlacement?: "start" | "end";
      focusTarget?: "created" | "current";
      insertionSide?: "before" | "after";
    }
  ) => void;
  onCreateSiblings?: (blockId: string, parentBlockId: string | null | undefined, nextContent: NoteBlockInsert, nextSiblingContents: NoteBlockInsert[]) => Promise<void> | void;
  onMergeWithPrevious: (blockId: string, previousBlockId: string, nextContent: JsonValue, options?: { hasChildren?: boolean }) => void | Promise<void>;
  onCommitContent: (blockId: string, nextContent: JsonValue) => void;
  onIndent: (blockId: string, nextParentBlockId: string) => void;
  onOutdent: (blockId: string, nextParentBlockId?: string | null) => void;
  onDelete: (blockId: string) => void;
  onDeleteRange: (blockIds: string[]) => void | Promise<void>;
  onUpdateContent: (blockId: string, nextContent: JsonValue) => void;
  onToggleMarkdownMode: (blockId: string) => void;
  markdownToggleVersions: Record<string, number>;
  selectedBlockIds: ReadonlySet<string>;
  onSelectUp: (blockId: string, previousBlockId: string) => void;
  onSelectDown: (blockId: string, nextBlockId: string) => void;
  onClearSelection: () => void;
}) {
  const previousBlockId = previousBlockIdById.get(node.block.id) ?? null;
  const nextBlockId = nextBlockIdById.get(node.block.id) ?? null;

  return (
    <div className="space-y-0">
      <article
        className="group relative"
        onMouseDownCapture={(event) => {
          if (!event.shiftKey && selectedBlockIds.size > 0) {
            onClearSelection();
          }
        }}
        style={{ marginLeft: depth === 0 ? 0 : depth * 18 }}
      >
        <div className="flex items-center gap-px px-0 py-0">
          <div className="relative flex min-h-6 w-3.5 shrink-0 items-center justify-start self-stretch">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onToggleMarkdownMode(node.block.id);
              }}
              className={`relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-sm outline-none transition-opacity ${depth > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
              aria-label="Toggle raw markdown view"
              title="Toggle raw markdown view"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            </button>
            {depth > 0 ? <span className="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-border/60" /> : null}
          </div>
          <div className={`min-w-0 flex-1 rounded-sm transition-smooth ${selectedBlockIds.has(node.block.id) ? "bg-accent/45" : ""}`}>
            <NoteBlockEditor
              content={node.block.content}
              notePageTitles={notePageTitles}
              hasChildren={node.children.length > 0}
              markdownToggleVersion={markdownToggleVersions[node.block.id] ?? 0}
              shouldFocus={focusedBlockId === node.block.id}
              focusPlacement={focusPlacement}
              onFocusApplied={onFocusApplied}
              onChange={(nextContent) => {
                onUpdateContent(node.block.id, nextContent as JsonValue);
              }}
              onCommit={(nextContent) => {
                onCommitContent(node.block.id, nextContent as JsonValue);
              }}
              onCreateSibling={(nextContent, nextSiblingContent, options) => onCreateSibling(node.block.id, parentBlockId, nextContent as JsonValue, nextSiblingContent as JsonValue | undefined, options)}
              onCreateSiblings={onCreateSiblings ? (nextContent, nextSiblingContents) => onCreateSiblings(node.block.id, parentBlockId, nextContent, nextSiblingContents) : undefined}
              onMergeWithPrevious={previousBlockId ? (nextContent, options) => onMergeWithPrevious(node.block.id, previousBlockId, nextContent as JsonValue, options) : undefined}
              onOpenPageReference={onOpenPageReference}
              onNavigateUp={previousBlockId ? () => onFocusBlock(previousBlockId, "end") : undefined}
              onNavigateDown={nextBlockId ? () => onFocusBlock(nextBlockId, "start") : undefined}
              onSelectUp={previousBlockId ? () => onSelectUp(node.block.id, previousBlockId) : undefined}
              onSelectDown={nextBlockId ? () => onSelectDown(node.block.id, nextBlockId) : undefined}
              onIndent={() => {
                if (!previousSiblingId) return;
                onIndent(node.block.id, previousSiblingId);
              }}
              onOutdent={() => {
                if (!parentBlockId) return;
                onOutdent(node.block.id, parentParentBlockId);
              }}
              onDeleteEmpty={() => onDelete(node.block.id)}
            />
          </div>
        </div>
      </article>

      {node.children.length > 0 ? (
        <div className="ml-2 space-y-0 border-l border-border/55 pl-2">
          {node.children.map((child, index) => (
            <BlockNodeView
              key={child.block.id}
              node={child}
              depth={depth + 1}
              previousSiblingId={index > 0 ? node.children[index - 1].block.id : null}
              parentBlockId={node.block.id}
              parentParentBlockId={node.block.parent_block_id}
              focusedBlockId={focusedBlockId}
              focusPlacement={focusPlacement}
              previousBlockIdById={previousBlockIdById}
              nextBlockIdById={nextBlockIdById}
              onFocusApplied={onFocusApplied}
              onFocusBlock={onFocusBlock}
              notePageTitles={notePageTitles}
              onOpenPageReference={onOpenPageReference}
              onCreateSibling={onCreateSibling}
              onCreateSiblings={onCreateSiblings}
              onCommitContent={onCommitContent}
              onMergeWithPrevious={onMergeWithPrevious}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDelete={onDelete}
              onDeleteRange={onDeleteRange}
              onUpdateContent={onUpdateContent}
              onToggleMarkdownMode={onToggleMarkdownMode}
              markdownToggleVersions={markdownToggleVersions}
              selectedBlockIds={selectedBlockIds}
              onSelectUp={onSelectUp}
              onSelectDown={onSelectDown}
              onClearSelection={onClearSelection}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NotesBlockTree({
  blocks,
  onCreateFirstBlock,
  focusedBlockId,
  focusPlacement,
  onFocusApplied,
  onFocusBlock,
  notePageTitles,
  onOpenPageReference,
  onCreateSibling,
  onCreateEmptySibling,
  onCreateSiblings,
  onMergeWithPrevious,
  onCommitContent,
  onIndent,
  onOutdent,
  onDelete,
  onDeleteRange,
  onUpdateContent,
}: {
  blocks: NoteBlockRow[];
  onCreateFirstBlock: () => void;
  focusedBlockId?: string | null;
  focusPlacement?: number | "start" | "end";
  onFocusApplied?: () => void;
  onFocusBlock: (blockId: string, placement: "start" | "end") => void;
  notePageTitles: string[];
  onOpenPageReference?: (title: string) => void;
  onCreateSibling: (
    blockId: string,
    parentBlockId: string | null | undefined,
    nextContent: JsonValue,
    nextSiblingContent?: JsonValue,
    options?: {
      focusPlacement?: "start" | "end";
      focusTarget?: "created" | "current";
      insertionSide?: "before" | "after";
    }
  ) => void;
  onCreateEmptySibling: (blockId: string, parentBlockId: string | null | undefined) => void;
  onCreateSiblings?: (blockId: string, parentBlockId: string | null | undefined, nextContent: NoteBlockInsert, nextSiblingContents: NoteBlockInsert[]) => Promise<void> | void;
  onMergeWithPrevious: (blockId: string, previousBlockId: string, nextContent: JsonValue, options?: { hasChildren?: boolean }) => void | Promise<void>;
  onCommitContent: (blockId: string, nextContent: JsonValue) => void;
  onIndent: (blockId: string, nextParentBlockId: string) => void;
  onOutdent: (blockId: string, nextParentBlockId?: string | null) => void;
  onDelete: (blockId: string) => void;
  onDeleteRange: (blockIds: string[]) => void | Promise<void>;
  onUpdateContent: (blockId: string, nextContent: JsonValue) => void;
}) {
  const [markdownToggleVersions, setMarkdownToggleVersions] = useState<Record<string, number>>({});
  const [blockRangeSelection, setBlockRangeSelection] = useState<{ anchorBlockId: string; focusBlockId: string } | null>(null);
  const tree = buildNoteBlockTree(blocks);
  const { orderedBlockIds, previousBlockIdById, nextBlockIdById } = createVisibleNoteBlockNeighbors(blocks);
  const lastRootBlock = tree[tree.length - 1]?.block ?? null;
  const selectedBlockIds = useMemo(() => {
    if (!blockRangeSelection) {
      return [];
    }

    return getSelectedBlockIds(orderedBlockIds, blockRangeSelection.anchorBlockId, blockRangeSelection.focusBlockId);
  }, [blockRangeSelection, orderedBlockIds]);
  const selectedBlockIdSet = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);

  const handleToggleMarkdownMode = (blockId: string) => {
    setMarkdownToggleVersions((current) => ({
      ...current,
      [blockId]: (current[blockId] ?? 0) + 1,
    }));
    setBlockRangeSelection(null);
    onFocusBlock(blockId, "end");
  };

  const handleCopySelectedBlocks = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectedBlockIds.length === 0 || !event.clipboardData) {
      return;
    }

    const clipboardBlocks = buildBlockClipboardBlocks(blocks, selectedBlockIds);
    if (clipboardBlocks.length === 0) {
      return;
    }

    const markdown = serializeBlockClipboardMarkdown(clipboardBlocks);
    event.preventDefault();
    event.clipboardData.setData(NOTES_BLOCK_CLIPBOARD_MIME, serializeBlockClipboardData(clipboardBlocks));
    event.clipboardData.setData("text/plain", markdown);
    event.clipboardData.setData("text/markdown", markdown);
  };

  const handleCutSelectedBlocks = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectedBlockIds.length === 0 || !event.clipboardData) {
      return;
    }

    const clipboardBlocks = buildBlockClipboardBlocks(blocks, selectedBlockIds);
    if (clipboardBlocks.length === 0) {
      return;
    }

    const markdown = serializeBlockClipboardMarkdown(clipboardBlocks);
    event.preventDefault();
    event.clipboardData.setData(NOTES_BLOCK_CLIPBOARD_MIME, serializeBlockClipboardData(clipboardBlocks));
    event.clipboardData.setData("text/plain", markdown);
    event.clipboardData.setData("text/markdown", markdown);
    void onDeleteRange(selectedBlockIds);
    setBlockRangeSelection(null);
  };

  const handleSelectUp = (blockId: string, previousBlockId: string) => {
    setBlockRangeSelection((currentSelection) => (
      currentSelection && currentSelection.focusBlockId === blockId
        ? { ...currentSelection, focusBlockId: previousBlockId }
        : { anchorBlockId: blockId, focusBlockId: previousBlockId }
    ));
    onFocusBlock(previousBlockId, "end");
  };

  const handleSelectDown = (blockId: string, nextBlockId: string) => {
    setBlockRangeSelection((currentSelection) => (
      currentSelection && currentSelection.focusBlockId === blockId
        ? { ...currentSelection, focusBlockId: nextBlockId }
        : { anchorBlockId: blockId, focusBlockId: nextBlockId }
    ));
    onFocusBlock(nextBlockId, "start");
  };

  const handleFocusBlock = (blockId: string, placement: "start" | "end") => {
    setBlockRangeSelection(null);
    onFocusBlock(blockId, placement);
  };

  if (tree.length === 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        onMouseDown={(event) => {
          event.preventDefault();
          onCreateFirstBlock();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onCreateFirstBlock();
        }}
        className="cursor-text outline-none"
      >
        <div className="flex min-h-6 items-center gap-px px-0 py-0 text-sm text-muted-foreground">
          <div className="w-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">Empty page</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 transition-smooth" onCopy={handleCopySelectedBlocks} onCut={handleCutSelectedBlocks}>
      {tree.map((node, index) => (
        <BlockNodeView
          key={node.block.id}
          node={node}
          previousSiblingId={index > 0 ? tree[index - 1].block.id : null}
          parentBlockId={null}
          parentParentBlockId={null}
          focusedBlockId={focusedBlockId}
          focusPlacement={focusPlacement}
          previousBlockIdById={previousBlockIdById}
          nextBlockIdById={nextBlockIdById}
          onFocusApplied={onFocusApplied}
          onFocusBlock={handleFocusBlock}
          notePageTitles={notePageTitles}
          onOpenPageReference={onOpenPageReference}
          onCreateSibling={onCreateSibling}
            onCreateSiblings={onCreateSiblings}
          onMergeWithPrevious={onMergeWithPrevious}
          onCommitContent={onCommitContent}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onDelete={onDelete}
          onDeleteRange={onDeleteRange}
          onUpdateContent={onUpdateContent}
          onToggleMarkdownMode={handleToggleMarkdownMode}
          markdownToggleVersions={markdownToggleVersions}
          selectedBlockIds={selectedBlockIdSet}
          onSelectUp={handleSelectUp}
          onSelectDown={handleSelectDown}
          onClearSelection={() => setBlockRangeSelection(null)}
        />
      ))}

      {lastRootBlock ? (
        <div className="group mt-2 px-0 py-1">
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => onCreateEmptySibling(lastRootBlock.id, null)}
            className="flex min-h-6 w-full items-center gap-px rounded-sm px-0 py-0 text-xs text-muted-foreground/80 opacity-0 outline-none transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:text-foreground"
            aria-label="Add block below"
          >
            <div className="flex w-3.5 shrink-0 items-center justify-start" aria-hidden="true">
              <Plus className="h-2.5 w-2.5" />
            </div>
            <div className="min-w-0 flex-1 text-left leading-5">Add block</div>
          </button>
        </div>
      ) : null}
    </div>
  );
}