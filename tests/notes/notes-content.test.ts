/// <reference types="vitest/globals" />

import {
  createEmptyNoteDocument,
  createNoteDocumentFromText,
  extractNoteText,
  mergeNoteDocuments,
  normalizeNoteDocument,
  serializeNoteDocument,
} from "@/lib/notes/notes-content";

describe("notes-content", () => {
  it("normalizes empty values to an empty note document", () => {
    expect(normalizeNoteDocument(null)).toEqual(createEmptyNoteDocument());
    expect(normalizeNoteDocument(undefined)).toEqual(createEmptyNoteDocument());
    expect(normalizeNoteDocument("")).toEqual(createEmptyNoteDocument());
  });

  it("preserves valid note documents", () => {
    const document = createNoteDocumentFromText("Hello world");
    expect(normalizeNoteDocument(document)).toEqual(document);
  });

  it("repairs double-encoded note documents", () => {
    const document = createNoteDocumentFromText("Recovered");
    const doubleEncodedDocument = JSON.stringify(JSON.stringify(document));

    expect(normalizeNoteDocument(doubleEncodedDocument)).toEqual(document);
  });

  it("falls back to a plain text document for legacy text content", () => {
    expect(normalizeNoteDocument("Legacy block")).toEqual(createNoteDocumentFromText("Legacy block"));
  });

  it("serializes to a single-encoded document string", () => {
    const document = createNoteDocumentFromText("Single encode");
    expect(serializeNoteDocument(document)).toBe(JSON.stringify(document));
  });

  it("extracts plain text across nested note content", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "One" },
            { type: "text", text: "Two" },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Three" }],
        },
      ],
    };

    expect(extractNoteText(document)).toBe("One Two Three");
  });

  it("merges into an effectively empty previous paragraph without keeping a blank node", () => {
    expect(
      mergeNoteDocuments(
        { type: "doc", content: [{ type: "paragraph" }] },
        createNoteDocumentFromText("Next")
      )
    ).toEqual(createNoteDocumentFromText("Next"));
  });

  it("preserves a previous non-paragraph trailing node instead of inline joining", () => {
    expect(
      mergeNoteDocuments(
        {
          type: "doc",
          content: [{ type: "horizontalRule" }],
        },
        createNoteDocumentFromText("Next")
      )
    ).toEqual({
      type: "doc",
      content: [
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "Next" }] },
      ],
    });
  });

  it("preserves task list content when merging a later paragraph block", () => {
    expect(
      mergeNoteDocuments(
        {
          type: "doc",
          content: [
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }],
                },
              ],
            },
          ],
        },
        createNoteDocumentFromText("Next")
      )
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Next" }] },
      ],
    });
  });

  it("preserves code block content when merging a later paragraph block", () => {
    expect(
      mergeNoteDocuments(
        {
          type: "doc",
          content: [
            {
              type: "codeBlock",
              attrs: { language: null },
              content: [{ type: "text", text: "const value = 1" }],
            },
          ],
        },
        createNoteDocumentFromText("Next")
      )
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [{ type: "text", text: "const value = 1" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Next" }] },
      ],
    });
  });

  it("preserves table content when merging a later paragraph block", () => {
    expect(
      mergeNoteDocuments(
        {
          type: "doc",
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
                  ],
                },
              ],
            },
          ],
        },
        createNoteDocumentFromText("Next")
      )
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
              ],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Next" }] },
      ],
    });
  });

  it("merges a paragraph inline into a heading, preserving heading type and attrs", () => {
    expect(
      mergeNoteDocuments(
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Title" }],
            },
          ],
        },
        createNoteDocumentFromText("Next")
      )
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "Title" },
            { type: "text", text: "Next" },
          ],
        },
      ],
    });
  });

  it("merges a heading inline into a paragraph, preserving paragraph type", () => {
    expect(
      mergeNoteDocuments(
        createNoteDocumentFromText("Before"),
        {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Title" }],
            },
          ],
        }
      )
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before" },
            { type: "text", text: "Title" },
          ],
        },
      ],
    });
  });
});