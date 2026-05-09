import { LexoRank } from "lexorank";
import { v4 as uuidv4 } from "uuid";

import { extractNoteText, serializeNoteDocument } from "@/lib/notes/notes-content";
import { db } from "@/lib/powersync/db";
import { getCurrentUserId } from "@/lib/shared/auth";
import { debouncedExecute, debouncedUpdate } from "@/lib/shared/debounced-update";

const NOTES_DEBOUNCE_MS = 10_000;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface CreatePageInput {
  id?: string;
  title?: string;
  properties?: Record<string, JsonValue>;
}

interface CreateBlockInput {
  id?: string;
  pageId: string;
  parentBlockId?: string | null;
  type?: string;
  content?: JsonValue;
  sortRank: string;
}

interface UpdateBlockInput {
  blockId: string;
  pageId?: string;
  content?: JsonValue;
  type?: string;
}

interface MoveBlockInput {
  blockId: string;
  pageId?: string;
  parentBlockId?: string | null;
  sortRank: string;
}

interface UpsertAttachmentInput {
  id?: string;
  filePath: string;
  syncState?: string;
  pageId?: string | null;
  blockId?: string | null;
}

interface ReplaceEdgesInput {
  sourceBlockId: string;
  edges: Array<{
    targetId: string;
    type: string;
  }>;
}

type PageLookupRow = {
  id: string;
  title: string | null;
};

function toJson(value: JsonValue | undefined) {
  return JSON.stringify(value ?? {});
}

function toNullableOwner(ownerId?: string | null) {
  return ownerId ?? null;
}

function normalizeReferenceToken(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractPlainText(value: JsonValue | undefined) {
  if (value === undefined) return "";

  return extractNoteText(value);
}

function touchNotePage(pageId: string | null | undefined) {
  if (!pageId) return;

  debouncedExecute(
    "UPDATE pages SET updated_at = datetime('now') WHERE id = ?",
    [pageId],
    `notes:page-touch:${pageId}`,
    NOTES_DEBOUNCE_MS
  );
}

function parseReferenceTokens(text: string) {
  const pageTitles = new Set<string>();
  const tags = new Set<string>();

  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const normalized = normalizeReferenceToken(match[1] ?? "");
    if (normalized) {
      pageTitles.add(normalized);
    }
  }

  for (const match of text.matchAll(/(^|[\s(])#([a-z0-9][a-z0-9_/-]*)/gi)) {
    const normalized = normalizeReferenceToken(match[2] ?? "");
    if (normalized) {
      tags.add(normalized);
    }
  }

  return {
    pageTitles: [...pageTitles],
    tags: [...tags],
  };
}

async function reconcileNoteBlockEdges(blockId: string, content: JsonValue | undefined) {
  const text = extractPlainText(content);
  const references = parseReferenceTokens(text);

  const pageRows = references.pageTitles.length > 0
    ? await db.getAll<PageLookupRow>("SELECT id, title FROM pages")
    : [];

  const pageIdByTitle = new Map<string, string>();
  for (const row of pageRows) {
    const normalizedTitle = normalizeReferenceToken(row.title ?? "");
    if (normalizedTitle && !pageIdByTitle.has(normalizedTitle)) {
      pageIdByTitle.set(normalizedTitle, row.id);
    }
  }

  const edges = [
    ...references.pageTitles.flatMap((title) => {
      const targetId = pageIdByTitle.get(title);
      return targetId ? [{ targetId, type: "page_ref" }] : [];
    }),
    ...references.tags.map((tag) => ({
      targetId: `tag:${tag}`,
      type: "tag_ref",
    })),
  ];

  await replaceNoteEdges({
    sourceBlockId: blockId,
    edges,
  });
}

export async function createNotePage(input: CreatePageInput = {}) {
  const pageId = input.id ?? uuidv4();
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO pages (id, user_id, title, properties, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [pageId, userId, input.title?.trim() || "Untitled", toJson(input.properties), now, now]
  );

  return pageId;
}

export function updateNotePageTitle(pageId: string, title: string) {
  debouncedUpdate(pageId, "title", title, "pages", NOTES_DEBOUNCE_MS);
}

export function updateNotePageProperties(pageId: string, properties: Record<string, JsonValue>) {
  debouncedUpdate(pageId, "properties", JSON.stringify(properties), "pages", NOTES_DEBOUNCE_MS);
}

export async function deleteNotePage(pageId: string) {
  await db.execute(`DELETE FROM attachments WHERE block_id IN (SELECT id FROM blocks WHERE page_id = ?)`, [pageId]);
  await db.execute(`DELETE FROM attachments WHERE page_id = ?`, [pageId]);
  await db.execute(`DELETE FROM edges WHERE source_block_id IN (SELECT id FROM blocks WHERE page_id = ?)`, [pageId]);
  await db.execute(`DELETE FROM edges WHERE target_id = ? AND type = 'page_ref'`, [pageId]);
  await db.execute(`DELETE FROM blocks WHERE page_id = ?`, [pageId]);
  await db.execute(`DELETE FROM pages WHERE id = ?`, [pageId]);
}

export async function createNoteBlock(input: CreateBlockInput) {
  const blockId = input.id ?? uuidv4();
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO blocks (id, user_id, page_id, parent_block_id, type, content, sort_rank, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      blockId,
      userId,
      input.pageId,
      toNullableOwner(input.parentBlockId),
      input.type ?? "text",
      serializeNoteDocument(input.content),
      input.sortRank,
      now,
    ]
  );

  await reconcileNoteBlockEdges(blockId, input.content);
  touchNotePage(input.pageId);

  return blockId;
}

export function updateNoteBlock(input: UpdateBlockInput) {
  if (input.type !== undefined) {
    debouncedUpdate(input.blockId, "type", input.type, "blocks", NOTES_DEBOUNCE_MS);
  }

  if (input.content !== undefined) {
    debouncedUpdate(input.blockId, "content", serializeNoteDocument(input.content), "blocks", NOTES_DEBOUNCE_MS);
    void reconcileNoteBlockEdges(input.blockId, input.content);
  }

  touchNotePage(input.pageId);
}

export function moveNoteBlock(input: MoveBlockInput) {
  debouncedUpdate(input.blockId, "parent_block_id", toNullableOwner(input.parentBlockId), "blocks", NOTES_DEBOUNCE_MS);
  debouncedUpdate(input.blockId, "sort_rank", input.sortRank, "blocks", NOTES_DEBOUNCE_MS);
  touchNotePage(input.pageId);
}

export async function deleteNoteBlock(blockId: string, pageId?: string) {
  await db.execute(`DELETE FROM edges WHERE source_block_id = ?`, [blockId]);
  await db.execute(`DELETE FROM blocks WHERE id = ?`, [blockId]);
  touchNotePage(pageId);
}

export async function upsertAttachment(input: UpsertAttachmentInput) {
  const attachmentId = input.id ?? uuidv4();
  const userId = await getCurrentUserId();

  await db.execute(
    `INSERT INTO attachments (id, user_id, page_id, block_id, file_path, sync_state)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       page_id = excluded.page_id,
       block_id = excluded.block_id,
       file_path = excluded.file_path,
       sync_state = excluded.sync_state`,
    [
      attachmentId,
      userId,
      toNullableOwner(input.pageId),
      toNullableOwner(input.blockId),
      input.filePath,
      input.syncState ?? "pending",
    ]
  );

  return attachmentId;
}

export async function deleteAttachment(attachmentId: string) {
  await db.execute(`DELETE FROM attachments WHERE id = ?`, [attachmentId]);
}

export async function replaceNoteEdges(input: ReplaceEdgesInput) {
  const userId = await getCurrentUserId();

  await db.execute(`DELETE FROM edges WHERE source_block_id = ?`, [input.sourceBlockId]);

  for (const edge of input.edges) {
    await db.execute(
      `INSERT INTO edges (source_block_id, target_id, user_id, type) VALUES (?, ?, ?, ?)`,
      [input.sourceBlockId, edge.targetId, userId, edge.type]
    );
  }
}

export async function createStarterPage(title = "Untitled") {
  const pageId = await createNotePage({ title });
  await createNoteBlock({
    pageId,
    sortRank: LexoRank.middle().format(),
    type: "text",
    content: { type: "doc", content: [] },
  });
  return pageId;
}