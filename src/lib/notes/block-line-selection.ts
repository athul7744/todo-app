import type { NoteBlockInsert } from "@/lib/notes/notes";
import { normalizeNoteDocument, serializeNoteDocumentToMarkdown } from "@/lib/notes/notes-content";

export const NOTES_BLOCK_CLIPBOARD_MIME = "application/x-dash-notes-blocks";

type BlockLike = {
  id: string;
  parent_block_id: string | null;
  content: unknown;
};

export function getSelectedBlockIds(
  orderedVisibleBlockIds: string[],
  anchorBlockId: string,
  focusBlockId: string,
) {
  const anchorIndex = orderedVisibleBlockIds.indexOf(anchorBlockId);
  const focusIndex = orderedVisibleBlockIds.indexOf(focusBlockId);

  if (anchorIndex === -1 || focusIndex === -1) {
    return [];
  }

  const startIndex = Math.min(anchorIndex, focusIndex);
  const endIndex = Math.max(anchorIndex, focusIndex);
  return orderedVisibleBlockIds.slice(startIndex, endIndex + 1);
}

function toClipboardBlock<TBlock extends BlockLike>(
  blockId: string,
  selectedBlockIds: Set<string>,
  blockMap: ReadonlyMap<string, TBlock>,
  childIdsByParentId: ReadonlyMap<string | null, string[]>,
): NoteBlockInsert {
  const block = blockMap.get(blockId);
  if (!block) {
    return {
      content: normalizeNoteDocument(null) as NoteBlockInsert["content"],
      children: [],
    };
  }

  const childIds = (childIdsByParentId.get(blockId) ?? []).filter((childId) => selectedBlockIds.has(childId));

  return {
    content: normalizeNoteDocument(block.content) as NoteBlockInsert["content"],
    children: childIds.map((childId) => toClipboardBlock(childId, selectedBlockIds, blockMap, childIdsByParentId)),
  };
}

function renderClipboardBlockMarkdown(block: NoteBlockInsert, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  const markdown = serializeNoteDocumentToMarkdown(block.content).trim();
  const lines = markdown.length > 0 ? markdown.split(/\r?\n/) : [""];
  const [firstLine, ...restLines] = lines;
  const renderedLines = [`${indent}- ${firstLine}`.trimEnd()];

  restLines.forEach((line) => {
    renderedLines.push(`${indent}  ${line}`.trimEnd());
  });

  (block.children ?? []).forEach((child) => {
    renderedLines.push(...renderClipboardBlockMarkdown(child, depth + 1));
  });

  return renderedLines;
}

export function buildBlockClipboardBlocks<TBlock extends BlockLike>(
  blocks: TBlock[],
  selectedIds: string[],
): NoteBlockInsert[] {
  if (selectedIds.length === 0) {
    return [];
  }

  const selectedBlockIds = new Set(selectedIds);
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const childIdsByParentId = new Map<string | null, string[]>();

  blocks.forEach((block) => {
    const children = childIdsByParentId.get(block.parent_block_id) ?? [];
    children.push(block.id);
    childIdsByParentId.set(block.parent_block_id, children);
  });

  const rootIds = selectedIds.filter((blockId) => {
    const block = blockMap.get(blockId);
    return block ? !selectedBlockIds.has(block.parent_block_id ?? "") : false;
  });

  return rootIds.map((blockId) => toClipboardBlock(blockId, selectedBlockIds, blockMap, childIdsByParentId));
}

export function serializeBlockClipboardData(blocks: NoteBlockInsert[]) {
  return JSON.stringify(blocks);
}

export function parseBlockClipboardData(raw: string): NoteBlockInsert[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map((block) => ({
      content: normalizeNoteDocument((block as NoteBlockInsert)?.content) as NoteBlockInsert["content"],
      children: parseBlockClipboardData(JSON.stringify((block as NoteBlockInsert)?.children ?? [])) ?? [],
    }));
  } catch {
    return null;
  }
}

export function serializeBlockClipboardMarkdown(blocks: NoteBlockInsert[]) {
  return blocks.flatMap((block) => renderClipboardBlockMarkdown(block)).join("\n").trim();
}