"use client";

import { NoteBlockEditor } from "@/components/notes/NoteBlockEditor";
import type { NoteBlockRow } from "@/hooks/use-notes";
import { extractNoteText } from "@/lib/notes/notes-content";
import { buildNoteBlockTree, createVisibleNoteBlockNeighbors, type NoteTreeNode } from "@/lib/notes/notes-tree";
import type { JsonValue } from "@/lib/notes/notes";

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
  onCreateSibling,
  onCommitContent,
  onIndent,
  onOutdent,
  onDelete,
  onUpdateContent,
}: {
  node: BlockTreeNode;
  depth?: number;
  previousSiblingId?: string | null;
  parentBlockId?: string | null;
  parentParentBlockId?: string | null;
  focusedBlockId?: string | null;
  focusPlacement?: "start" | "end";
  previousBlockIdById: ReadonlyMap<string, string | null>;
  nextBlockIdById: ReadonlyMap<string, string | null>;
  onFocusApplied?: () => void;
  onFocusBlock: (blockId: string, placement: "start" | "end") => void;
  onCreateSibling: (blockId: string, parentBlockId: string | null | undefined, nextContent: JsonValue, nextSiblingContent?: JsonValue) => void;
  onCommitContent: (blockId: string, nextContent: JsonValue) => void;
  onIndent: (blockId: string, nextParentBlockId: string) => void;
  onOutdent: (blockId: string, nextParentBlockId?: string | null) => void;
  onDelete: (blockId: string) => void;
  onUpdateContent: (blockId: string, nextContent: JsonValue) => void;
}) {
  const previousBlockId = previousBlockIdById.get(node.block.id) ?? null;
  const nextBlockId = nextBlockIdById.get(node.block.id) ?? null;

  return (
    <div className="space-y-0">
      <article
        className="group relative animate-fade-slide-in"
        style={{ marginLeft: depth === 0 ? 0 : depth * 18 }}
      >
        <div className="flex items-center gap-2 px-1 py-0">
          <div className="relative flex min-h-6 w-5 shrink-0 items-center justify-center self-stretch">
            <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
            {depth > 0 ? <span className="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-border/60" /> : null}
          </div>
          <div className="min-w-0 flex-1 transition-smooth">
            <NoteBlockEditor
              content={node.block.content}
              shouldFocus={focusedBlockId === node.block.id}
              focusPlacement={focusPlacement}
              onFocusApplied={onFocusApplied}
              onChange={(nextContent) => {
                onUpdateContent(node.block.id, nextContent as JsonValue);
              }}
              onCommit={(nextContent) => {
                onCommitContent(node.block.id, nextContent as JsonValue);
              }}
              onCreateSibling={(nextContent, nextSiblingContent) => onCreateSibling(node.block.id, parentBlockId, nextContent as JsonValue, nextSiblingContent as JsonValue | undefined)}
              onNavigateUp={previousBlockId ? () => onFocusBlock(previousBlockId, "end") : undefined}
              onNavigateDown={nextBlockId ? () => onFocusBlock(nextBlockId, "start") : undefined}
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
        <div className="ml-3 space-y-0 border-l border-border/55 pl-3">
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
              onCreateSibling={onCreateSibling}
              onCommitContent={onCommitContent}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onDelete={onDelete}
              onUpdateContent={onUpdateContent}
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
  onCreateSibling,
  onCommitContent,
  onIndent,
  onOutdent,
  onDelete,
  onUpdateContent,
}: {
  blocks: NoteBlockRow[];
  onCreateFirstBlock: () => void;
  focusedBlockId?: string | null;
  focusPlacement?: "start" | "end";
  onFocusApplied?: () => void;
  onFocusBlock: (blockId: string, placement: "start" | "end") => void;
  onCreateSibling: (blockId: string, parentBlockId: string | null | undefined, nextContent: JsonValue, nextSiblingContent?: JsonValue) => void;
  onCommitContent: (blockId: string, nextContent: JsonValue) => void;
  onIndent: (blockId: string, nextParentBlockId: string) => void;
  onOutdent: (blockId: string, nextParentBlockId?: string | null) => void;
  onDelete: (blockId: string) => void;
  onUpdateContent: (blockId: string, nextContent: JsonValue) => void;
}) {
  const tree = buildNoteBlockTree(blocks);
  const { previousBlockIdById, nextBlockIdById } = createVisibleNoteBlockNeighbors(blocks);

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
        <div className="flex min-h-6 items-center gap-2 px-1 py-0 text-sm text-muted-foreground">
          <div className="w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">Empty page</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 transition-smooth">
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
          onFocusBlock={onFocusBlock}
          onCreateSibling={onCreateSibling}
          onCommitContent={onCommitContent}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onDelete={onDelete}
          onUpdateContent={onUpdateContent}
        />
      ))}
    </div>
  );
}