"use client";

import { useQuery } from "@powersync/react";

import type { BlockRecord, PageRecord } from "@/lib/powersync/AppSchema";

export type NotePageRow = PageRecord & { id: string };
export type NoteBlockRow = BlockRecord & { id: string };

const EMPTY_PAGE_QUERY = "SELECT id, user_id, title, properties, created_at, updated_at FROM pages WHERE 1 = 0";
const EMPTY_BLOCKS_QUERY = "SELECT id, user_id, page_id, parent_block_id, type, content, sort_rank, updated_at FROM blocks WHERE 1 = 0";

export function useNotePage(pageId?: string | null) {
  const query = pageId
    ? "SELECT id, user_id, title, properties, created_at, updated_at FROM pages WHERE id = ? LIMIT 1"
    : EMPTY_PAGE_QUERY;
  const args = pageId ? [pageId] : [];
  const { data = [], isLoading } = useQuery<NotePageRow>(query, args);

  return {
    page: data[0] ?? null,
    isLoading
  };
}

export function useNoteBlocks(pageId?: string | null) {
  const query = pageId
    ? [
        "SELECT id, user_id, page_id, parent_block_id, type, content, sort_rank",
        "updated_at",
        "FROM blocks",
        "WHERE page_id = ?",
        "ORDER BY sort_rank ASC"
      ].join(" ")
    : EMPTY_BLOCKS_QUERY;
  const args = pageId ? [pageId] : [];
  const { data = [], isLoading } = useQuery<NoteBlockRow>(query, args);

  return {
    blocks: data,
    isLoading
  };
}

export function useNotePageWithBlocks(pageId?: string | null) {
  const pageState = useNotePage(pageId);
  const blocksState = useNoteBlocks(pageId);

  return {
    page: pageState.page,
    blocks: blocksState.blocks,
    isLoading: pageState.isLoading || blocksState.isLoading
  };
}