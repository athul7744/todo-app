"use client";

import { memo, useEffect, useRef } from "react";
import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import Text from "@tiptap/extension-text";

import { normalizeNoteDocument } from "@/lib/notes/notes-content";
import { logger } from "@/lib/shared/logger";

const referenceDecorationsKey = new PluginKey("noteReferenceDecorations");

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

function emptyDocument(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

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
  onCreateSibling: (content: JSONContent) => void;
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
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
        if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          const nextContent = flushEditorContent();
          if (nextContent) {
            onCreateSiblingRef.current(nextContent);
          }
          return true;
        }

        if (event.key === "Tab") {
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
      className="cursor-text"
      onMouseDown={(event) => {
        if (!editor) return;
        if (event.target instanceof HTMLElement && event.target.closest(".ProseMirror")) return;
        event.preventDefault();
        editor.chain().focus("end").run();
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
});