import { describe, expect, it } from "vitest";

import { parseStructuredMarkdownList } from "@/lib/notes/markdown-clipboard";

describe("markdown-clipboard", () => {
  it("parses the nested pasted markdown case into parent and child items", () => {
    const markdown = `- ## Weekly Reading
	- [Design Notes](https://example.com/design-notes)
	- [Project Outline](https://example.com/project-outline)
	- [Research Summary](https://example.com/research-summary)
	- [Release Checklist](https://example.com/release-checklist)
	- [Team Decisions](https://example.com/team-decisions)
	- [Open Questions](https://example.com/open-questions)
	- [Implementation Plan](https://example.com/implementation-plan)
	- [Retrospective Draft](https://example.com/retrospective-draft)
-`;

    expect(parseStructuredMarkdownList(markdown)).toEqual([
      {
        text: "## Weekly Reading",
        children: [
          {
            text: "[Design Notes](https://example.com/design-notes)",
            children: [],
          },
          {
            text: "[Project Outline](https://example.com/project-outline)",
            children: [],
          },
          {
            text: "[Research Summary](https://example.com/research-summary)",
            children: [],
          },
          {
            text: "[Release Checklist](https://example.com/release-checklist)",
            children: [],
          },
          {
            text: "[Team Decisions](https://example.com/team-decisions)",
            children: [],
          },
          {
            text: "[Open Questions](https://example.com/open-questions)",
            children: [],
          },
          {
            text: "[Implementation Plan](https://example.com/implementation-plan)",
            children: [],
          },
          {
            text: "[Retrospective Draft](https://example.com/retrospective-draft)",
            children: [],
          },
        ],
      },
      {
        text: "",
        children: [],
      },
    ]);
  });

  it("returns null when the pasted text is not a pure markdown list", () => {
    expect(parseStructuredMarkdownList("Heading\n- child")).toBeNull();
  });
});