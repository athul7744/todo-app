import type { JSONContent } from "@tiptap/core";

import { parseMarkdownListBlocks } from "@/lib/notes/markdown-clipboard";
import type { NoteBlockInsert } from "@/lib/notes/notes";
import { normalizeNoteDocument } from "@/lib/notes/notes-content";

type ParseClipboardMarkdownOptions = {
  renderMarkdown: (text: string) => string;
  parseHtmlDocument: (html: string) => JSONContent | null;
  createScaffoldDocument: (text: string) => JSONContent;
};

function isSingleParagraphDocument(document: JSONContent | null | undefined) {
  if (!document || document.type !== "doc" || !Array.isArray(document.content) || document.content.length !== 1) {
    return false;
  }

  return document.content[0]?.type === "paragraph";
}

function isListContainerNode(node: JSONContent | null | undefined) {
  return node?.type === "bulletList" || node?.type === "orderedList" || node?.type === "taskList";
}

function isListItemNode(node: JSONContent | null | undefined) {
  return node?.type === "listItem" || node?.type === "taskItem";
}

function createClipboardBlock(contentNodes: JSONContent[], children: NoteBlockInsert[] = []): NoteBlockInsert {
  return {
    content: normalizeNoteDocument({
      type: "doc",
      content: contentNodes.length > 0 ? contentNodes : [{ type: "paragraph" }],
    }) as NoteBlockInsert["content"],
    children,
  };
}

function parseListNodeToClipboardBlocks(node: JSONContent): NoteBlockInsert[] {
  const children = Array.isArray(node.content) ? node.content : [];

  return children.flatMap((child) => {
    if (isListItemNode(child)) {
      const itemChildren = Array.isArray(child.content) ? child.content : [];
      const contentNodes: JSONContent[] = [];
      const nestedChildren: NoteBlockInsert[] = [];

      itemChildren.forEach((itemChild) => {
        if (isListContainerNode(itemChild)) {
          nestedChildren.push(...parseListNodeToClipboardBlocks(itemChild));
          return;
        }

        contentNodes.push(itemChild);
      });

      return [createClipboardBlock(contentNodes, nestedChildren)];
    }

    if (isListContainerNode(child)) {
      return parseListNodeToClipboardBlocks(child);
    }

    return [createClipboardBlock([child])];
  });
}

function blocksFromDocument(document: JSONContent): NoteBlockInsert[] {
  const nodes = Array.isArray(document.content) ? document.content : [];

  return nodes.flatMap((node) => {
    if (isListContainerNode(node)) {
      return parseListNodeToClipboardBlocks(node);
    }

    return [createClipboardBlock([node])];
  });
}

export function shouldPreserveMarkdownStructure(text: string) {
  if (!text.includes("\n")) {
    return false;
  }

  return /(^|\n)\s*[-*+]\s/.test(text)
    || /(^|\n)\s*\d+\.\s/.test(text)
    || /(^|\n)(?:\t| {2,})[-*+]\s/.test(text)
    || /(^|\n)\s*>\s/.test(text)
    || /(^|\n)\s*#{1,6}\s/.test(text);
}

export function parseClipboardMarkdown(
  text: string,
  options: ParseClipboardMarkdownOptions,
): NoteBlockInsert[] {
  const normalizedText = text.trimEnd();

  if (normalizedText.trim().length === 0) {
    return [];
  }

  const parseBlockContent = (itemText: string): NoteBlockInsert["content"] => {
    if (itemText.trim().length === 0) {
      return options.createScaffoldDocument("") as NoteBlockInsert["content"];
    }

    const nextHtml = options.renderMarkdown(itemText);
    return (options.parseHtmlDocument(nextHtml) ?? options.createScaffoldDocument(itemText)) as NoteBlockInsert["content"];
  };

  if (shouldPreserveMarkdownStructure(normalizedText)) {
    const structuredListBlocks = parseMarkdownListBlocks(normalizedText, parseBlockContent);
    if (structuredListBlocks && structuredListBlocks.length > 0) {
      return structuredListBlocks;
    }

    const nextHtml = options.renderMarkdown(normalizedText);
    const nextDocument = options.parseHtmlDocument(nextHtml);
    if (nextDocument) {
      return blocksFromDocument(nextDocument);
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const nextHtml = options.renderMarkdown(line);
    return {
      content: options.parseHtmlDocument(nextHtml) ?? options.createScaffoldDocument(line),
      children: [],
    };
  });
}

export function shouldReplaceOnMarkdownPaste(blocks: NoteBlockInsert[]) {
  if (blocks.length !== 1) {
    return blocks.length > 0;
  }

  const [firstBlock] = blocks;
  if ((firstBlock.children?.length ?? 0) > 0) {
    return true;
  }

  return !isSingleParagraphDocument(firstBlock.content as JSONContent | null | undefined);
}