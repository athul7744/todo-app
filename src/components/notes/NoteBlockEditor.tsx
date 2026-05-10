"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Extension, markInputRule, markPasteRule, type Editor, type JSONContent } from "@tiptap/core";
import { Link2 } from "lucide-react";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import CodeBlock from "@tiptap/extension-code-block";
import Code from "@tiptap/extension-code";
import Document from "@tiptap/extension-document";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { DOMParser as ProseMirrorDOMParser, DOMSerializer } from "@tiptap/pm/model";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import Text from "@tiptap/extension-text";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import {
  createScaffoldDocument,
  emptyDocument,
  emptyHorizontalRuleDocument,
  emptyTaskListDocument,
  getFilteredSlashCommands,
  getGroupedSlashCommands,
  getSlashQuery,
  type SlashCommand,
} from "@/components/notes/NoteBlockEditorSlash";
import { createNoteDocumentFromText, extractNoteText, normalizeNoteDocument, serializeNoteDocumentToMarkdown } from "@/lib/notes/notes-content";
import { logger } from "@/lib/shared/logger";

const referenceDecorationsKey = new PluginKey("noteReferenceDecorations");
const markdownLinkInputRegex = /(?:^|\s)\[([^\]]+)\]\((\S+?)\)$/;
const markdownLinkPasteRegex = /(?:^|\s)\[([^\]]+)\]\((\S+?)\)/g;
const markdownImageBlockRegex = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/;
const markdownBlockHintRegex = /(^|\n)\s*(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~|\|.+\||!\[[^\]]*\]\(|\[[^\]]+\]\([^\)]+\)|-{3,}|\*\*[^*]+\*\*|_[^_]+_)/;
const markdownLinkOrImageRegex = /!\[[^\]]*\]\([^\)]+\)|\[[^\]]+\]\([^\)]+\)/;
const markdownTableSeparatorRegex = /(^|\n)\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*($|\n)/;
const markdownTaskListRegex = /(^|\n)\s*[-*+]\s\[[ xX]\]\s/;
const notePageReferenceRegex = /\[\[[^\]]+\]\]/g;
const noteInlineTagRegex = /(^|[\s(])#([a-z0-9][a-z0-9_/-]*)/gi;

const turndownService = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
});

turndownService.use(gfm);
turndownService.addRule("taskListItems", {
  filter(node: Node) {
    return node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem";
  },
  replacement(content: string, node: Node) {
    const element = node as HTMLElement;
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const isChecked = checkbox?.checked || element.getAttribute("data-checked") === "true";
    const normalizedContent = content.replace(/^\s*\[[ xX]\]\s*/, "").trim();
    return `\n- [${isChecked ? "x" : " "}] ${normalizedContent}\n`;
  },
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function protectNoteTokens(text: string) {
  const tokens: string[] = [];
  const createPlaceholder = (value: string) => {
    const index = tokens.push(value) - 1;
    return `NOTESCLIPTOK${index}END`;
  };

  const withProtectedReferences = text.replace(notePageReferenceRegex, (match) => createPlaceholder(match));
  const protectedText = withProtectedReferences.replace(noteInlineTagRegex, (_, prefix: string, tag: string) => `${prefix}${createPlaceholder(`#${tag}`)}`);

  return { protectedText, tokens };
}

function restoreProtectedTokens(value: string, tokens: string[], escape = false) {
  return value.replace(/NOTESCLIPTOK(\d+)END/g, (_, index: string) => {
    const token = tokens[Number(index)] ?? "";
    return escape ? escapeHtml(token) : token;
  });
}

function normalizeExportedMarkdownTokens(markdown: string) {
  return markdown
    .replace(/\\\[\\\[/g, "[[")
    .replace(/\\\]\\\]/g, "]]")
    .replace(/(^|[\s(])\\#([a-z0-9][a-z0-9_/-]*)/gi, "$1#$2");
}

function getMarkdownClipboardText(event: ClipboardEvent) {
  const explicitMarkdown = event.clipboardData?.getData("text/markdown")?.trim() ?? "";
  if (explicitMarkdown) {
    return explicitMarkdown;
  }

  const clipboardText = event.clipboardData?.getData("text/plain")?.trim() ?? "";
  if (!clipboardText) {
    return null;
  }

  const lineCount = clipboardText.split(/\r?\n/).length;
  const hasMarkdownLinkOrImage = markdownLinkOrImageRegex.test(clipboardText);
  const hasMarkdownTable = markdownTableSeparatorRegex.test(clipboardText);
  const hasTaskList = markdownTaskListRegex.test(clipboardText);
  const hasBlockSyntax = markdownBlockHintRegex.test(clipboardText);

  if (hasMarkdownLinkOrImage || hasMarkdownTable || hasTaskList) {
    return clipboardText;
  }

  if (lineCount > 1 && hasBlockSyntax) {
    return clipboardText;
  }

  return null;
}

function parseMarkdownClipboardText(text: string) {
  const { protectedText, tokens } = protectNoteTokens(text);
  const rendered = marked.parse(protectedText, {
    async: false,
    breaks: true,
    gfm: true,
  });

  if (typeof rendered !== "string") {
    return "";
  }

  return restoreProtectedTokens(rendered, tokens, true);
}

const ReferenceDecorations = Extension.create({
  name: "referenceDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: referenceDecorationsKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }

              for (const match of node.text.matchAll(/\[\[[^\]]+\]\]/g)) {
                if (match.index === undefined) continue;

                decorations.push(
                  Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                    class: "note-ref-token note-ref-token-page",
                  })
                );
              }

              for (const match of node.text.matchAll(/(^|[\s(])#([a-z0-9][a-z0-9_/-]*)/gi)) {
                if (match.index === undefined) continue;

                const prefixLength = match[1]?.length ?? 0;
                const start = pos + match.index + prefixLength;
                const end = start + (match[2]?.length ?? 0) + 1;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: "note-ref-token note-ref-token-tag",
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const MarkdownLink = Link.extend({
  addInputRules() {
    return [
      markInputRule({
        find: markdownLinkInputRegex,
        type: this.type,
        getAttributes: (match) => ({ href: match[2] }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: markdownLinkPasteRegex,
        type: this.type,
        getAttributes: (match) => ({ href: match[2] }),
      }),
    ];
  },
}).configure({
  autolink: true,
  linkOnPaste: true,
  openOnClick: false,
  protocols: ["http", "https", "mailto"],
  HTMLAttributes: {
    rel: "noopener noreferrer nofollow",
    target: "_blank",
  },
});

const NotesHorizontalRule = HorizontalRule.extend({
  addInputRules() {
    return [];
  },
});

function isJsonContent(value: unknown): value is JSONContent {
  return Boolean(value) && typeof value === "object" && "type" in (value as Record<string, unknown>);
}

function parseDocument(raw: unknown): JSONContent {
  const normalized = normalizeNoteDocument(raw);

  if (isJsonContent(normalized)) {
    return normalized;
  }

  logger.warn("[notes] Normalized block content was not a valid document", {
    raw,
    normalized,
  });
  return emptyDocument();
}

function splitEditorDocumentAtSelection(editor: Editor) {
  const { from, to } = editor.state.selection;
  const currentContent = parseDocument(editor.state.doc.cut(0, from).toJSON());
  const nextSiblingContent = parseDocument(editor.state.doc.cut(to).toJSON());

  return {
    currentContent,
    nextSiblingContent,
  };
}

function createNormalTextSiblingContent(content: JSONContent) {
  const text = extractNoteText(content);
  return text.trim().length > 0 ? createNoteDocumentFromText(text) : emptyDocument();
}

function isAtStartOfBlockContent(editor: Editor) {
  const { from } = editor.state.selection;
  return editor.state.doc.textBetween(0, from, "\n", "\0").length === 0;
}

function createParagraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text.length > 0 ? [{ type: "text", text }] : [],
  };
}

function getEditorPlainText(view: EditorView) {
  return view.state.doc.textBetween(0, view.state.doc.content.size, "\n").trim();
}

function getSelectionHtml(view: EditorView) {
  const fragment = view.state.selection.content().content;
  if (fragment.childCount === 0) {
    return "";
  }

  const serializer = DOMSerializer.fromSchema(view.state.schema);
  const wrapper = document.createElement("div");
  wrapper.appendChild(serializer.serializeFragment(fragment));
  return wrapper.innerHTML;
}

function getSelectionMarkdown(view: EditorView) {
  const html = getSelectionHtml(view);
  if (!html) {
    return "";
  }

  return normalizeExportedMarkdownTokens(turndownService.turndown(html).trim());
}

function parseHtmlDocument(view: EditorView, html: string): JSONContent | null {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
  const documentNode = parser.parse(wrapper);
  return documentNode.toJSON() as JSONContent;
}

function parseMarkdownClipboardDocuments(view: EditorView, text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const nextHtml = parseMarkdownClipboardText(line);
    return parseHtmlDocument(view, nextHtml) ?? createScaffoldDocument(line);
  });
}

function splitMarkdownTableRow(line: string) {
  const normalized = line.trim().replace(/^\||\|$/g, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function createTableCellNode(type: "tableHeader" | "tableCell", text: string): JSONContent {
  return {
    type,
    content: [createParagraphNode(text)],
  };
}

function parseMarkdownTable(text: string): JSONContent | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return null;
  }

  const headerCells = splitMarkdownTableRow(lines[0]);
  const separatorCells = splitMarkdownTableRow(lines[1]);

  if (
    headerCells.length === 0 ||
    headerCells.length !== separatorCells.length ||
    !separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell))
  ) {
    return null;
  }

  const bodyRows = lines.slice(2).map((line) => splitMarkdownTableRow(line));
  if (bodyRows.some((row) => row.length !== headerCells.length)) {
    return null;
  }

  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: headerCells.map((cell) => createTableCellNode("tableHeader", cell)),
          },
          ...bodyRows.map((row) => ({
            type: "tableRow",
            content: row.map((cell) => createTableCellNode("tableCell", cell)),
          })),
        ],
      },
    ],
  };
}

function parseMarkdownImage(text: string): JSONContent | null {
  const match = text.match(markdownImageBlockRegex);
  if (!match) {
    return null;
  }

  return {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: {
          src: match[2],
          alt: match[1] || null,
          title: match[3] || null,
        },
      },
    ],
  };
}

function parseMarkdownTextDocument(view: EditorView, text: string): JSONContent {
  const trimmed = text.trim();
  if (!trimmed) {
    return emptyDocument();
  }

  const nextImageDocument = parseMarkdownImage(trimmed);
  if (nextImageDocument) {
    return nextImageDocument;
  }

  const nextTableDocument = parseMarkdownTable(trimmed);
  if (nextTableDocument) {
    return nextTableDocument;
  }

  const nextHtml = parseMarkdownClipboardText(text);
  return parseHtmlDocument(view, nextHtml) ?? createScaffoldDocument(text);
}

function tryConvertMarkdownBlock(editor: Editor) {
  const nextImageDocument = parseMarkdownImage(getEditorPlainText(editor.view));
  if (nextImageDocument) {
    editor.commands.setContent(nextImageDocument, { emitUpdate: true });
    return true;
  }

  const nextTableDocument = parseMarkdownTable(getEditorPlainText(editor.view));
  if (nextTableDocument) {
    editor.commands.setContent(nextTableDocument, { emitUpdate: true });
    return true;
  }

  return false;
}

function isHorizontalRuleOnlyDocument(value: JSONContent | null | undefined) {
  if (!value || value.type !== "doc" || !Array.isArray(value.content) || value.content.length !== 1) {
    return false;
  }

  return value.content[0]?.type === "horizontalRule";
}

type PageReferenceQuery = {
  query: string;
  from: number;
  to: number;
};

type ResolvedPageReference = {
  title: string;
  from: number;
  to: number;
};

function getPageReferenceQuery(editor: Editor): PageReferenceQuery | null {
  const { state } = editor;

  if (!state.selection.empty) {
    return null;
  }

  const { $from, from } = state.selection;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "", "\0");
  const triggerIndex = textBefore.lastIndexOf("[[");
  if (triggerIndex < 0) {
    return null;
  }

  const lastClosedIndex = textBefore.lastIndexOf("]]"
  );
  if (lastClosedIndex > triggerIndex) {
    return null;
  }

  const textAfter = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, "", "\0");
  const closingIndex = textAfter.indexOf("]]"
  );
  const suffix = closingIndex >= 0 ? textAfter.slice(0, closingIndex) : "";
  const prefix = textBefore.slice(triggerIndex + 2);
  const query = `${textBefore.slice(triggerIndex + 2)}${suffix}`;

  if (closingIndex === 0 && prefix.trim().length === 0) {
    return null;
  }

  if (query.includes("[[") || query.includes("]]")) {
    return null;
  }

  return {
    query,
    from: $from.start() + triggerIndex,
    to: closingIndex >= 0 ? from + closingIndex + 2 : from,
  };
}

function getResolvedPageReferenceAtPosition(editor: Editor, position: number): ResolvedPageReference | null {
  const boundedPosition = Math.max(0, Math.min(position, editor.state.doc.content.size));
  const resolvedPosition = editor.state.doc.resolve(boundedPosition);
  const parentText = resolvedPosition.parent.textBetween(0, resolvedPosition.parent.content.size, "", "\0");
  const parentOffset = resolvedPosition.parentOffset;

  for (const match of parentText.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (match.index === undefined) {
      continue;
    }

    const from = match.index;
    const to = from + match[0].length;
    if (parentOffset < from || parentOffset > to) {
      continue;
    }

    const title = (match[1] ?? "").trim();
    if (!title) {
      return null;
    }

    return {
      title,
      from,
      to,
    };
  }

  return null;
}

export const NoteBlockEditor = memo(function NoteBlockEditor({
  content,
  notePageTitles,
  hasChildren = false,
  markdownToggleVersion = 0,
  shouldFocus = false,
  focusPlacement = "end",
  onFocusApplied,
  onChange,
  onCommit,
  onCreateSibling,
  onCreateSiblings,
  onMergeWithPrevious,
  onOpenPageReference,
  onNavigateUp,
  onNavigateDown,
  onIndent,
  onOutdent,
  onDeleteEmpty,
}: {
  content: string | null | undefined;
  notePageTitles: string[];
  hasChildren?: boolean;
  markdownToggleVersion?: number;
  shouldFocus?: boolean;
  focusPlacement?: number | "start" | "end";
  onFocusApplied?: () => void;
  onChange: (content: JSONContent) => void;
  onCommit?: (content: JSONContent) => void;
  onCreateSibling: (
    content: JSONContent,
    nextSiblingContent?: JSONContent,
    options?: {
      focusPlacement?: "start" | "end";
      focusTarget?: "created" | "current";
      insertionSide?: "before" | "after";
    }
  ) => void;
  onCreateSiblings?: (content: JSONContent, siblingContents: JSONContent[]) => Promise<void> | void;
  onMergeWithPrevious?: (content: JSONContent, options?: { hasChildren?: boolean }) => void | Promise<void>;
  onOpenPageReference?: (title: string) => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onDeleteEmpty: () => void;
}) {
  const initialContentRef = useRef(parseDocument(content));
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const onCreateSiblingRef = useRef(onCreateSibling);
  const onCreateSiblingsRef = useRef(onCreateSiblings);
  const onMergeWithPreviousRef = useRef(onMergeWithPrevious);
  const onOpenPageReferenceRef = useRef(onOpenPageReference);
  const onNavigateUpRef = useRef(onNavigateUp);
  const onNavigateDownRef = useRef(onNavigateDown);
  const onIndentRef = useRef(onIndent);
  const onOutdentRef = useRef(onOutdent);
  const onDeleteEmptyRef = useRef(onDeleteEmpty);
  const lastAppliedExternalContentRef = useRef(JSON.stringify(initialContentRef.current));
  const pendingLocalContentRef = useRef<string | null>(null);
  const suppressBlurCommitRef = useRef(false);
  const isEditingMarkdownSourceRef = useRef(false);
  const lastMarkdownToggleVersionRef = useRef(markdownToggleVersion);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [pageReferenceQuery, setPageReferenceQuery] = useState<PageReferenceQuery | null>(null);
  const [selectedPageReferenceIndex, setSelectedPageReferenceIndex] = useState(0);
  const slashQueryRef = useRef<string | null>(null);
  const filteredSlashCommandsRef = useRef<SlashCommand[]>([]);
  const slashItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pageReferenceQueryRef = useRef<PageReferenceQuery | null>(null);
  const filteredPageReferenceTitlesRef = useRef<string[]>([]);
  const pageReferenceItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const filteredSlashCommands = useMemo(() => getFilteredSlashCommands(slashQuery), [slashQuery]);

  const groupedSlashCommands = useMemo(() => getGroupedSlashCommands(filteredSlashCommands), [filteredSlashCommands]);

  const filteredPageReferenceTitles = useMemo(() => {
    if (pageReferenceQuery === null) {
      return [];
    }

    const normalizedQuery = pageReferenceQuery.query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return notePageTitles;
    }

    return notePageTitles.filter((title) => title.toLocaleLowerCase().includes(normalizedQuery));
  }, [notePageTitles, pageReferenceQuery]);

  const emitEditorContentIfChanged = () => {
    if (!editor) return null;

    const nextContent = editor.getJSON();
    const nextSerialized = JSON.stringify(nextContent);
    const currentSerialized = JSON.stringify(editor.getJSON());
    const pendingLocalContent = pendingLocalContentRef.current;
    const baselineSerialized = pendingLocalContent ?? lastAppliedExternalContentRef.current;

    if (nextSerialized === baselineSerialized || nextSerialized === currentSerialized && pendingLocalContent === nextSerialized) {
      return null;
    }

    pendingLocalContentRef.current = nextSerialized;
    onChangeRef.current(nextContent);
    return nextContent;
  };

  const updateSlashQuery = (nextEditor: Editor) => {
    const nextQuery = getSlashQuery(nextEditor);
    setSlashQuery(nextQuery);
  };

  const updatePageReferenceQuery = (nextEditor: Editor) => {
    const nextQuery = getPageReferenceQuery(nextEditor);
    setPageReferenceQuery(nextQuery);
  };

  const applySlashCommand = (command: SlashCommand) => {
    if (!editor) return;

    const nextContent = command.createContent();

    if (command.id === "horizontal-rule") {
      pendingLocalContentRef.current = JSON.stringify(nextContent);
      editor.commands.setContent(nextContent, { emitUpdate: true });
      setSlashQuery(null);
      setSelectedSlashIndex(0);
      onCreateSiblingRef.current(nextContent, emptyDocument(), {
        focusPlacement: "start",
        focusTarget: "created",
        insertionSide: "after",
      });
      return;
    }

    pendingLocalContentRef.current = JSON.stringify(nextContent);
    editor.commands.setContent(nextContent, { emitUpdate: true });
    setSlashQuery(null);
    setSelectedSlashIndex(0);

    requestAnimationFrame(() => {
      editor.chain().focus("end").run();
    });
  };

  const applyPageReference = (title: string) => {
    if (!editor) return;

    const nextQuery = pageReferenceQueryRef.current;
    if (!nextQuery) return;

    const nextReference = `[[${title}]]`;

    editor.chain().focus().command(({ tr, dispatch }) => {
      tr.insertText(nextReference, nextQuery.from, nextQuery.to);
      tr.setSelection(TextSelection.create(tr.doc, nextQuery.from + nextReference.length));

      if (dispatch) {
        dispatch(tr.scrollIntoView());
      }

      return true;
    }).run();

    setPageReferenceQuery(null);
    setSelectedPageReferenceIndex(0);
  };

  const convertCurrentBlockToMarkdownSource = () => {
    if (!editor) return null;

    const markdown = serializeNoteDocumentToMarkdown(editor.getJSON());
    const nextContent = createNoteDocumentFromText(markdown);
    isEditingMarkdownSourceRef.current = true;
    pendingLocalContentRef.current = JSON.stringify(nextContent);
    editor.commands.setContent(nextContent, { emitUpdate: true });

    requestAnimationFrame(() => {
      editor.chain().focus("end").run();
    });

    return nextContent;
  };

  const renderCurrentMarkdownSource = () => {
    if (!editor) return null;

    const markdownText = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n");
    const nextContent = parseMarkdownTextDocument(editor.view, markdownText);
    isEditingMarkdownSourceRef.current = false;
    pendingLocalContentRef.current = JSON.stringify(nextContent);
    editor.commands.setContent(nextContent, { emitUpdate: true });
    return nextContent;
  };

  const flushEditorContent = () => {
    if (!editor) return null;

    const nextContent = editor.getJSON();
    const nextSerialized = JSON.stringify(nextContent);
    const pendingLocalContent = pendingLocalContentRef.current;

    if (nextSerialized === (pendingLocalContent ?? lastAppliedExternalContentRef.current)) {
      return nextContent;
    }

    pendingLocalContentRef.current = nextSerialized;
    onChangeRef.current(nextContent);
    return nextContent;
  };

  useEffect(() => {
    onChangeRef.current = onChange;
    onCommitRef.current = onCommit;
    onCreateSiblingRef.current = onCreateSibling;
    onCreateSiblingsRef.current = onCreateSiblings;
    onMergeWithPreviousRef.current = onMergeWithPrevious;
    onOpenPageReferenceRef.current = onOpenPageReference;
    onNavigateUpRef.current = onNavigateUp;
    onNavigateDownRef.current = onNavigateDown;
    onIndentRef.current = onIndent;
    onOutdentRef.current = onOutdent;
    onDeleteEmptyRef.current = onDeleteEmpty;
  }, [onChange, onCommit, onCreateSibling, onCreateSiblings, onDeleteEmpty, onIndent, onMergeWithPrevious, onNavigateDown, onNavigateUp, onOpenPageReference, onOutdent]);

  useEffect(() => {
    slashQueryRef.current = slashQuery;
    filteredSlashCommandsRef.current = filteredSlashCommands;
    pageReferenceQueryRef.current = pageReferenceQuery;
    filteredPageReferenceTitlesRef.current = filteredPageReferenceTitles;
  }, [filteredPageReferenceTitles, filteredSlashCommands, pageReferenceQuery, slashQuery]);

  useEffect(() => {
    setSelectedSlashIndex((currentIndex) => {
      if (filteredSlashCommands.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredSlashCommands.length - 1);
    });
  }, [filteredSlashCommands.length]);

  useEffect(() => {
    setSelectedPageReferenceIndex((currentIndex) => {
      if (filteredPageReferenceTitles.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredPageReferenceTitles.length - 1);
    });
  }, [filteredPageReferenceTitles.length]);

  useEffect(() => {
    if (slashQuery === null) {
      slashItemRefs.current = [];
      return;
    }

    const nextItem = slashItemRefs.current[selectedSlashIndex];
    nextItem?.scrollIntoView({ block: "nearest" });
  }, [selectedSlashIndex, slashQuery]);

  useEffect(() => {
    if (pageReferenceQuery === null) {
      pageReferenceItemRefs.current = [];
      return;
    }

    const nextItem = pageReferenceItemRefs.current[selectedPageReferenceIndex];
    nextItem?.scrollIntoView({ block: "nearest" });
  }, [pageReferenceQuery, selectedPageReferenceIndex]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      Code,
      CodeBlock,
      Blockquote,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      NotesHorizontalRule,
      MarkdownLink,
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      HardBreak,
      History,
      Dropcursor,
      Gapcursor,
      ReferenceDecorations,
    ],
    content: initialContentRef.current,
    editorProps: {
      attributes: {
        class:
          "min-h-6 rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-5 text-foreground outline-none focus:outline-none cursor-text",
      },
      handleDOMEvents: {
        click(view, event) {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.closest(".note-ref-token-page")) {
            return false;
          }

          const nextEditor = editor ?? view as unknown as Editor;
          const position = view.posAtDOM(target, 0);
          const reference = getResolvedPageReferenceAtPosition(nextEditor, position);
          if (!reference) {
            return false;
          }

          const canOpenReference = notePageTitles.some((title) => title.localeCompare(reference.title, undefined, { sensitivity: "accent" }) === 0);
          if (!canOpenReference) {
            return false;
          }

          event.preventDefault();
          onOpenPageReferenceRef.current?.(reference.title);
          return true;
        },
        blur() {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
            emitEditorContentIfChanged();
            return false;
          }

          if (isEditingMarkdownSourceRef.current) {
            const nextContent = renderCurrentMarkdownSource();
            if (nextContent) {
              onCommitRef.current?.(nextContent);
            }
            return false;
          }

          const nextContent = emitEditorContentIfChanged();
          if (nextContent) {
            onCommitRef.current?.(nextContent);
          }

          return false;
        },
        copy(view, event) {
          const clipboardEvent = event as ClipboardEvent;
          if (!clipboardEvent.clipboardData || view.state.selection.empty) {
            return false;
          }

          const markdown = getSelectionMarkdown(view);
          if (!markdown) {
            return false;
          }

          clipboardEvent.preventDefault();
          clipboardEvent.clipboardData.setData("text/plain", markdown);
          clipboardEvent.clipboardData.setData("text/markdown", markdown);
          clipboardEvent.clipboardData.setData("text/html", getSelectionHtml(view));
          return true;
        },
        cut(view, event) {
          const clipboardEvent = event as ClipboardEvent;
          if (!clipboardEvent.clipboardData || view.state.selection.empty) {
            return false;
          }

          const markdown = getSelectionMarkdown(view);
          if (!markdown) {
            return false;
          }

          clipboardEvent.preventDefault();
          clipboardEvent.clipboardData.setData("text/plain", markdown);
          clipboardEvent.clipboardData.setData("text/markdown", markdown);
          clipboardEvent.clipboardData.setData("text/html", getSelectionHtml(view));
          view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
          return true;
        },
      },
      handlePaste(view, event) {
        const markdownClipboardText = getMarkdownClipboardText(event);

        if (!markdownClipboardText) {
          return false;
        }

        const nextDocuments = parseMarkdownClipboardDocuments(view, markdownClipboardText);
        if (nextDocuments.length === 0) {
          return false;
        }

        if (nextDocuments.length > 1) {
          const [nextContent, ...nextSiblingContents] = nextDocuments;

          event.preventDefault();
          pendingLocalContentRef.current = JSON.stringify(nextContent);
          editor?.commands.setContent(nextContent, { emitUpdate: true });
          void onCreateSiblingsRef.current?.(nextContent, nextSiblingContents);
          updateSlashQuery(editor ?? view as unknown as Editor);
          updatePageReferenceQuery(editor ?? view as unknown as Editor);
          return true;
        }

        const nextHtml = parseMarkdownClipboardText(markdownClipboardText);
        if (!nextHtml) {
          return false;
        }

        event.preventDefault();
        editor?.commands.insertContent(nextHtml, {
          parseOptions: {
            preserveWhitespace: false,
          },
        });
        updateSlashQuery(editor ?? view as unknown as Editor);
        updatePageReferenceQuery(editor ?? view as unknown as Editor);
        return true;
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        if (pageReferenceQueryRef.current !== null) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            view.focus();
            setSelectedPageReferenceIndex((currentIndex) => {
              const titles = filteredPageReferenceTitlesRef.current;
              if (titles.length === 0) {
                return 0;
              }

              return (currentIndex + 1) % titles.length;
            });
            return true;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            view.focus();
            setSelectedPageReferenceIndex((currentIndex) => {
              const titles = filteredPageReferenceTitlesRef.current;
              if (titles.length === 0) {
                return 0;
              }

              return (currentIndex - 1 + titles.length) % titles.length;
            });
            return true;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setPageReferenceQuery(null);
            setSelectedPageReferenceIndex(0);
            return true;
          }

          if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            const nextTitle = filteredPageReferenceTitlesRef.current[selectedPageReferenceIndex] ?? null;
            if (nextTitle) {
              event.preventDefault();
              applyPageReference(nextTitle);
              return true;
            }
          }
        }

        if (slashQueryRef.current !== null) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            view.focus();
            setSelectedSlashIndex((currentIndex) => {
              const commands = filteredSlashCommandsRef.current;
              if (commands.length === 0) {
                return 0;
              }

              return (currentIndex + 1) % commands.length;
            });
            return true;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            view.focus();
            setSelectedSlashIndex((currentIndex) => {
              const commands = filteredSlashCommandsRef.current;
              if (commands.length === 0) {
                return 0;
              }

              return (currentIndex - 1 + commands.length) % commands.length;
            });
            return true;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setSlashQuery(null);
            setSelectedSlashIndex(0);
            return true;
          }

          if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            const nextCommand = filteredSlashCommandsRef.current[selectedSlashIndex] ?? null;
            if (nextCommand) {
              event.preventDefault();
              applySlashCommand(nextCommand);
              return true;
            }
          }
        }

        if (event.key === "Enter" && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
          if (editor?.isActive("codeBlock") || editor?.isActive("table")) {
            event.preventDefault();
            const nextContent = flushEditorContent() ?? editor.getJSON();
            onCreateSiblingRef.current(nextContent);
            return true;
          }
        }

        if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
          if (editor?.isActive("taskItem")) {
            event.preventDefault();
            const nextContent = flushEditorContent();
            if (nextContent) {
              onCreateSiblingRef.current(nextContent, emptyTaskListDocument());
            }
            return true;
          }

          if (editor && isHorizontalRuleOnlyDocument(editor.getJSON())) {
            event.preventDefault();
            const nextContent = editor.getJSON();
            onCreateSiblingRef.current(nextContent, emptyDocument(), {
              focusPlacement: "start",
              focusTarget: "created",
              insertionSide: "after",
            });
            return true;
          }

          if (editor?.isActive("codeBlock") || editor?.isActive("table")) {
            return false;
          }

          if (editor && tryConvertMarkdownBlock(editor)) {
            return true;
          }

          event.preventDefault();
          if (editor) {
            const { currentContent, nextSiblingContent } = splitEditorDocumentAtSelection(editor);
            const isAtBlockStart = isAtStartOfBlockContent(editor);

            if (hasChildren) {
              pendingLocalContentRef.current = JSON.stringify(nextSiblingContent);
              editor.commands.setContent(nextSiblingContent, { emitUpdate: true });
              onCreateSiblingRef.current(nextSiblingContent, createNormalTextSiblingContent(currentContent), {
                focusPlacement: isAtBlockStart ? "end" : "start",
                focusTarget: isAtBlockStart ? "created" : "current",
                insertionSide: "before",
              });
            } else {
              pendingLocalContentRef.current = JSON.stringify(currentContent);
              editor.commands.setContent(currentContent, { emitUpdate: true });
              onCreateSiblingRef.current(currentContent, createNormalTextSiblingContent(nextSiblingContent), {
                focusPlacement: "start",
                focusTarget: "created",
                insertionSide: "after",
              });
            }
          }
          return true;
        }

        if (event.key === "Tab") {
          if (editor?.isActive("table") || editor?.isActive("codeBlock")) {
            return false;
          }

          event.preventDefault();
          const isAtBlockStart = view.state.selection.empty && view.state.selection.$from.parentOffset === 0;

          if (isAtBlockStart) {
            if (event.shiftKey) {
              onOutdentRef.current();
            } else {
              onIndentRef.current();
            }

            return true;
          }

          editor?.commands.insertContent("\t");
          return true;
        }

        if (event.key === "ArrowUp" && view.state.selection.empty && view.endOfTextblock("up")) {
          if (onNavigateUpRef.current) {
            event.preventDefault();
            suppressBlurCommitRef.current = true;

            if (isEditingMarkdownSourceRef.current) {
              const nextContent = renderCurrentMarkdownSource();
              if (nextContent) {
                onCommitRef.current?.(nextContent);
              }
            } else {
              emitEditorContentIfChanged();
            }

            onNavigateUpRef.current();
            return true;
          }
        }

        if (event.key === "ArrowDown" && view.state.selection.empty && view.endOfTextblock("down")) {
          if (onNavigateDownRef.current) {
            event.preventDefault();
            suppressBlurCommitRef.current = true;

            if (isEditingMarkdownSourceRef.current) {
              const nextContent = renderCurrentMarkdownSource();
              if (nextContent) {
                onCommitRef.current?.(nextContent);
              }
            } else {
              emitEditorContentIfChanged();
            }

            onNavigateDownRef.current();
            return true;
          }
        }

        if (event.key === "Backspace" && view.state.doc.textContent.trim().length === 0) {
          event.preventDefault();

          if (editor?.isActive("taskItem") || editor?.isActive("codeBlock")) {
            const nextContent = emptyDocument();
            pendingLocalContentRef.current = JSON.stringify(nextContent);
            editor.commands.setContent(nextContent, { emitUpdate: true });
            onCommitRef.current?.(nextContent);
            return true;
          }

          flushEditorContent();
          onDeleteEmptyRef.current();
          return true;
        }

        if (
          event.key === "Backspace" &&
          !event.shiftKey &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          view.state.selection.empty &&
          editor &&
          isAtStartOfBlockContent(editor) &&
          !editor?.isActive("taskItem") &&
          !editor?.isActive("codeBlock") &&
          !editor?.isActive("table") &&
          onMergeWithPreviousRef.current
        ) {
          event.preventDefault();
          const nextContent = flushEditorContent() ?? editor?.getJSON();
          if (nextContent) {
            suppressBlurCommitRef.current = true;
            void onMergeWithPreviousRef.current(nextContent, { hasChildren });
            return true;
          }
        }

        return false;
      },
    },
    onUpdate({ editor: nextEditor }: { editor: Editor }) {
      const nextContent = nextEditor.getJSON();
      pendingLocalContentRef.current = JSON.stringify(nextContent);
      onChangeRef.current(nextContent);
      updateSlashQuery(nextEditor);
      updatePageReferenceQuery(nextEditor);
    },
  }, []);

  useEffect(() => {
    if (!editor) return;

    const nextContent = parseDocument(content);
    const nextSerialized = JSON.stringify(nextContent);
    const currentSerialized = JSON.stringify(editor.getJSON());
    const pendingLocalContent = pendingLocalContentRef.current;
    const hasFocus = editor.isFocused;

    if (pendingLocalContent) {
      if (nextSerialized === pendingLocalContent) {
        lastAppliedExternalContentRef.current = nextSerialized;
        pendingLocalContentRef.current = null;
        return;
      }

      if (hasFocus) {
        return;
      }
    }

    if (nextSerialized === currentSerialized || nextSerialized === lastAppliedExternalContentRef.current) {
      lastAppliedExternalContentRef.current = nextSerialized;
      return;
    }

    lastAppliedExternalContentRef.current = nextSerialized;
    pendingLocalContentRef.current = null;
    isEditingMarkdownSourceRef.current = false;
    editor.commands.setContent(nextContent, { emitUpdate: false });
    updateSlashQuery(editor);
    updatePageReferenceQuery(editor);
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    if (markdownToggleVersion === lastMarkdownToggleVersionRef.current) return;

    lastMarkdownToggleVersionRef.current = markdownToggleVersion;

    if (isEditingMarkdownSourceRef.current) {
      const nextContent = renderCurrentMarkdownSource();
      if (nextContent) {
        onCommitRef.current?.(nextContent);
      }
      return;
    }

    convertCurrentBlockToMarkdownSource();
  }, [editor, markdownToggleVersion]);

  useEffect(() => {
    if (!editor || !shouldFocus) return;

    if (typeof focusPlacement === "number") {
      editor.chain().focus().setTextSelection(focusPlacement).run();
    } else {
      editor.chain().focus(focusPlacement).run();
    }
    onFocusApplied?.();
  }, [editor, focusPlacement, onFocusApplied, shouldFocus]);

  if (!editor) {
    return (
      <div aria-hidden="true" className="min-h-6 px-0 py-0 text-sm leading-5 text-transparent">
        &nbsp;
      </div>
    );
  }

  return (
    <div
      className="relative cursor-text"
      onMouseDown={(event) => {
        if (!editor) return;
        if (event.target instanceof HTMLElement && event.target.closest(".ProseMirror")) return;
        event.preventDefault();
        editor.chain().focus("end").run();
      }}
    >
      <EditorContent editor={editor} />
      {pageReferenceQuery !== null ? (
        <div className="mt-2 max-w-md rounded-xl border border-border/60 bg-popover/95 p-1.5 shadow-lg backdrop-blur-sm">
          <Command shouldFilter={false} className="rounded-xl! bg-transparent p-0">
            <CommandList className="max-h-64">
              <CommandEmpty>No pages found.</CommandEmpty>
              <CommandGroup
                heading={
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    Pages
                  </span>
                }
              >
                {filteredPageReferenceTitles.map((title, index) => (
                  <CommandItem
                    key={title}
                    value={title}
                    ref={(element) => {
                      pageReferenceItemRefs.current[index] = element;
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onSelect={() => applyPageReference(title)}
                    className={index === selectedPageReferenceIndex ? "bg-muted/80 text-foreground" : "text-foreground/95"}
                  >
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1 truncate text-[13px] leading-5">
                      <span className="font-medium text-foreground">{title}</span>
                    </div>
                    <CommandShortcut className="text-[10px] tracking-[0.12em]">[[</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      ) : slashQuery !== null ? (
        <div className="mt-2 max-w-md rounded-xl border border-border/60 bg-popover/95 p-1.5 shadow-lg backdrop-blur-sm">
          <Command shouldFilter={false} className="rounded-xl! bg-transparent p-0">
            <CommandList className="max-h-64">
              <CommandEmpty>No block types found.</CommandEmpty>
              {(() => {
                let flatIndex = -1;

                return groupedSlashCommands.map((section) => {
                  const SectionIcon = section.icon;

                  return (
                    <CommandGroup
                      key={section.id}
                      heading={
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <SectionIcon className="h-3 w-3" />
                          {section.title}
                        </span>
                      }
                    >
                      {section.commands.map((command) => {
                        flatIndex += 1;
                        const Icon = command.icon;
                        const itemIndex = flatIndex;

                        return (
                          <CommandItem
                            key={command.id}
                            value={command.id}
                            ref={(element) => {
                              slashItemRefs.current[itemIndex] = element;
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onSelect={() => applySlashCommand(command)}
                            className={itemIndex === selectedSlashIndex ? "bg-muted/80 text-foreground" : "text-foreground/95"}
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="min-w-0 flex-1 truncate text-[13px] leading-5">
                              <span className="font-medium text-foreground">{command.title}</span>
                              <span className="mx-1.5 text-muted-foreground/60">-</span>
                              <span className="text-[11px] text-muted-foreground">{command.description}</span>
                            </div>
                            <CommandShortcut className="text-[10px] tracking-[0.12em]">{command.shortcut}</CommandShortcut>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  );
                });
              })()}
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  );
});