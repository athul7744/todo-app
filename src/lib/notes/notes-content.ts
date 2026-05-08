function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNoteDocument(value: unknown): value is Record<string, unknown> & { type: string } {
  return isRecord(value) && typeof value.type === "string";
}

export function createEmptyNoteDocument() {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function createNoteDocumentFromText(text: string) {
  const trimmedText = text.trim();

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: trimmedText.length > 0 ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function parseSerializedDocument(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isNoteDocument(parsed)) {
      return parsed;
    }

    if (typeof parsed === "string") {
      try {
        const reparsed = JSON.parse(parsed) as unknown;
        return isNoteDocument(reparsed) ? reparsed : null;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizeNoteDocument(raw: unknown) {
  if (!raw) {
    return createEmptyNoteDocument();
  }

  if (isNoteDocument(raw)) {
    return raw;
  }

  if (typeof raw !== "string") {
    return createEmptyNoteDocument();
  }

  const parsedDocument = parseSerializedDocument(raw);
  if (parsedDocument) {
    return parsedDocument;
  }

  if (raw.trim().length === 0) {
    return createEmptyNoteDocument();
  }

  return createNoteDocumentFromText(raw);
}

export function serializeNoteDocument(raw: unknown) {
  return JSON.stringify(normalizeNoteDocument(raw));
}

export function extractNoteText(raw: unknown) {
  const parts: string[] = [];

  const visit = (value: unknown) => {
    if (!isRecord(value)) {
      return;
    }

    if (typeof value.text === "string") {
      parts.push(value.text);
    }

    if (Array.isArray(value.content)) {
      for (const child of value.content) {
        visit(child);
      }
    }
  };

  visit(normalizeNoteDocument(raw));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}