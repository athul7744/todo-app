interface SearchParamReader {
  get(name: string): string | null;
}

export interface IncomingSharePayload {
  title: string;
  text: string;
  url: string;
}

const TASK_TITLE_MAX_LENGTH = 250;

function normalizeShareValue(value: string | null): string {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}

function clampTaskTitle(value: string): string {
  if (value.length <= TASK_TITLE_MAX_LENGTH) return value;
  return `${value.slice(0, TASK_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

export function readIncomingSharePayload(params: SearchParamReader): IncomingSharePayload {
  return {
    title: normalizeShareValue(params.get("title")),
    text: normalizeShareValue(params.get("text")),
    url: normalizeShareValue(params.get("url")),
  };
}

export function buildSharedTaskTitle(payload: IncomingSharePayload): string {
  const parts: string[] = [];

  if (payload.title) parts.push(payload.title);
  if (payload.text && payload.text !== payload.title) parts.push(payload.text);
  if (payload.url && !parts.some((part) => part.includes(payload.url))) parts.push(payload.url);

  return clampTaskTitle(parts.join("\n\n").trim() || "Shared item");
}

export function sanitizeNextPath(next: string | null, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return fallback;
  }
  return next;
}