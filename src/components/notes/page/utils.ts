"use client";

import { useEffect, useRef, useState } from "react";

import type { Tag } from "@/lib/powersync/AppSchema";
import { parseSerializedRecord } from "@/lib/notes/notes-content";
import type { JsonValue } from "@/lib/notes/notes";
import { formatRelativeTime } from "@/lib/shared/utils";
import { TAG_COLORS } from "@/lib/tasks/colors";

import type { NoteTag, OutlineEntry } from "./types";

type RichContentNode = {
  type?: string;
  text?: string;
  attrs?: {
    level?: number;
  };
  content?: RichContentNode[];
};

export function formatTimestampLabel(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    relative: formatRelativeTime(date),
    dateOnly: date.toLocaleDateString([], { dateStyle: "medium" }),
    absolute: date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
  };
}

function extractTextFromRichContent(node: RichContentNode | null | undefined): string {
  if (!node) return "";

  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = Array.isArray(node.content)
    ? node.content.map((child) => extractTextFromRichContent(child)).join("")
    : "";

  return `${ownText}${childText}`;
}

function collectOutlineHeadings(node: RichContentNode | null | undefined, headings: Array<{ level: number; text: string }>) {
  if (!node) return;

  if (node.type === "heading") {
    const text = extractTextFromRichContent(node).trim();
    if (text) {
      headings.push({
        level: typeof node.attrs?.level === "number" ? node.attrs.level : 1,
        text,
      });
    }
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((child) => collectOutlineHeadings(child, headings));
  }
}

export function extractOutlineEntries(blockId: string, rawContent: string | null | undefined): OutlineEntry[] {
  if (!rawContent) return [];

  try {
    const parsed = JSON.parse(rawContent) as RichContentNode;
    const headings: Array<{ level: number; text: string }> = [];
    collectOutlineHeadings(parsed, headings);

    return headings.map((heading) => ({
      blockId,
      level: Math.min(Math.max(heading.level, 1), 3),
      text: heading.text,
    }));
  } catch {
    return [];
  }
}

export function attachmentLabel(filePath: string | null | undefined) {
  if (!filePath) return "Attachment";

  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? filePath;
}

export function useSmoothedLoading(
  isLoading: boolean,
  loadingKey: string,
  minVisibleMs = 160,
  settleDelayMs = 80
) {
  const [showLoading, setShowLoading] = useState(true);
  const visibleSinceRef = useRef<number>(Date.now());

  useEffect(() => {
    visibleSinceRef.current = Date.now();
    setShowLoading(true);
  }, [loadingKey]);

  useEffect(() => {
    if (isLoading) {
      if (!showLoading) {
        visibleSinceRef.current = Date.now();
        setShowLoading(true);
      }
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const timeoutId = window.setTimeout(() => {
      setShowLoading(false);
    }, Math.max(minVisibleMs - elapsed, 0) + settleDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, minVisibleMs, settleDelayMs, showLoading]);

  return showLoading;
}

export function createBlockDocument(text = ""): JsonValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text.trim().length > 0 ? [{ type: "text", text }] : [],
      },
    ],
  };
}

export function parseProperties(raw: unknown) {
  return parseSerializedRecord(raw) ?? {};
}

export function parseStoredTagIds(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenIds = new Set<string>();

  return raw.flatMap((value) => {
    if (typeof value !== "string") {
      return [];
    }

    const trimmedValue = value.trim();
    if (!trimmedValue || seenIds.has(trimmedValue)) {
      return [];
    }

    seenIds.add(trimmedValue);
    return [trimmedValue];
  });
}

export function resolveNoteTags(tagIds: string[], availableTags: Tag[]): NoteTag[] {
  const tagsById = new Map(availableTags.map((tag) => [tag.id, tag]));

  return tagIds.flatMap((tagId) => {
    const tag = tagsById.get(tagId);
    if (!tag) {
      return [];
    }

    return [{
      id: tag.id,
      key: tag.id,
      name: tag.name?.trim() || "Tag",
      color: tag.color || "slate",
    }];
  });
}

export function getDeterministicTagColor(tag: string | null | undefined) {
  const normalizedTag = (tag ?? "").trim().toLocaleLowerCase();
  if (!normalizedTag) {
    return null;
  }

  let hash = 0;
  for (const character of normalizedTag) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return TAG_COLORS[hash % TAG_COLORS.length] ?? null;
}

export function normalizePageEmoji(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}