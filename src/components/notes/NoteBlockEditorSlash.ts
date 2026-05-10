import type { Editor, JSONContent } from "@tiptap/core";
import { Code2, Heading1, Heading2, Heading3, ImageIcon, Link2, ListTodo, Quote, Table2, TextCursorInput, type LucideIcon } from "lucide-react";

export type SlashCommandSection = "basic" | "structure" | "media";

export type SlashCommand = {
  id: string;
  section: SlashCommandSection;
  title: string;
  description: string;
  shortcut: string;
  icon: LucideIcon;
  keywords: string[];
  createContent: () => JSONContent;
};

function createParagraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text.length > 0 ? [{ type: "text", text }] : [],
  };
}

export function emptyDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function emptyTaskListDocument(): JSONContent {
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

export function emptyHorizontalRuleDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "horizontalRule" }],
  };
}

export function createScaffoldDocument(text: string): JSONContent {
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
              { type: "tableHeader", content: [createParagraphNode("")] },
              { type: "tableHeader", content: [createParagraphNode("")] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [createParagraphNode("")] },
              { type: "tableCell", content: [createParagraphNode("")] },
            ],
          },
        ],
      },
    ],
  };
}

export const slashCommandSections: Array<{ id: SlashCommandSection; title: string; icon: LucideIcon }> = [
  { id: "basic", title: "Basic", icon: TextCursorInput },
  { id: "structure", title: "Structure", icon: Table2 },
  { id: "media", title: "Media", icon: ImageIcon },
];

export const slashCommands: SlashCommand[] = [
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
    id: "horizontal-rule",
    section: "structure",
    title: "Horizontal Rule",
    description: "Insert a divider block.",
    shortcut: "/divider",
    icon: TextCursorInput,
    keywords: ["divider", "rule", "horizontal", "separator", "hr"],
    createContent: () => emptyHorizontalRuleDocument(),
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

export function getSlashQuery(editor: Editor) {
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

export function getFilteredSlashCommands(slashQuery: string | null) {
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
}

export function getGroupedSlashCommands(filteredSlashCommands: SlashCommand[]) {
  return slashCommandSections
    .map((section) => ({
      ...section,
      commands: filteredSlashCommands.filter((command) => command.section === section.id),
    }))
    .filter((section) => section.commands.length > 0);
}
