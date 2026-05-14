import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";

import type { NoteBlockInsert } from "@/lib/notes/notes";

export type StructuredMarkdownListItem = {
  text: string;
  children: StructuredMarkdownListItem[];
};

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  checked?: boolean | null;
};

function normalizeMarkdownText(markdown: string) {
  return markdown
    .replace(/\\\[\\\[/g, "[[")
    .replace(/\\\]\\\]/g, "]]")
    .replace(/(^|[\s(])\\#([a-z0-9][a-z0-9_/-]*)/gi, "$1#$2");
}

function isListNode(node: MarkdownNode | undefined): node is MarkdownNode & { children: MarkdownNode[] } {
  return node?.type === "list" && Array.isArray(node.children);
}

function isListItemNode(node: MarkdownNode | undefined): node is MarkdownNode & { children: MarkdownNode[] } {
  return node?.type === "listItem" && Array.isArray(node.children);
}

function isThematicBreakNode(node: MarkdownNode | undefined) {
  return node?.type === "thematicBreak";
}

function renderMarkdownNodes(nodes: MarkdownNode[]) {
  if (nodes.length === 0) {
    return "";
  }

  if (nodes.length === 1 && isThematicBreakNode(nodes[0])) {
    return "---";
  }

  return normalizeMarkdownText(
    toMarkdown(
      {
        type: "root",
        children: nodes,
      } as never,
      {
        extensions: [gfmToMarkdown()],
      }
    ).trim()
  );
}

function parseMarkdownListAst(text: string): StructuredMarkdownListItem[] | null {
  const root = fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MarkdownNode & { children?: MarkdownNode[] };

  const nodes = Array.isArray(root.children) ? root.children : [];
  if (nodes.length === 0) {
    return null;
  }

  if (!nodes.every((node) => isListNode(node) || isThematicBreakNode(node))) {
    return null;
  }

  const toStructuredItem = (node: MarkdownNode): StructuredMarkdownListItem[] => {
    if (isThematicBreakNode(node)) {
      return [{ text: "---", children: [] }];
    }

    if (!isListNode(node)) {
      return [];
    }

    return node.children.filter(isListItemNode).map((item) => {
      const contentNodes = item.children.filter((child) => !isListNode(child));
      const nestedChildren = item.children.filter(isListNode).flatMap(toStructuredItem);
      const serializedText = renderMarkdownNodes(contentNodes);
      const text = typeof item.checked === "boolean"
        ? `[${item.checked ? "x" : " "}] ${serializedText}`.trimEnd()
        : serializedText;

      return {
        text,
        children: nestedChildren,
      };
    });
  };

  const roots: StructuredMarkdownListItem[] = [];

  for (const node of nodes) {
    if (isThematicBreakNode(node)) {
      const lastRoot = roots[roots.length - 1];
      if (lastRoot && lastRoot.text.length === 0 && lastRoot.children.length === 0) {
        roots.pop();
      }
    }

    roots.push(...toStructuredItem(node));
  }

  return roots;
}

export function parseStructuredMarkdownList(text: string): StructuredMarkdownListItem[] | null {
  return parseMarkdownListAst(text);
}

export function markdownListItemsToBlocks(
  items: StructuredMarkdownListItem[],
  parseContent: (text: string) => NoteBlockInsert["content"]
): NoteBlockInsert[] {
  return items.map(function toBlock(item): NoteBlockInsert {
    return {
      content: parseContent(item.text),
      children: markdownListItemsToBlocks(item.children, parseContent),
    };
  });
}

export function parseMarkdownListBlocks(
  text: string,
  parseContent: (text: string) => NoteBlockInsert["content"]
): NoteBlockInsert[] | null {
  const items = parseStructuredMarkdownList(text);
  return items ? markdownListItemsToBlocks(items, parseContent) : null;
}