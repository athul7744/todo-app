function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNoteDocument(value: unknown): value is Record<string, unknown> & { type: string } {
  return isRecord(value) && typeof value.type === "string";
}

function normalizeObjectEntries(record: Record<string, unknown>) {
  const normalizedEntries = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, normalizeUnknownValue(value)] as const)
    .filter(([, value]) => value !== undefined);

  normalizedEntries.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return Object.fromEntries(normalizedEntries);
}

function normalizeUnknownValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeUnknownValue(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    return normalizeObjectEntries(value);
  }

  return value;
}

function normalizeNoteMark(mark: unknown) {
  if (!isRecord(mark) || typeof mark.type !== "string") {
    return null;
  }

  const normalizedMark: Record<string, unknown> = {
    type: mark.type,
  };

  if (isRecord(mark.attrs)) {
    const attrs = normalizeObjectEntries(mark.attrs);
    if (Object.keys(attrs).length > 0) {
      normalizedMark.attrs = attrs;
    }
  }

  return normalizedMark;
}

function normalizeNoteNode(node: unknown): Record<string, unknown> | null {
  if (!isRecord(node) || typeof node.type !== "string") {
    return null;
  }

  const normalizedNode: Record<string, unknown> = {
    type: node.type,
  };

  if (isRecord(node.attrs)) {
    const attrs = normalizeObjectEntries(node.attrs);
    if (Object.keys(attrs).length > 0) {
      normalizedNode.attrs = attrs;
    }
  }

  if (typeof node.text === "string") {
    normalizedNode.text = node.text;
  }

  if (Array.isArray(node.marks)) {
    const marks = node.marks
      .map((mark) => normalizeNoteMark(mark))
      .filter((mark): mark is Record<string, unknown> => mark !== null);

    if (marks.length > 0) {
      normalizedNode.marks = marks;
    }
  }

  if (Array.isArray(node.content)) {
    const content = node.content
      .map((child) => normalizeNoteNode(child))
      .filter((child): child is Record<string, unknown> => child !== null);

    if (content.length > 0) {
      normalizedNode.content = content;
    }
  }

  return normalizedNode;
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
  const normalizeResolvedDocument = (value: unknown) => normalizeNoteNode(value) ?? createEmptyNoteDocument();

  if (!raw) {
    return createEmptyNoteDocument();
  }

  if (isNoteDocument(raw)) {
    return normalizeResolvedDocument(raw);
  }

  if (typeof raw !== "string") {
    return createEmptyNoteDocument();
  }

  const parsedDocument = parseSerializedDocument(raw);
  if (parsedDocument) {
    return normalizeResolvedDocument(parsedDocument);
  }

  if (raw.trim().length === 0) {
    return createEmptyNoteDocument();
  }

  return normalizeResolvedDocument(createNoteDocumentFromText(raw));
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