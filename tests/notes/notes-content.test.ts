import { describe, expect, it } from "vitest";

import {
  createEmptyNoteDocument,
  createNoteDocumentFromText,
  extractNoteText,
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
});