"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Extension, markInputRule, markPasteRule, type Editor, type JSONContent } from "@tiptap/core";
import { Code2, Heading1, Heading2, Heading3, ImageIcon, Link2, ListTodo, Quote, Table2, TextCursorInput, type LucideIcon } from "lucide-react";
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
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import Text from "@tiptap/extension-text";

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { normalizeNoteDocument } from "@/lib/notes/notes-content";
import { logger } from "@/lib/shared/logger";

const referenceDecorationsKey = new PluginKey("noteReferenceDecorations");
const markdownLinkInputRegex = /(?:^|\s)\[([^\]]+)\]\((\S+?)\)$/;
const markdownLinkPasteRegex = /(?:^|\s)\[([^\]]+)\]\((\S+?)\)/g;
const markdownImageBlockRegex = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/;

type SlashCommandSection = "basic" | "structure" | "media";

type SlashCommand = {
  id: string;
  section: SlashCommandSection;
  title: string;
  description: string;
  shortcut: string;
  icon: LucideIcon;
  keywords: string[];
  createContent: () => JSONContent;
};

const slashCommandSections: Array<{ id: SlashCommandSection; title: string; icon: LucideIcon }> = [
  { id: "basic", title: "Basic", icon: TextCursorInput },
  { id: "structure", title: "Structure", icon: Table2 },
  { id: "media", title: "Media", icon: ImageIcon },
];

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

function emptyDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

function emptyTaskListDocument(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  };
}

function emptyHeadingDocument(level: 1 | 2 | 3): JSONContent {
  return {
    type: "doc",
    content: [{ type: "heading", attrs: { level }, content: [] }],
  };
}

function emptyBlockquoteDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "blockquote", content: [{ type: "paragraph" }] }],
  };
}

function emptyCodeBlockDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "codeBlock", attrs: { language: null }, content: [] }],
  };
}

function createScaffoldDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function emptyTableDocument(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [{ type: "paragraph" }] },
              { type: "tableHeader", content: [{ type: "paragraph" }] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "paragraph" }] },
              { type: "tableCell", content: [{ type: "paragraph" }] },
            ],
          },
        ],
      },
    ],
  };
}

const slashCommands: SlashCommand[] = [
  {
    id: "text",
    section: "basic",
    title: "Text",
    description: "Turn this block into plain text.",
    shortcut: "/text",
    icon: TextCursorInput,
    keywords: ["paragraph", "text", "normal"],
    createContent: () => emptyDocument(),
  },
  {
    id: "heading-1",
    section: "basic",
    title: "Heading 1",
    description: "Large section heading.",
    shortcut: "/h1",
    icon: Heading1,
    keywords: ["heading", "title", "h1"],
    createContent: () => emptyHeadingDocument(1),
  },
  {
    id: "heading-2",
    section: "basic",
    title: "Heading 2",
    description: "Medium section heading.",
    shortcut: "/h2",
    icon: Heading2,
    keywords: ["heading", "subtitle", "h2"],
    createContent: () => emptyHeadingDocument(2),
  },
  {
    id: "heading-3",
    section: "basic",
    title: "Heading 3",
    description: "Compact section heading.",
    shortcut: "/h3",
    icon: Heading3,
    keywords: ["heading", "subheading", "h3"],
    createContent: () => emptyHeadingDocument(3),
  },
  {
    id: "quote",
    section: "basic",
    title: "Quote",
    description: "Start a block quote.",
    shortcut: "/quote",
    icon: Quote,
    keywords: ["blockquote", "quote", "callout"],
    createContent: () => emptyBlockquoteDocument(),
  },
  {
    id: "task-list",
    section: "structure",
    title: "Task List",
    description: "Checklist block with one item.",
    shortcut: "/todo",
    icon: ListTodo,
    keywords: ["task", "todo", "checklist", "checkbox"],
    createContent: () => emptyTaskListDocument(),
  },
  {
    id: "code-block",
    section: "structure",
    title: "Code Block",
    description: "Monospace block for code snippets.",
    shortcut: "/code",
    icon: Code2,
    keywords: ["code", "snippet", "fence", "pre"],
    createContent: () => emptyCodeBlockDocument(),
  },
  {
    id: "table",
    section: "structure",
    title: "Table",
    description: "Two-column starter table.",
    shortcut: "/table",
    icon: Table2,
    keywords: ["table", "grid", "columns"],
    createContent: () => emptyTableDocument(),
  },
  {
    id: "link",
    section: "media",
    title: "Link",
    description: "Insert a markdown link scaffold.",
    shortcut: "/link",
    icon: Link2,
    keywords: ["link", "url", "anchor"],
    createContent: () => createScaffoldDocument("[label](https://example.com)"),
  },
  {
    id: "image",
    section: "media",
    title: "Image",
    description: "Insert a markdown image scaffold.",
    shortcut: "/image",
    icon: ImageIcon,
    keywords: ["image", "media", "photo", "picture"],
    createContent: () => createScaffoldDocument("![alt](https://example.com/image.png)"),
  },
];

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

function createParagraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text.length > 0 ? [{ type: "text", text }] : [],
  };
}

function getEditorPlainText(view: EditorView) {
  return view.state.doc.textBetween(0, view.state.doc.content.size, "\n").trim();
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

function getSlashQuery(editor: Editor) {
  const { state } = editor;

  if (!state.selection.empty || state.doc.childCount !== 1) {
    return null;
  }

  const firstChild = state.doc.firstChild;
  if (!firstChild || firstChild.type.name !== "paragraph") {
    return null;
  }

  const text = state.doc.textBetween(0, state.doc.content.size, "\n", "\0");
  if (!text.startsWith("/") || text.includes("\n")) {
    return null;
  }

  return text.slice(1);
}

export const NoteBlockEditor = memo(function NoteBlockEditor({
  content,
  shouldFocus = false,
  focusPlacement = "end",
  onFocusApplied,
  onChange,
  onCommit,
  onCreateSibling,
  onNavigateUp,
  onNavigateDown,
  onIndent,
  onOutdent,
  onDeleteEmpty,
}: {
  content: string | null | undefined;
  shouldFocus?: boolean;
  focusPlacement?: "start" | "end";
  onFocusApplied?: () => void;
  onChange: (content: JSONContent) => void;
  onCommit?: (content: JSONContent) => void;
  onCreateSibling: (content: JSONContent, nextSiblingContent?: JSONContent) => void;
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
  const onNavigateUpRef = useRef(onNavigateUp);
  const onNavigateDownRef = useRef(onNavigateDown);
  const onIndentRef = useRef(onIndent);
  const onOutdentRef = useRef(onOutdent);
  const onDeleteEmptyRef = useRef(onDeleteEmpty);
  const lastAppliedExternalContentRef = useRef(JSON.stringify(initialContentRef.current));
  const pendingLocalContentRef = useRef<string | null>(null);
  const suppressBlurCommitRef = useRef(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const slashQueryRef = useRef<string | null>(null);
  const filteredSlashCommandsRef = useRef<SlashCommand[]>([]);
  const slashItemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const filteredSlashCommands = useMemo(() => {
    if (slashQuery === null) {
      return [];
    }

    const normalizedQuery = slashQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return slashCommands;
    }

    return slashCommands.filter((command) => {
      const haystack = [command.title, command.description, command.shortcut, ...command.keywords]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [slashQuery]);

  const groupedSlashCommands = useMemo(() => {
    return slashCommandSections
      .map((section) => ({
        ...section,
        commands: filteredSlashCommands.filter((command) => command.section === section.id),
      }))
      .filter((section) => section.commands.length > 0);
  }, [filteredSlashCommands]);

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

  const applySlashCommand = (command: SlashCommand) => {
    if (!editor) return;

    const nextContent = command.createContent();
    pendingLocalContentRef.current = JSON.stringify(nextContent);
    editor.commands.setContent(nextContent, { emitUpdate: true });
    setSlashQuery(null);
    setSelectedSlashIndex(0);

    requestAnimationFrame(() => {
      editor.chain().focus("end").run();
    });
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
    onNavigateUpRef.current = onNavigateUp;
    onNavigateDownRef.current = onNavigateDown;
    onIndentRef.current = onIndent;
    onOutdentRef.current = onOutdent;
    onDeleteEmptyRef.current = onDeleteEmpty;
  }, [onChange, onCommit, onCreateSibling, onDeleteEmpty, onIndent, onNavigateDown, onNavigateUp, onOutdent]);

  useEffect(() => {
    slashQueryRef.current = slashQuery;
    filteredSlashCommandsRef.current = filteredSlashCommands;
  }, [filteredSlashCommands, slashQuery]);

  useEffect(() => {
    setSelectedSlashIndex((currentIndex) => {
      if (filteredSlashCommands.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredSlashCommands.length - 1);
    });
  }, [filteredSlashCommands.length]);

  useEffect(() => {
    if (slashQuery === null) {
      slashItemRefs.current = [];
      return;
    }

    const nextItem = slashItemRefs.current[selectedSlashIndex];
    nextItem?.scrollIntoView({ block: "nearest" });
  }, [selectedSlashIndex, slashQuery]);

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
      HorizontalRule,
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
        blur() {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
            emitEditorContentIfChanged();
            return false;
          }

          const nextContent = emitEditorContentIfChanged();
          if (nextContent) {
            onCommitRef.current?.(nextContent);
          }

          return false;
        },
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
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

        if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
          if (editor?.isActive("taskItem")) {
            event.preventDefault();
            const nextContent = flushEditorContent();
            if (nextContent) {
              onCreateSiblingRef.current(nextContent, emptyTaskListDocument());
            }
            return true;
          }

          if (editor?.isActive("codeBlock") || editor?.isActive("table")) {
            return false;
          }

          if (editor && tryConvertMarkdownBlock(editor)) {
            return true;
          }

          event.preventDefault();
          const nextContent = flushEditorContent();
          if (nextContent) {
            onCreateSiblingRef.current(nextContent);
          }
          return true;
        }

        if (event.key === "Tab") {
          if (editor?.isActive("table") || editor?.isActive("codeBlock")) {
            return false;
          }

          event.preventDefault();
          if (event.shiftKey) {
            onOutdentRef.current();
          } else {
            onIndentRef.current();
          }
          return true;
        }

        if (event.key === "ArrowUp" && view.state.selection.empty && view.endOfTextblock("up")) {
          if (onNavigateUpRef.current) {
            event.preventDefault();
            suppressBlurCommitRef.current = true;
            emitEditorContentIfChanged();
            onNavigateUpRef.current();
            return true;
          }
        }

        if (event.key === "ArrowDown" && view.state.selection.empty && view.endOfTextblock("down")) {
          if (onNavigateDownRef.current) {
            event.preventDefault();
            suppressBlurCommitRef.current = true;
            emitEditorContentIfChanged();
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

        return false;
      },
    },
    onUpdate({ editor: nextEditor }: { editor: Editor }) {
      const nextContent = nextEditor.getJSON();
      pendingLocalContentRef.current = JSON.stringify(nextContent);
      onChangeRef.current(nextContent);
      updateSlashQuery(nextEditor);
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
    editor.commands.setContent(nextContent, { emitUpdate: false });
    updateSlashQuery(editor);
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !shouldFocus) return;

    editor.chain().focus(focusPlacement).run();
    onFocusApplied?.();
  }, [editor, focusPlacement, onFocusApplied, shouldFocus]);

  if (!editor) {
    return (
      <div className="min-h-6 text-sm leading-6 text-muted-foreground">
        Loading editor…
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
      {slashQuery !== null ? (
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