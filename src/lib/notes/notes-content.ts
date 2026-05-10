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

function isEmptyParagraphNode(value: unknown) {
  return isRecord(value) && value.type === "paragraph" && !Array.isArray(value.content);
}

function isParagraphNode(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value.type === "paragraph";
}

function getNoteNodeSize(value: unknown): number {
  if (!isRecord(value) || typeof value.type !== "string") {
    return 0;
  }

  if (typeof value.text === "string") {
    return value.text.length;
  }

  const contentSize = Array.isArray(value.content)
    ? value.content.reduce((total, child) => total + getNoteNodeSize(child), 0)
    : 0;

  return contentSize + 2;
}

export function parseSerializedRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  if (isRecord(raw)) {
    return raw;
  }

  if (typeof raw !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isRecord(parsed)) {
      return parsed;
    }

    if (typeof parsed === "string") {
      try {
        const reparsed = JSON.parse(parsed) as unknown;
        return isRecord(reparsed) ? reparsed : null;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseSerializedDocument(raw: string): Record<string, unknown> | null {
  const parsedRecord = parseSerializedRecord(raw);

  return isNoteDocument(parsedRecord) ? parsedRecord : null;
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

export function mergeNoteDocuments(left: unknown, right: unknown) {
  const leftDocument = normalizeNoteDocument(left);
  const rightDocument = normalizeNoteDocument(right);
  const leftContent = Array.isArray(leftDocument.content) ? leftDocument.content : [];
  const rightContent = Array.isArray(rightDocument.content) ? rightDocument.content : [];
  const leftLastNode = leftContent.at(-1);
  const rightFirstNode = rightContent[0];

  const mergedContent = isParagraphNode(leftLastNode) && isParagraphNode(rightFirstNode)
    ? [
        ...leftContent.slice(0, -1),
        {
          ...leftLastNode,
          content: [
            ...(Array.isArray(leftLastNode.content) ? leftLastNode.content : []),
            ...(Array.isArray(rightFirstNode.content) ? rightFirstNode.content : []),
          ],
        },
        ...rightContent.slice(1),
      ]
    : [
        ...leftContent,
        ...rightContent,
      ];

  const filteredContent = mergedContent.length > 1
    ? mergedContent.filter((node) => !isEmptyParagraphNode(node))
    : mergedContent;

  return normalizeNoteDocument({
    type: "doc",
    content: filteredContent.length > 0 ? filteredContent : createEmptyNoteDocument().content,
  });
}

export function getNoteDocumentEndSelection(raw: unknown) {
  const normalizedDocument = normalizeNoteDocument(raw);
  const contentSize = Array.isArray(normalizedDocument.content)
    ? normalizedDocument.content.reduce((total, child) => total + getNoteNodeSize(child), 0)
    : 0;

  return Math.max(1, contentSize - 1);
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