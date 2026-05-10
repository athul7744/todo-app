export type StructuredMarkdownListItem = {
  text: string;
  children: StructuredMarkdownListItem[];
};

function isMarkdownThematicBreak(line: string) {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

function getMarkdownListLineIndentWidth(lines: string[]) {
  const positiveIndents = lines
    .map((line) => {
      const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
      return leadingWhitespace.replace(/\t/g, "  ").length;
    })
    .filter((indent) => indent > 0)
    .sort((left, right) => left - right);

  return positiveIndents[0] ?? 1;
}

export function parseStructuredMarkdownList(text: string): StructuredMarkdownListItem[] | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  const listLineRegex = /^(\s*)([-*+]|\d+\.)(?:\s+(.*))?$/;
  if (!lines.every((line) => {
    const trimmedLine = line.trim();
    return isMarkdownThematicBreak(trimmedLine) || listLineRegex.test(line);
  })) {
    return null;
  }

  const indentWidth = getMarkdownListLineIndentWidth(lines);
  const roots: StructuredMarkdownListItem[] = [];
  const stack: StructuredMarkdownListItem[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (isMarkdownThematicBreak(trimmedLine)) {
      const lastRoot = roots[roots.length - 1];
      if (lastRoot && lastRoot.text.length === 0 && lastRoot.children.length === 0) {
        roots.pop();
      }

      stack.length = 0;
      roots.push({ text: trimmedLine, children: [] });
      continue;
    }

    const match = line.match(listLineRegex);
    if (!match) {
      return null;
    }

    const leadingWhitespace = match[1] ?? "";
    const rawIndent = leadingWhitespace.replace(/\t/g, "  ").length;
    const computedDepth = Math.floor(rawIndent / indentWidth);
    const depth = Math.min(computedDepth, stack.length);
    const item: StructuredMarkdownListItem = {
      text: match[3] ?? "",
      children: [],
    };

    while (stack.length > depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  }

  return roots;
}